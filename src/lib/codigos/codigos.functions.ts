/**
 * Códigos de acesso — a tela lê e configura pelo servidor (as tabelas não abrem
 * para a API do navegador). Ver `operacional.codigos` para ver os códigos;
 * `operacional.codigos › edit` para cadastrar a caixa vigiada.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export interface CodigoRecebido {
  id: string;
  recebido_em: string;
  remetente_nome: string | null;
  remetente_email: string | null;
  banco: string | null;
  assunto: string | null;
  trecho: string | null;
  codigo: string | null;
  caixa_email: string;
}

export interface CaixaVigiada {
  id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  ativo: boolean;
  tem_senha: boolean;
  status: "aguardando" | "conectado" | "espera" | "erro" | "desligado";
  erro: string | null;
  espera_ate: string | null;
  ultima_leitura: string | null;
}

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/** Códigos das últimas 24 horas, do mais novo para o mais antigo. */
export const listarCodigos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["operacional.codigos", "view"])])
  .handler(async (): Promise<CodigoRecebido[]> => {
    const db = await admin();
    const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { data, error } = await db
      .from("codigos_recebidos")
      .select(
        "id, recebido_em, remetente_nome, remetente_email, banco, assunto, trecho, codigo, codigos_caixas(email)",
      )
      .gte("recebido_em", desde)
      .order("recebido_em", { ascending: false })
      .limit(100);
    if (error) throw new Error("Não foi possível carregar os códigos.");
    return (data ?? []).map((r) => {
      const { codigos_caixas: cx, ...resto } = r as typeof r & { codigos_caixas: { email: string } | null };
      return { ...(resto as Omit<CodigoRecebido, "caixa_email">), caixa_email: cx?.email ?? "" };
    });
  });

/** Caixas vigiadas e o estado da leitura (sem a senha). */
export const listarCaixas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["operacional.codigos", "view"])])
  .handler(async (): Promise<CaixaVigiada[]> => {
    const db = await admin();
    const { data, error } = await db
      .from("codigos_caixas")
      .select("id, email, imap_host, imap_port, ativo, senha_cifrada, status, erro, espera_ate, ultima_leitura")
      .order("created_at");
    if (error) throw new Error("Não foi possível carregar as caixas.");
    return (data ?? []).map(({ senha_cifrada, ...c }) => ({
      ...(c as Omit<CaixaVigiada, "tem_senha">),
      tem_senha: Boolean(senha_cifrada),
    }));
  });

const caixaSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  senha: z.string().max(200).optional(),
  imap_host: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Servidor inválido."),
  imap_port: z.number().int().min(1).max(65535),
  ativo: z.boolean(),
});

/**
 * Cadastra ou altera a caixa. Senha nova: cifra, zera a espera e as falhas (a
 * recusa anterior pode ter sido a senha errada) e o leitor tenta na próxima volta.
 */
export const salvarCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => caixaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { cifrarSenha } = await import("./cripto.server");
    const campos: Record<string, unknown> = {
      email: data.email,
      imap_host: data.imap_host,
      imap_port: data.imap_port,
      ativo: data.ativo,
      status: data.ativo ? "aguardando" : "desligado",
      updated_at: new Date().toISOString(),
    };
    if (data.senha) {
      Object.assign(campos, {
        senha_cifrada: cifrarSenha(data.senha),
        falhas: 0,
        espera_ate: null,
        erro: null,
      });
    }
    if (data.id) {
      const { error } = await db.from("codigos_caixas").update(campos).eq("id", data.id);
      if (error) throw new Error(mensagem(error.message));
      return { id: data.id };
    }
    if (!data.senha) throw new Error("Informe a senha da caixa.");
    const { data: nova, error } = await db
      .from("codigos_caixas")
      .insert({ ...campos, criado_por: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(mensagem(error.message));
    return { id: (nova as { id: string }).id };
  });

/** Remove a caixa (e os códigos dela). O leitor solta a conexão na próxima volta. */
export const removerCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("codigos_caixas").delete().eq("id", data.id);
    if (error) throw new Error("Não foi possível remover a caixa.");
    return { ok: true };
  });

function mensagem(msg: string): string {
  if (/codigos_caixas_email_uniq|duplicate key/i.test(msg)) return "Esta caixa já está cadastrada.";
  return "Não foi possível salvar a caixa.";
}

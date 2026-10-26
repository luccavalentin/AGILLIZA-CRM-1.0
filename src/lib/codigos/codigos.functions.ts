/**
 * Servidor de e-mail (antes "Códigos de acesso") — a tela lê e configura pelo servidor
 * (as tabelas não abrem para a API do navegador). `operacional.codigos › view` para ver
 * as mensagens capturadas; `operacional.codigos › edit` para cadastrar, editar, pausar e
 * testar as caixas vigiadas e o filtro de palavras de cada uma.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { trocaExigeSenha, type CampoFiltro, type OperadorFiltro } from "./filtros";

export interface CodigoRecebido {
  id: string;
  caixa_id: string;
  recebido_em: string;
  remetente_nome: string | null;
  remetente_email: string | null;
  banco: string | null;
  assunto: string | null;
  trecho: string | null;
  codigo: string | null;
  motivo: string | null;
  caixa_email: string;
  caixa_nome: string | null;
}

export interface FiltroCaixa {
  operador: OperadorFiltro;
  campo: CampoFiltro;
  termo: string;
  ativo: boolean;
}

export interface CaixaVigiada {
  id: string;
  nome: string | null;
  email: string;
  usuario: string | null;
  imap_host: string;
  imap_port: number;
  imap_ssl: boolean;
  pasta: string;
  usar_palavras_padrao: boolean;
  ativo: boolean;
  tem_senha: boolean;
  status: "aguardando" | "conectado" | "espera" | "erro" | "desligado";
  erro: string | null;
  espera_ate: string | null;
  ultima_leitura: string | null;
  teste_em: string | null;
  teste_ok: boolean | null;
  teste_msg: string | null;
  filtros: FiltroCaixa[];
}

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/**
 * Os códigos são de acesso aos BANCOS do correspondente: só a equipe interna os vê.
 * Teste adversarial 23/10/2026: nível de acesso novo nasce com "ver" em todo módulo
 * operacional — inclusive nível de portal do parceiro —, então um parceiro externo
 * passava a ler os códigos. A matriz sozinha não basta: aqui o portal do parceiro
 * (e quem está desativado/bloqueado) é recusado mesmo com a permissão marcada.
 */
async function exigirEquipeInterna(userId: string): Promise<void> {
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select("acesso_tipo, ativo, bloqueado_em")
    .eq("id", userId)
    .maybeSingle();
  const p = data as { acesso_tipo?: string | null; ativo?: boolean | null; bloqueado_em?: string | null } | null;
  if (!p || p.acesso_tipo !== "sistema" || p.ativo === false || p.bloqueado_em) {
    throw new Error("Você não tem permissão para esta ação.");
  }
}

const filtroListaSchema = z
  .object({
    caixaId: z.string().uuid().nullable().optional(),
    periodo: z.enum(["24h", "7d"]).default("24h"),
    soCodigos: z.boolean().default(false),
    busca: z.string().trim().max(80).optional().nullable(),
  })
  .default({});

/** Mensagens capturadas (com ou sem código), da mais nova para a mais antiga. */
export const listarCodigos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["operacional.codigos", "view"])])
  .inputValidator((d: unknown) => filtroListaSchema.parse(d ?? {}))
  .handler(async ({ data: f, context }): Promise<CodigoRecebido[]> => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const horas = f.periodo === "7d" ? 7 * 24 : 24;
    const desde = new Date(Date.now() - horas * 3_600_000).toISOString();
    let q = db
      .from("codigos_recebidos")
      .select(
        "id, caixa_id, recebido_em, remetente_nome, remetente_email, banco, assunto, trecho, codigo, motivo, codigos_caixas(email, nome)",
      )
      .gte("recebido_em", desde)
      .order("recebido_em", { ascending: false })
      .limit(f.periodo === "7d" ? 300 : 100);
    if (f.caixaId) q = q.eq("caixa_id", f.caixaId);
    if (f.soCodigos) q = q.not("codigo", "is", null);
    if (f.busca) {
      // Vírgula e parênteses quebrariam o filtro "or" do PostgREST: saem do termo.
      const t = f.busca.replace(/[,()%*\\]/g, " ").trim();
      if (t) {
        q = q.or(
          `assunto.ilike.%${t}%,remetente_email.ilike.%${t}%,remetente_nome.ilike.%${t}%,banco.ilike.%${t}%,codigo.ilike.%${t}%`,
        );
      }
    }
    const { data, error } = await q;
    if (error) throw new Error("Não foi possível carregar as mensagens.");
    return (data ?? []).map((r) => {
      const { codigos_caixas: cx, ...resto } = r as typeof r & {
        codigos_caixas: { email: string; nome: string | null } | null;
      };
      return {
        ...(resto as Omit<CodigoRecebido, "caixa_email" | "caixa_nome">),
        caixa_email: cx?.email ?? "",
        caixa_nome: cx?.nome ?? null,
      };
    });
  });

/** Caixas vigiadas, o estado da leitura e as regras de filtro (sem a senha). */
export const listarCaixas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["operacional.codigos", "view"])])
  .handler(async ({ context }): Promise<CaixaVigiada[]> => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const [caixas, filtros] = await Promise.all([
      db
        .from("codigos_caixas")
        .select(
          "id, nome, email, usuario, imap_host, imap_port, imap_ssl, pasta, usar_palavras_padrao, ativo, senha_cifrada, status, erro, espera_ate, ultima_leitura, teste_em, teste_ok, teste_msg",
        )
        .order("created_at"),
      db.from("codigos_filtros").select("caixa_id, operador, campo, termo, ativo").order("created_at"),
    ]);
    if (caixas.error || filtros.error) throw new Error("Não foi possível carregar as caixas.");
    const porCaixa = new Map<string, FiltroCaixa[]>();
    for (const f of (filtros.data ?? []) as (FiltroCaixa & { caixa_id: string })[]) {
      const { caixa_id, ...regra } = f;
      porCaixa.set(caixa_id, [...(porCaixa.get(caixa_id) ?? []), regra]);
    }
    return (caixas.data ?? []).map(({ senha_cifrada, ...c }) => ({
      ...(c as Omit<CaixaVigiada, "tem_senha" | "filtros">),
      tem_senha: Boolean(senha_cifrada),
      filtros: porCaixa.get((c as { id: string }).id) ?? [],
    }));
  });

const filtroSchema = z.object({
  operador: z.enum(["contem", "nao_contem"]),
  campo: z.enum(["qualquer", "assunto", "remetente", "corpo"]),
  termo: z.string().trim().min(2, "Cada termo precisa de ao menos 2 letras.").max(120),
  ativo: z.boolean().default(true),
});

export const caixaSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  usuario: z.string().trim().max(200).optional().nullable(),
  senha: z.string().max(200).optional(),
  imap_host: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/, "Servidor inválido."),
  imap_port: z.number().int().min(1).max(65535),
  imap_ssl: z.boolean().default(true),
  pasta: z
    .string()
    .trim()
    .min(1, "Informe a pasta (normalmente INBOX).")
    .max(120)
    .regex(/^[^\r\n"]+$/, "Pasta inválida."),
  usar_palavras_padrao: z.boolean().default(true),
  ativo: z.boolean(),
  filtros: z.array(filtroSchema).max(50, "Use no máximo 50 regras por caixa.").default([]),
});

export type DadosCaixa = z.input<typeof caixaSchema>;

/**
 * Cadastra ou altera a caixa e as regras dela. Senha nova: cifra, zera a espera e as
 * falhas (a recusa anterior pode ter sido a senha errada) e o leitor tenta na próxima volta.
 */
export const salvarCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => caixaSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const { cifrarSenha } = await import("./cripto.server");
    const usuario = data.usuario?.trim() ? data.usuario.trim() : null;
    if (data.id && !data.senha) {
      const { data: atual } = await db
        .from("codigos_caixas")
        .select("email, usuario, imap_host, imap_port, imap_ssl, senha_cifrada")
        .eq("id", data.id)
        .maybeSingle();
      if (!atual) throw new Error("Caixa não encontrada.");
      const a = atual as {
        email: string;
        usuario: string | null;
        imap_host: string;
        imap_port: number;
        imap_ssl: boolean;
        senha_cifrada: string;
      };
      if (a.senha_cifrada && trocaExigeSenha(a, { ...data, usuario })) {
        throw new Error(
          "Para trocar o e-mail, o usuário, o servidor, a porta ou desligar o SSL, informe a senha da caixa de novo.",
        );
      }
    }
    const campos: Record<string, unknown> = {
      nome: data.nome?.trim() || null,
      email: data.email,
      usuario,
      imap_host: data.imap_host,
      imap_port: data.imap_port,
      imap_ssl: data.imap_ssl,
      pasta: data.pasta,
      usar_palavras_padrao: data.usar_palavras_padrao,
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
    let id = data.id;
    if (id) {
      const { error } = await db.from("codigos_caixas").update(campos).eq("id", id);
      if (error) throw new Error(mensagem(error.message));
    } else {
      if (!data.senha) throw new Error("Informe a senha da caixa.");
      const { data: nova, error } = await db
        .from("codigos_caixas")
        .insert({ ...campos, criado_por: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(mensagem(error.message));
      id = (nova as { id: string }).id;
    }
    const { error: erroFiltros } = await db.rpc("codigos_substituir_filtros", {
      p_caixa: id,
      p_filtros: data.filtros,
      p_autor: context.userId,
    });
    if (erroFiltros) throw new Error("A caixa foi salva, mas as regras de filtro não. Tente de novo.");
    return { id: id! };
  });

/** Pausa ou retoma a leitura (o leitor solta a conexão na próxima volta). */
export const pausarCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const { data: feito, error } = await db
      .from("codigos_caixas")
      .update({
        ativo: data.ativo,
        status: data.ativo ? "aguardando" : "desligado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("id");
    if (error || !feito?.length) throw new Error("Caixa não encontrada.");
    return { ok: true };
  });

/** Testa o login e a pasta da caixa sem atrapalhar o leitor (ver teste-conexao.ts). */
export const testarConexaoCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const { testarCaixa } = await import("./teste-conexao.server");
    const r = await testarCaixa(db, data.id);
    return { ok: r.ok, mensagem: r.mensagem };
  });

/** Remove a caixa (e as mensagens e regras dela). O leitor solta a conexão na próxima volta. */
export const removerCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const { error } = await db.from("codigos_caixas").delete().eq("id", data.id);
    if (error) throw new Error("Não foi possível remover a caixa.");
    return { ok: true };
  });

function mensagem(msg: string): string {
  if (/codigos_caixas_email_uniq|duplicate key/i.test(msg)) return "Esta caixa já está cadastrada.";
  return "Não foi possível salvar a caixa.";
}

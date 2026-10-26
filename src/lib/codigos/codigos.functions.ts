/**
 * Códigos de acesso — a tela lê e configura pelo servidor (as tabelas não abrem
 * para a API do navegador). `operacional.codigos › edit` gere as caixas vigiadas,
 * vê todas e escolhe quem mais vê cada uma; `operacional.codigos › view` vê só as
 * caixas liberadas para a pessoa (decisão 16 do backtest de 23/10/2026). A regra
 * mora no banco (`codigos_caixas_visiveis`, migração 20261026150000).
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
  /** Quem foi liberado para ver esta caixa — só vem para quem gere as caixas. */
  liberados?: string[];
}

/** Pessoa da equipe interna que pode ser liberada numa caixa (tela de quem gere). */
export interface PessoaParaCaixa {
  id: string;
  nome: string | null;
  email: string | null;
  /** Gere as caixas: já vê todas, não precisa ser liberada. */
  ve_todas: boolean;
  /** Tem "Códigos de acesso › ver"; sem isso, liberar não abre a tela para ela. */
  pode_ver: boolean;
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
  const p = data as {
    acesso_tipo?: string | null;
    ativo?: boolean | null;
    bloqueado_em?: string | null;
  } | null;
  if (!p || p.acesso_tipo !== "sistema" || p.ativo === false || p.bloqueado_em) {
    throw new Error("Você não tem permissão para esta ação.");
  }
}

/** Ids das caixas que a pessoa pode ver (regra no banco: todas para quem gere, ou as liberadas). */
async function caixasVisiveis(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await db.rpc("codigos_caixas_visiveis", { _user_id: userId });
  if (error) throw new Error("Não foi possível conferir as caixas liberadas para você.");
  return ((data ?? []) as unknown[]).map((x) =>
    typeof x === "string" ? x : String((x as Record<string, unknown>).codigos_caixas_visiveis),
  );
}

/** Quem gere as caixas (vê todas e libera as outras pessoas), pela regra do banco. */
async function geraCaixas(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db.rpc("codigos_ve_todas_caixas", { _user_id: userId });
  if (error) throw new Error("Não foi possível conferir a sua permissão nas caixas.");
  return data === true;
}

/** Códigos das últimas 24 horas das caixas liberadas para a pessoa, do mais novo para o mais antigo. */
export const listarCodigos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["operacional.codigos", "view"])])
  .handler(async ({ context }): Promise<CodigoRecebido[]> => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
    // A lista vem filtrada do banco (`codigos_recebidos_visiveis`): caixa não liberada
    // para a pessoa não aparece, mesmo chamando este endereço direto.
    const { data, error } = await db.rpc("codigos_recebidos_visiveis", {
      _user_id: context.userId,
      _desde: desde,
      _limite: 100,
    });
    if (error) throw new Error("Não foi possível carregar os códigos.");
    return ((data ?? []) as CodigoRecebido[]).map((r) => ({
      ...r,
      caixa_email: r.caixa_email ?? "",
    }));
  });

/** Caixas vigiadas liberadas para a pessoa e o estado da leitura (sem a senha). */
export const listarCaixas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["operacional.codigos", "view"])])
  .handler(async ({ context }): Promise<CaixaVigiada[]> => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const ids = await caixasVisiveis(db, context.userId);
    if (ids.length === 0) return [];
    const { data, error } = await db
      .from("codigos_caixas")
      .select(
        "id, email, imap_host, imap_port, ativo, senha_cifrada, status, erro, espera_ate, ultima_leitura",
      )
      .in("id", ids)
      .order("created_at");
    if (error) throw new Error("Não foi possível carregar as caixas.");
    // Quem gere as caixas também recebe quem está liberado em cada uma (para o diálogo).
    let liberados: Map<string, string[]> | null = null;
    if (await geraCaixas(db, context.userId)) {
      const { data: lib, error: errLib } = await db
        .from("codigos_caixas_liberadas")
        .select("caixa_id, user_id")
        .in("caixa_id", ids);
      if (errLib) throw new Error("Não foi possível carregar quem vê cada caixa.");
      liberados = new Map();
      for (const l of (lib ?? []) as { caixa_id: string; user_id: string }[]) {
        liberados.set(l.caixa_id, [...(liberados.get(l.caixa_id) ?? []), l.user_id]);
      }
    }
    return (data ?? []).map(({ senha_cifrada, ...c }) => ({
      ...(c as Omit<CaixaVigiada, "tem_senha" | "liberados">),
      tem_senha: Boolean(senha_cifrada),
      ...(liberados ? { liberados: liberados.get((c as { id: string }).id) ?? [] } : {}),
    }));
  });

/** A equipe interna que pode ser liberada nas caixas (só para quem gere as caixas). */
export const listarPessoasParaCaixas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .handler(async ({ context }): Promise<PessoaParaCaixa[]> => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const { data, error } = await db.rpc("codigos_pessoas_para_liberar", { _por: context.userId });
    if (error) throw new Error("Não foi possível carregar a equipe.");
    return (data ?? []) as PessoaParaCaixa[];
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
  /** Quem (além de quem gere as caixas) vê os códigos desta caixa. Ausente: não mexe. */
  liberados: z.array(z.string().uuid()).max(500).optional(),
});

/**
 * Cadastra ou altera a caixa. Senha nova: cifra, zera a espera e as falhas (a
 * recusa anterior pode ter sido a senha errada) e o leitor tenta na próxima volta.
 */
export const salvarCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => caixaSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const { cifrarSenha } = await import("./cripto.server");
    // Trocar o endereço, o servidor ou a porta de uma caixa que já tem senha EXIGE a
    // senha de novo. Teste adversarial 23/10/2026: sem isso, quem pode editar apontava
    // a caixa para um servidor dele e o leitor entregava a senha guardada no login.
    if (data.id && !data.senha) {
      const { data: atual } = await db
        .from("codigos_caixas")
        .select("email, imap_host, imap_port")
        .eq("id", data.id)
        .maybeSingle();
      if (!atual) throw new Error("Caixa não encontrada.");
      const a = atual as { email: string; imap_host: string; imap_port: number };
      if (
        a.email.toLowerCase() !== data.email ||
        a.imap_host.toLowerCase() !== data.imap_host ||
        a.imap_port !== data.imap_port
      ) {
        throw new Error(
          "Para trocar o e-mail, o servidor ou a porta, informe a senha da caixa de novo.",
        );
      }
    }
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
    let id: string;
    if (data.id) {
      const { error } = await db.from("codigos_caixas").update(campos).eq("id", data.id);
      if (error) throw new Error(mensagem(error.message));
      id = data.id;
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
    if (data.liberados) {
      // O banco confere de novo quem libera e quem pode ser liberado.
      const { error } = await db.rpc("codigos_definir_liberados", {
        _caixa: id,
        _usuarios: [...new Set(data.liberados)],
        _por: context.userId,
      });
      if (error) {
        throw new Error(
          /equipe interna/i.test(error.message)
            ? "Só dá para liberar a caixa para pessoas ativas da equipe interna."
            : /permiss/i.test(error.message)
              ? "Você não tem permissão para liberar caixas."
              : "A caixa foi salva, mas não foi possível salvar quem vê os códigos dela.",
        );
      }
    }
    return { id };
  });

/** Remove a caixa (e os códigos dela). O leitor solta a conexão na próxima volta. */
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

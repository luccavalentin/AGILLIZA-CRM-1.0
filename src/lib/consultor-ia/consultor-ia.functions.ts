/**
 * Consultor IA — assistente de financiamento imobiliário com RAG sobre a base
 * de conhecimento mantida pela equipe (`consultor_ia_base`).
 *
 * A IA NUNCA escreve na base: ela apenas lê os trechos recuperados e responde
 * fundamentada neles. A atualização do conhecimento é curadoria manual feita
 * na tela de administração.
 *
 * A pergunta em si vai pela rota de streaming (`/api/consultor-ia/stream`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { ResultadoFerramenta } from "./ferramentas";
import type { ParametrosCalculo } from "./calculos";

export interface FonteCitada {
  id: string;
  titulo: string;
  categoria: string;
}

export interface MensagemConsultor {
  id: string;
  papel: "usuario" | "assistente";
  conteudo: string;
  fontes_usadas: FonteCitada[];
  sem_resposta: boolean;
  avaliacao: "util" | "nao_util" | null;
  created_at: string;
  /** Contas feitas pelo sistema (SAC/PRICE, comprometimento, custos) para esta resposta. */
  calculos: ResultadoFerramenta[];
  /** A pergunta dependia de dado atual que a base não trazia. */
  aviso_dado_atual: boolean;
}

export interface ConversaConsultor {
  id: string;
  titulo: string;
  updated_at: string;
}

export interface AnexoBase {
  nome: string;
  caminho: string;
  tamanho: number;
  tipo: string;
}

export interface ItemBase {
  id: string;
  categoria: string;
  titulo: string;
  conteudo: string;
  tags: string[];
  ativo: boolean;
  correspondente_id: string | null;
  updated_at: string;
  /** C19: rascunho não alimenta o Consultor nem aparece fora da administração. */
  status: "rascunho" | "publicado";
  resumo: string | null;
  capa_url: string | null;
  anexos: AnexoBase[];
  versao: number;
  publicado_em: string | null;
  /** C20: o post da Agilliza News feito a partir deste artigo. */
  news_post_id: string | null;
  news_publicado_em: string | null;
  news_publico: string | null;
  news_fim_em: string | null;
}

const COLUNAS_ITEM =
  "id, categoria, titulo, conteudo, tags, ativo, correspondente_id, updated_at, status, resumo, capa_url, anexos, versao, publicado_em, news_post_id, news_publicado_em, news_publico, news_fim_em";

function comoItem(r: any): ItemBase {
  return {
    ...r,
    tags: Array.isArray(r.tags) ? r.tags : [],
    status: r.status === "rascunho" ? "rascunho" : "publicado",
    anexos: Array.isArray(r.anexos) ? r.anexos : [],
    versao: Number(r.versao ?? 1),
  };
}

export const CATEGORIAS_BASE = [
  "FGTS",
  "SFH_SFI",
  "Bradesco",
  "Santander",
  "Itau",
  "Documentacao",
  "Regulatorio",
  "Duvidas_Frequentes",
] as const;

/** Quem usa o Consultor (mesma regra da rota /crm/consultor-ia e do streaming). */
const usaConsultor = exigirPermissao(["crm.clientes", "view"]);

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível identificar a sua conta.");
  return data?.correspondente_id ?? null;
}

/**
 * Verbete global (sem conta) vale para todas as contas: só a administração da
 * plataforma cria, altera ou apaga. Mesma regra da RLS (`pode_editar_base_global`).
 */
export async function podeEditarBaseGlobal(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("pode_editar_base_global", { _user_id: userId });
  if (error) throw new Error("Não foi possível conferir suas permissões.");
  return data === true;
}

export const MSG_SO_PLATAFORMA = "Só a administração da plataforma altera conteúdo global.";

/** Lista as conversas do usuário logado. */
export const listarConversasConsultor = createServerFn({ method: "GET" })
  .middleware([usaConsultor])
  .handler(async ({ context }): Promise<ConversaConsultor[]> => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase
      .from("consultor_ia_conversas")
      .select("id, titulo, created_at, updated_at")
      .eq("usuario_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Não foi possível carregar as conversas.");
    return (data ?? []) as ConversaConsultor[];
  });

/** Mensagens de uma conversa (RLS garante que é do próprio usuário). */
export const listarMensagensConsultor = createServerFn({ method: "GET" })
  .middleware([usaConsultor])
  .inputValidator((d: { conversa_id: string }) =>
    z.object({ conversa_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<MensagemConsultor[]> => {
    const { supabase } = context as any;
    const { data: msgs, error } = await supabase
      .from("consultor_ia_mensagens")
      .select("id, papel, conteudo, fontes_usadas, sem_resposta, avaliacao, created_at, calculos, aviso_dado_atual")
      .eq("conversa_id", data.conversa_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Não foi possível carregar a conversa.");
    return (msgs ?? []).map((m: any) => ({
      ...m,
      fontes_usadas: Array.isArray(m.fontes_usadas) ? m.fontes_usadas : [],
      calculos: Array.isArray(m.calculos) ? m.calculos : [],
      aviso_dado_atual: !!m.aviso_dado_atual,
    })) as MensagemConsultor[];
  });

export const excluirConversaConsultor = createServerFn({ method: "POST" })
  .middleware([usaConsultor])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("consultor_ia_conversas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const avaliarRespostaConsultor = createServerFn({ method: "POST" })
  .middleware([usaConsultor])
  .inputValidator((d: { mensagem_id: string; avaliacao: "util" | "nao_util" | null }) =>
    z
      .object({
        mensagem_id: z.string().uuid(),
        avaliacao: z.enum(["util", "nao_util"]).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("consultor_ia_mensagens")
      .update({ avaliacao: data.avaliacao })
      .eq("id", data.mensagem_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Envia uma sugestão de conteúdo (lacuna de conhecimento) para curadoria. */
export const sugerirConteudoBase = createServerFn({ method: "POST" })
  .middleware([usaConsultor])
  .inputValidator((d: { pergunta: string; observacao?: string }) =>
    z
      .object({ pergunta: z.string().min(3).max(4000), observacao: z.string().max(2000).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { error } = await supabase.from("consultor_ia_sugestoes").insert({
      correspondente_id: corr,
      usuario_id: userId,
      pergunta: data.pergunta,
      observacao: data.observacao ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Conteúdo completo de um item da base (para a citação clicável). */
export const obterItemBase = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"], ["admin.parametros", "view"])])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ItemBase | null> => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase
      .from("consultor_ia_base")
      .select(COLUNAS_ITEM)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error("Não foi possível abrir o verbete.");
    return row ? comoItem(row) : null;
  });

/* ─────────────── Administração da base de conhecimento ─────────────── */

export const listarBaseConhecimento = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["admin.parametros", "view"])])
  .inputValidator((d?: { q?: string; categoria?: string; incluirInativos?: boolean }) =>
    z
      .object({
        q: z.string().optional(),
        categoria: z.string().optional(),
        incluirInativos: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<ItemBase[]> => {
    const { supabase } = context as any;
    let q = supabase
      .from("consultor_ia_base")
      .select(COLUNAS_ITEM)
      .order("categoria", { ascending: true })
      .order("titulo", { ascending: true });
    if (data.categoria && data.categoria !== "todas") q = q.eq("categoria", data.categoria);
    if (!data.incluirInativos) q = q.eq("ativo", true);
    if (data.q && data.q.trim()) {
      // Vírgula, parêntese e curingas quebravam o filtro `or` do PostgREST.
      const termo = `%${data.q.trim().replace(/[,()%*"\\]/g, " ")}%`;
      q = q.or(`titulo.ilike."${termo}",conteudo.ilike."${termo}"`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map(comoItem);
  });

/** O que a tela da base pode oferecer a este usuário. */
export const obterPermissoesBase = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["admin.parametros", "view"])])
  .handler(async ({ context }): Promise<{ global: boolean }> => {
    const { supabase, userId } = context as any;
    return { global: await podeEditarBaseGlobal(supabase, userId) };
  });

export const salvarItemBase = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.parametros", "edit"])])
  .inputValidator(
    (d: {
      id?: string;
      categoria: string;
      titulo: string;
      conteudo: string;
      tags: string[];
      ativo: boolean;
      global: boolean;
      status?: "rascunho" | "publicado";
      resumo?: string | null;
      capa_url?: string | null;
      anexos?: AnexoBase[];
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          categoria: z.string().min(1).max(60),
          titulo: z.string().trim().min(3).max(200),
          conteudo: z.string().min(10).max(200_000),
          tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
          ativo: z.boolean().default(true),
          global: z.boolean().default(false),
          status: z.enum(["rascunho", "publicado"]).default("publicado"),
          resumo: z.string().max(400).nullable().optional(),
          capa_url: z
            .string()
            .max(1000)
            .regex(/^https:\/\//, "A capa precisa ser um endereço https://.")
            .nullable()
            .optional(),
          anexos: z
            .array(
              z.object({
                nome: z.string().min(1).max(200),
                caminho: z.string().min(3).max(400),
                tamanho: z.number().int().min(0).max(30 * 1024 * 1024),
                tipo: z.string().max(120),
              }),
            )
            .max(20)
            .default([]),
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context as any;
    const [corr, podeGlobal] = await Promise.all([
      correspondenteDoUsuario(supabase, userId),
      podeEditarBaseGlobal(supabase, userId),
    ]);

    if (data.id) {
      const { data: atual, error: erroAtual } = await supabase
        .from("consultor_ia_base")
        .select("id, correspondente_id")
        .eq("id", data.id)
        .maybeSingle();
      if (erroAtual) throw new Error(erroAtual.message);
      if (!atual) throw new Error("Verbete não encontrado.");
      const eraGlobal = atual.correspondente_id === null;
      // Antes, salvar um global com "global" desligado o puxava para a conta de
      // quem editou, e ele sumia para todas as outras.
      if ((eraGlobal || data.global) && !podeGlobal) throw new Error(MSG_SO_PLATAFORMA);
      if (!eraGlobal && atual.correspondente_id !== corr) {
        throw new Error("Verbete não encontrado.");
      }
    } else if (data.global && !podeGlobal) {
      throw new Error(MSG_SO_PLATAFORMA);
    }
    if (!data.global && !corr) throw new Error("Conta não identificada.");
    // Anexo só da pasta da própria conta (o bucket já barra a leitura de outra).
    if (data.anexos.some((a) => !corr || !a.caminho.startsWith(`${corr}/`) || a.caminho.includes(".."))) {
      throw new Error("Anexo inválido.");
    }

    const payload = {
      categoria: data.categoria,
      titulo: data.titulo,
      conteudo: data.conteudo,
      tags: [...new Set(data.tags.map((t) => t.toLowerCase()))],
      ativo: data.ativo,
      correspondente_id: data.global ? null : corr,
      atualizado_por: userId,
      status: data.status,
      resumo: data.resumo?.trim() || null,
      capa_url: data.capa_url || null,
      anexos: data.anexos,
    };
    if (data.id) {
      const { data: alterados, error } = await supabase
        .from("consultor_ia_base")
        .update(payload)
        .eq("id", data.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!alterados?.length) throw new Error("Você não tem permissão para alterar este verbete.");
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("consultor_ia_base")
      .insert({ ...payload, criado_por: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const excluirItemBase = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.parametros", "edit"])])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: atual, error: erroAtual } = await supabase
      .from("consultor_ia_base")
      .select("id, correspondente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (erroAtual) throw new Error(erroAtual.message);
    if (!atual) throw new Error("Verbete não encontrado.");
    if (atual.correspondente_id === null && !(await podeEditarBaseGlobal(supabase, userId))) {
      throw new Error(MSG_SO_PLATAFORMA);
    }
    const { data: apagados, error } = await supabase
      .from("consultor_ia_base")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!apagados?.length) throw new Error("Você não tem permissão para apagar este verbete.");
    return { ok: true };
  });

export const listarSugestoesBase = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["admin.parametros", "view"])])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("consultor_ia_sugestoes")
      .select("id, pergunta, observacao, status, created_at")
      .eq("status", "aberta")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Não foi possível carregar as sugestões.");
    return (data ?? []) as Array<{
      id: string;
      pergunta: string;
      observacao: string | null;
      status: string;
      created_at: string;
    }>;
  });

export const resolverSugestaoBase = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.parametros", "edit"])])
  .inputValidator((d: { id: string; status: "resolvida" | "descartada" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["resolvida", "descartada"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("consultor_ia_sugestoes")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ─────────────── Parâmetros de cálculo do Consultor (C18) ─────────────── */

/** Os parâmetros da conta (a calculadora da tela e o Consultor usam os mesmos). */
export const obterParametrosConsultor = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"], ["admin.parametros", "view"])])
  .handler(async ({ context }): Promise<ParametrosCalculo & { atualizado_em: string | null }> => {
    const { supabase } = context as any;
    const { data, error } = await supabase.rpc("consultor_ia_parametros_da_conta");
    if (error || !data) throw new Error("Não foi possível ler os parâmetros de cálculo.");
    const r = Array.isArray(data) ? data[0] : data;
    return {
      itbi_percentual: Number(r.itbi_percentual),
      itbi_municipios: Array.isArray(r.itbi_municipios) ? r.itbi_municipios : [],
      cartorio_percentual: Number(r.cartorio_percentual),
      avaliacao_banco: Number(r.avaliacao_banco),
      certidoes_valor: Number(r.certidoes_valor),
      comprometimento_max_percentual: Number(r.comprometimento_max_percentual),
      taxa_referencia_anual: r.taxa_referencia_anual == null ? null : Number(r.taxa_referencia_anual),
      atualizado_em: r.atualizado_em ?? null,
    };
  });

const parametrosSchema = z.object({
  itbi_percentual: z.number().min(0).max(10),
  itbi_municipios: z
    .array(
      z.object({
        municipio: z.string().trim().min(2).max(80),
        uf: z.string().trim().length(2).toUpperCase(),
        percentual: z.number().min(0).max(10),
      }),
    )
    .max(200),
  cartorio_percentual: z.number().min(0).max(10),
  avaliacao_banco: z.number().min(0).max(100000),
  certidoes_valor: z.number().min(0).max(100000),
  comprometimento_max_percentual: z.number().min(1).max(100),
  taxa_referencia_anual: z.number().min(0).max(60).nullable(),
});

export const salvarParametrosConsultor = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.parametros", "edit"])])
  .inputValidator((d: unknown) => parametrosSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context as any;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Conta não identificada.");
    const { error } = await supabase.from("consultor_ia_parametros").upsert(
      { correspondente_id: corr, ...data, atualizado_por: userId, atualizado_em: new Date().toISOString() },
      { onConflict: "correspondente_id" },
    );
    if (error) throw new Error("Não foi possível salvar os parâmetros.");
    return { ok: true };
  });

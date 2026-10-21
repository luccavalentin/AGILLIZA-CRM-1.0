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
}

export interface ConversaConsultor {
  id: string;
  titulo: string;
  updated_at: string;
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
      .select("id, papel, conteudo, fontes_usadas, sem_resposta, avaliacao, created_at")
      .eq("conversa_id", data.conversa_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Não foi possível carregar a conversa.");
    return (msgs ?? []).map((m: any) => ({
      ...m,
      fontes_usadas: Array.isArray(m.fontes_usadas) ? m.fontes_usadas : [],
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
      .select("id, categoria, titulo, conteudo, tags, ativo, correspondente_id, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error("Não foi possível abrir o verbete.");
    return (row as ItemBase) ?? null;
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
      .select("id, categoria, titulo, conteudo, tags, ativo, correspondente_id, updated_at")
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
    return (rows ?? []) as ItemBase[];
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
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          categoria: z.string().min(1),
          titulo: z.string().min(3),
          conteudo: z.string().min(10),
          tags: z.array(z.string()).default([]),
          ativo: z.boolean().default(true),
          global: z.boolean().default(false),
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

    const payload = {
      categoria: data.categoria,
      titulo: data.titulo,
      conteudo: data.conteudo,
      tags: data.tags,
      ativo: data.ativo,
      correspondente_id: data.global ? null : corr,
      atualizado_por: userId,
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

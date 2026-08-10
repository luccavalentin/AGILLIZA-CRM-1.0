/**
 * Consultor IA — assistente de financiamento imobiliário com RAG sobre a base
 * de conhecimento mantida pela equipe (`consultor_ia_base`).
 *
 * A IA NUNCA escreve na base: ela apenas lê os trechos recuperados e responde
 * fundamentada neles. A atualização do conhecimento é curadoria manual feita
 * na tela de administração.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const STOPWORDS = new Set([
  "a","o","as","os","de","da","do","das","dos","e","em","um","uma","para","por","com","que",
  "qual","quais","como","quando","onde","é","sao","são","no","na","nos","nas","ao","aos","se",
  "sobre","meu","minha","the","of",
]);

function tokens(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

/** Ranqueia os trechos da base por sobreposição de termos com a pergunta. */
function selecionarTrechos(itens: ItemBase[], pergunta: string, limite = 5): ItemBase[] {
  const termos = tokens(pergunta);
  if (termos.length === 0) return itens.slice(0, limite);
  const pontuados = itens.map((it) => {
    const alvoTitulo = tokens(`${it.titulo} ${it.tags.join(" ")}`);
    const alvoConteudo = tokens(it.conteudo);
    let score = 0;
    for (const t of termos) {
      if (alvoTitulo.some((x) => x.startsWith(t) || t.startsWith(x))) score += 3;
      score += Math.min(alvoConteudo.filter((x) => x === t).length, 4);
    }
    return { it, score };
  });
  return pontuados
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map((p) => p.it);
}

/** Lista as conversas do usuário logado. */
export const listarConversasConsultor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversaConsultor[]> => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("consultor_ia_conversas")
      .select("id, titulo, updated_at")
      .eq("usuario_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    return (data ?? []) as ConversaConsultor[];
  });

/** Mensagens de uma conversa (RLS garante que é do próprio usuário). */
export const listarMensagensConsultor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversa_id: string }) =>
    z.object({ conversa_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<MensagemConsultor[]> => {
    const { supabase } = context as any;
    const { data: msgs } = await supabase
      .from("consultor_ia_mensagens")
      .select("id, papel, conteudo, fontes_usadas, sem_resposta, avaliacao, created_at")
      .eq("conversa_id", data.conversa_id)
      .order("created_at", { ascending: true });
    return (msgs ?? []).map((m: any) => ({
      ...m,
      fontes_usadas: Array.isArray(m.fontes_usadas) ? m.fontes_usadas : [],
    })) as MensagemConsultor[];
  });

export const excluirConversaConsultor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("consultor_ia_conversas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const avaliarRespostaConsultor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pergunta: string; observacao?: string }) =>
    z
      .object({ pergunta: z.string().min(3), observacao: z.string().optional() })
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ItemBase | null> => {
    const { supabase } = context as any;
    const { data: row } = await supabase
      .from("consultor_ia_base")
      .select("id, categoria, titulo, conteudo, tags, ativo, correspondente_id, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    return (row as ItemBase) ?? null;
  });

/* ─────────────── Administração da base de conhecimento ─────────────── */

export const listarBaseConhecimento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
      const termo = `%${data.q.trim()}%`;
      q = q.or(`titulo.ilike.${termo},conteudo.ilike.${termo}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ItemBase[];
  });

export const salvarItemBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const corr = await correspondenteDoUsuario(supabase, userId);
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
      const { error } = await supabase
        .from("consultor_ia_base")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("consultor_ia_base").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarSugestoesBase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data } = await supabase
      .from("consultor_ia_sugestoes")
      .select("id, pergunta, observacao, status, created_at")
      .eq("status", "aberta")
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as Array<{
      id: string;
      pergunta: string;
      observacao: string | null;
      status: string;
      created_at: string;
    }>;
  });

export const resolverSugestaoBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

/* ───────────────────────── Consulta (RAG) ───────────────────────── */

const MARCADOR_SEM_INFO = "SEM_INFORMACAO_NA_BASE";

export interface RespostaConsultor {
  conversa_id: string;
  mensagem_id: string;
  resposta: string;
  fontes: FonteCitada[];
  sem_resposta: boolean;
}

export const consultarAssistenteIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversa_id?: string | null; pergunta: string }) =>
    z
      .object({
        conversa_id: z.string().uuid().nullable().optional(),
        pergunta: z.string().min(2).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<RespostaConsultor> => {
    const { supabase, userId } = context as any;
    const nucleo = await import("./consultor-ia.server");
    const preparo = await nucleo.prepararConsulta(supabase, userId, {
      conversa_id: data.conversa_id ?? null,
      pergunta: data.pergunta,
    });
    const bruto = await nucleo.gerarTexto(preparo);
    const fim = await nucleo.finalizarResposta(
      supabase,
      preparo.conversaId,
      preparo.trechos,
      bruto,
    );
    return { conversa_id: preparo.conversaId, ...fim };
  });

/* ───────── Base de conhecimento: perguntas já respondidas ───────── */

export interface PerguntaRespondida {
  id: string;
  conversa_id: string;
  pergunta: string;
  resposta: string;
  fontes: FonteCitada[];
  sem_resposta: boolean;
  avaliacao: "util" | "nao_util" | null;
  palavras_chave: string[];
  created_at: string;
}

/**
 * Consolida o histórico de perguntas e respostas do consultor em uma base
 * pesquisável por palavra-chave. A RLS já limita ao que o usuário pode ver.
 */
export const listarPerguntasRespondidas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { q?: string; limite?: number }) =>
    z.object({ q: z.string().optional(), limite: z.number().min(1).max(500).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<PerguntaRespondida[]> => {
    const { supabase } = context as any;
    const { data: rows, error } = await supabase
      .from("consultor_ia_mensagens")
      .select("id, conversa_id, papel, conteudo, fontes_usadas, sem_resposta, avaliacao, created_at")
      .order("created_at", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);

    const porConversa = new Map<string, any[]>();
    for (const m of rows ?? []) {
      const arr = porConversa.get(m.conversa_id) ?? [];
      arr.push(m);
      porConversa.set(m.conversa_id, arr);
    }

    const itens: PerguntaRespondida[] = [];
    for (const msgs of porConversa.values()) {
      for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].papel !== "usuario") continue;
        const resposta = msgs.slice(i + 1).find((m: any) => m.papel === "assistente");
        if (!resposta) continue;
        itens.push({
          id: resposta.id,
          conversa_id: resposta.conversa_id,
          pergunta: msgs[i].conteudo,
          resposta: resposta.conteudo,
          fontes: Array.isArray(resposta.fontes_usadas) ? resposta.fontes_usadas : [],
          sem_resposta: !!resposta.sem_resposta,
          avaliacao: resposta.avaliacao ?? null,
          palavras_chave: Array.from(new Set(tokens(msgs[i].conteudo))).slice(0, 6),
          created_at: resposta.created_at,
        });
      }
    }

    const termos = tokens(data.q ?? "");
    const filtrados = termos.length
      ? itens.filter((it) => {
          const alvo = tokens(`${it.pergunta} ${it.resposta} ${it.palavras_chave.join(" ")}`);
          return termos.every((t) => alvo.some((x) => x.startsWith(t) || t.startsWith(x)));
        })
      : itens;

    return filtrados
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, data.limite ?? 100);
  });

/**
 * Carrega os documentos enviados à HomeFin de várias propostas e resume cada
 * uma no selo de documentação (ver `documentacao-status.ts`).
 *
 * Usado pela consulta de propostas, pelo painel do CRM e pela ficha.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  situacaoDocumentacao,
  type DocumentoHomefinLinha,
  type SituacaoDocumentacao,
} from "./documentacao-status";

/** Ids por consulta: `.in()` vai na URL e não pode crescer sem limite. */
const IDS_POR_LOTE = 150;
/** Teto de linhas do PostgREST por resposta. */
const LINHAS_POR_PAGINA = 1000;

async function documentosDasPropostas(
  supabase: SupabaseClient<any, any, any>,
  ids: string[],
): Promise<Map<string, DocumentoHomefinLinha[]>> {
  const porProposta = new Map<string, DocumentoHomefinLinha[]>();
  for (let i = 0; i < ids.length; i += IDS_POR_LOTE) {
    const lote = ids.slice(i, i + IDS_POR_LOTE);
    for (let ini = 0; ; ini += LINHAS_POR_PAGINA) {
      const { data, error } = await supabase
        .from("proposta_documentos_homefin" as any)
        .select("proposta_id, situacao, mensagem, nome_vaga, enviado_em, atualizado_em")
        .in("proposta_id", lote)
        .order("id")
        .range(ini, ini + LINHAS_POR_PAGINA - 1);
      if (error) throw new Error(error.message);
      const linhas = (data ?? []) as any[];
      for (const l of linhas) {
        const lista = porProposta.get(l.proposta_id) ?? [];
        lista.push(l);
        porProposta.set(l.proposta_id, lista);
      }
      if (linhas.length < LINHAS_POR_PAGINA) break;
    }
  }
  return porProposta;
}

/**
 * Até quando esta pessoa já leu os comentários de cada proposta
 * (`proposta_comentarios_vistos`). É o que o selo compara com a decisão mais
 * recente da HomeFin para saber se pisca.
 */
async function leiturasDasPropostas(
  supabase: SupabaseClient<any, any, any>,
  ids: string[],
  userId: string,
): Promise<Map<string, string>> {
  const porProposta = new Map<string, string>();
  for (let i = 0; i < ids.length; i += IDS_POR_LOTE) {
    const { data, error } = await supabase
      .from("proposta_comentarios_vistos" as any)
      .select("proposta_id, visto_em")
      // A política de acesso já limita à própria pessoa; o filtro explícito é
      // para quem chamar com o cliente administrativo, que passa por cima dela.
      .eq("user_id", userId)
      .in("proposta_id", ids.slice(i, i + IDS_POR_LOTE));
    if (error) throw new Error(error.message);
    // Uma linha por (proposta, pessoa): não há o que paginar dentro do lote.
    for (const l of (data ?? []) as any[]) porProposta.set(l.proposta_id, l.visto_em);
  }
  return porProposta;
}

/**
 * Selo de documentação de cada proposta. Falha na leitura não derruba a tela
 * que chamou: sem selo é melhor que sem lista.
 */
export async function situacoesDocumentacao(
  supabase: SupabaseClient<any, any, any>,
  propostas: { id: string; status: string | null }[],
  userId?: string | null,
): Promise<Map<string, SituacaoDocumentacao | null>> {
  const resultado = new Map<string, SituacaoDocumentacao | null>();
  if (propostas.length === 0) return resultado;
  const ids = propostas.map((p) => p.id);
  let docs = new Map<string, DocumentoHomefinLinha[]>();
  let vistos = new Map<string, string>();
  try {
    [docs, vistos] = await Promise.all([
      documentosDasPropostas(supabase, ids),
      // Falhando a leitura, o selo sai sem marca de lido e pisca. Chamar
      // atenção à toa é melhor que esconder uma recusa.
      userId
        ? leiturasDasPropostas(supabase, ids, userId).catch((e) => {
            console.error("[documentacao] leitura dos comentários vistos falhou", e);
            return new Map<string, string>();
          })
        : Promise.resolve(new Map<string, string>()),
    ]);
  } catch (e) {
    console.error("[documentacao] leitura dos documentos falhou", e);
  }
  for (const p of propostas) {
    resultado.set(p.id, situacaoDocumentacao(p.status, docs.get(p.id), vistos.get(p.id) ?? null));
  }
  return resultado;
}

/** Documentos recusados de uma proposta, com o comentário da análise. */
export async function documentosRecusados(
  supabase: SupabaseClient<any, any, any>,
  propostaId: string,
): Promise<{ nome_vaga: string | null; mensagem: string | null; atualizado_em: string | null }[]> {
  const { data, error } = await supabase
    .from("proposta_documentos_homefin" as any)
    .select("nome_vaga, mensagem, atualizado_em")
    .eq("proposta_id", propostaId)
    .eq("situacao", "erro")
    .order("atualizado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

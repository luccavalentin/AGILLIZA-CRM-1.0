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
 * Comentário mais recente do banco em cada proposta (`proposta_followups` de
 * tipo "banco", espelho das atividades da oportunidade). Entra no selo só para
 * dizer que há novidade a ler.
 */
async function ultimoComentarioDoBanco(
  supabase: SupabaseClient<any, any, any>,
  ids: string[],
): Promise<Map<string, string>> {
  const porProposta = new Map<string, string>();
  for (let i = 0; i < ids.length; i += IDS_POR_LOTE) {
    const lote = ids.slice(i, i + IDS_POR_LOTE);
    for (let ini = 0; ; ini += LINHAS_POR_PAGINA) {
      const { data, error } = await supabase
        .from("proposta_followups")
        .select("proposta_id, created_at")
        .in("proposta_id", lote)
        .eq("tipo", "banco")
        .order("proposta_id")
        .range(ini, ini + LINHAS_POR_PAGINA - 1);
      if (error) throw new Error(error.message);
      const linhas = (data ?? []) as any[];
      for (const l of linhas) {
        const atual = porProposta.get(l.proposta_id);
        if (!atual || new Date(l.created_at) > new Date(atual)) {
          porProposta.set(l.proposta_id, l.created_at);
        }
      }
      if (linhas.length < LINHAS_POR_PAGINA) break;
    }
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
): Promise<Map<string, SituacaoDocumentacao | null>> {
  const resultado = new Map<string, SituacaoDocumentacao | null>();
  if (propostas.length === 0) return resultado;
  const ids = propostas.map((p) => p.id);
  let docs = new Map<string, DocumentoHomefinLinha[]>();
  let comentarios = new Map<string, string>();
  try {
    [docs, comentarios] = await Promise.all([
      documentosDasPropostas(supabase, ids),
      // Sem os comentários o selo ainda sai, só não pisca por causa deles.
      ultimoComentarioDoBanco(supabase, ids).catch((e) => {
        console.error("[documentacao] leitura dos comentários do banco falhou", e);
        return new Map<string, string>();
      }),
    ]);
  } catch (e) {
    console.error("[documentacao] leitura dos documentos falhou", e);
  }
  for (const p of propostas) {
    resultado.set(
      p.id,
      situacaoDocumentacao(p.status, docs.get(p.id), comentarios.get(p.id) ?? null),
    );
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

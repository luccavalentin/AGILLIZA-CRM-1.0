/**
 * Leitura da forma de resposta da API HomeFin.
 *
 * Módulo puro, sem dependência de servidor, para poder ser coberto por teste.
 *
 * O `GET /oportunidade/{id}` devolve a oportunidade dentro de um envelope:
 *
 *   { "oportunidade": { ..., "simulacoes": [...] }, "etapa": ... }
 *
 * A reconciliação lia `resp.simulacoes` — que nesse nível não existe. O
 * resultado era sempre uma lista vazia e NENHUM banco assíncrono era
 * reconciliado: a simulação ficava em "Em análise" para sempre, mesmo com a
 * parcela já disponível na HomeFin.
 */

/** As simulações de uma oportunidade, com ou sem o envelope `oportunidade`. */
export function simulacoesDaOportunidade(resp: any): any[] {
  const doEnvelope = resp?.oportunidade?.simulacoes;
  if (Array.isArray(doEnvelope)) return doEnvelope;
  const daRaiz = resp?.simulacoes;
  if (Array.isArray(daRaiz)) return daRaiz;
  return [];
}

/** Acha a simulação de um banco pelo id devolvido no POST /simulacao. */
export function acharSimulacaoBanco(resp: any, idSimulacaoBanco: string | number | null): any | null {
  if (idSimulacaoBanco === null || idSimulacaoBanco === undefined) return null;
  const alvo = String(idSimulacaoBanco);
  return (
    simulacoesDaOportunidade(resp).find((s: any) => String(s?.idSimulacao) === alvo) ?? null
  );
}

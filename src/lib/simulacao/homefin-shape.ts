/**
 * Leitura da forma de resposta da API HomeFin.
 *
 * Módulo puro, sem dependência de servidor, para poder ser coberto por teste.
 *
 * O `GET /oportunidade/{id}` devolve a oportunidade dentro de um envelope
 * (contrato `GetOpportunityOk` do Swagger 1.0.1):
 *
 *   { "oportunidade": { ..., "simulacoes": [...] }, "etapa": [...] }
 *
 * A reconciliação lia `resp.simulacoes` — que nesse nível não existe. O
 * resultado era sempre uma lista vazia e NENHUM banco assíncrono era
 * reconciliado: a simulação ficava em "Em análise" para sempre, mesmo com a
 * parcela já disponível na HomeFin.
 *
 * As funções aceitam as duas formas de propósito. O contrato diz envelope, mas
 * ler a raiz como alternativa custa uma linha e evita que uma mudança de forma
 * do provedor volte a travar o fluxo silenciosamente.
 */

/** As simulações de uma oportunidade, com ou sem o envelope `oportunidade`. */
export function simulacoesDaOportunidade(resp: any): any[] {
  const doEnvelope = resp?.oportunidade?.simulacoes;
  if (Array.isArray(doEnvelope)) return doEnvelope;
  const daRaiz = resp?.simulacoes;
  if (Array.isArray(daRaiz)) return daRaiz;
  return [];
}

/**
 * Acha a simulação de um banco pelo id devolvido no `POST /simulacao`.
 *
 * A comparação é por texto porque a API devolve `idSimulacao` numérico e nós
 * guardamos o id como texto — comparar com `===` cru nunca casava.
 */
export function acharSimulacaoBanco(
  resp: any,
  idSimulacaoBanco: string | number | null | undefined,
): any | null {
  if (idSimulacaoBanco === null || idSimulacaoBanco === undefined) return null;
  const alvo = String(idSimulacaoBanco);
  if (alvo === "") return null;
  return (
    simulacoesDaOportunidade(resp).find((s: any) => String(s?.idSimulacao) === alvo) ?? null
  );
}

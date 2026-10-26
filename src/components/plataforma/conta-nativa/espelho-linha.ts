/**
 * Para onde vai a ação de uma linha de simulação do Agilliza Tech (lista de conta ou de grupo):
 *  - já espelhada no Agilliza → direto para a cópia de lá;
 *  - senão, espelha pela conta DA PRÓPRIA LINHA (`_licenca`; na visão de uma conta, a conta dela);
 *  - sem conta conhecida → nenhuma ação (nunca espelha "no escuro" numa conta errada).
 */
export type DestinoDaLinha =
  | { tipo: "direto"; id: string }
  | { tipo: "espelhar"; licenca: string; simulacaoId: string }
  | { tipo: "nenhum" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LinhaDeConta {
  id: string;
  _licenca?: string | null;
  _simulacao_agilliza_id?: string | null;
  _conta?: string | null;
}

export function destinoDaLinha(
  linha: LinhaDeConta | null | undefined,
  /** Visão de UMA conta: a conta da tela vale para as linhas sem `_licenca`. */
  contaDaTela: string | null = null,
): DestinoDaLinha {
  if (!linha || !UUID.test(linha.id ?? "")) return { tipo: "nenhum" };
  if (linha._simulacao_agilliza_id && UUID.test(linha._simulacao_agilliza_id)) {
    return { tipo: "direto", id: linha._simulacao_agilliza_id };
  }
  const licenca = linha._licenca ?? contaDaTela;
  if (!licenca || !UUID.test(licenca)) return { tipo: "nenhum" };
  return { tipo: "espelhar", licenca, simulacaoId: linha.id };
}

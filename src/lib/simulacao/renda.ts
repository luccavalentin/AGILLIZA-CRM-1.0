/**
 * Regra de renda mínima do financiamento habitacional (vigente em 2026).
 *
 * Bancos e a regra do SFH limitam o comprometimento de renda: o valor da
 * parcela não pode ultrapassar ~30% da renda familiar bruta mensal. Portanto,
 * a renda mínima exigida para um determinado valor de crédito é derivada da
 * primeira (maior) parcela do financiamento:
 *
 *   renda_minima = primeira_parcela / 0,30
 *
 * As APIs dos bancos aplicam o mesmo teto ao aprovar/reprovar a operação.
 */

import { calcularSimulacao, type SistemaAmortizacao } from "./simulacao-rapida";

/** Percentual máximo da renda que pode ser comprometido com a parcela. */
export const COMPROMETIMENTO_MAX = 0.3;

export interface AvaliacaoRenda {
  /** Primeira (maior) parcela estimada. */
  primeiraParcela: number;
  /** Renda familiar mensal mínima exigida para o valor informado. */
  rendaMinima: number;
  /** Percentual da renda informada comprometido com a parcela (0-1) ou null. */
  comprometimento: number | null;
  /** true = renda suficiente, false = insuficiente, null = renda não informada. */
  suficiente: boolean | null;
}

/** Renda mínima a partir de uma parcela conhecida. */
export function rendaMinimaParaParcela(
  primeiraParcela: number,
  comprometimentoMax: number = COMPROMETIMENTO_MAX,
): number {
  if (!Number.isFinite(primeiraParcela) || primeiraParcela <= 0) return 0;
  return primeiraParcela / comprometimentoMax;
}

/**
 * Avalia a renda mínima exigida para o valor de financiamento informado e,
 * se a renda for informada, indica se está dentro do exigido.
 */
export function avaliarRendaMinima(params: {
  valor_financiamento: number;
  prazo_meses: number;
  taxa_ano: number;
  sistema: SistemaAmortizacao;
  renda_informada?: number | null;
}): AvaliacaoRenda | null {
  const { valor_financiamento, prazo_meses, taxa_ano, sistema, renda_informada } = params;
  if (
    !Number.isFinite(valor_financiamento) ||
    valor_financiamento <= 0 ||
    !Number.isFinite(prazo_meses) ||
    prazo_meses <= 0
  ) {
    return null;
  }

  const { primeira_parcela } = calcularSimulacao({
    valor_financiamento,
    prazo_meses,
    taxa_ano,
    sistema,
  });

  const rendaMinima = rendaMinimaParaParcela(primeira_parcela);
  const renda = renda_informada && renda_informada > 0 ? renda_informada : null;

  return {
    primeiraParcela: primeira_parcela,
    rendaMinima,
    comprometimento: renda ? primeira_parcela / renda : null,
    suficiente: renda == null ? null : renda >= rendaMinima,
  };
}

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

/**
 * Encargos mensais obrigatórios que os bancos SOMAM à parcela ao verificar o
 * comprometimento de renda (estimativas de mercado):
 *  - Seguro MIP (morte/invalidez): incide sobre o saldo devedor.
 *  - Seguro DFI (danos ao imóvel): incide sobre o valor do imóvel.
 *  - Taxa de administração mensal fixa.
 * A parcela "seca" (amortização + juros) subestima a renda exigida; os bancos
 * qualificam a renda contra a PRESTAÇÃO TOTAL, com estes encargos incluídos.
 */
export const TAXA_MIP_MES = 0.00028; // ~0,028% do saldo devedor/mês
export const TAXA_DFI_MES = 0.0001; // ~0,010% do valor do imóvel/mês
export const TAXA_ADMIN_MES = 25; // R$/mês


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
 * Avalia a renda mínima necessária para financiar o imóvel informado.
 *
 * A parcela — e, portanto, a renda mínima — incide SOBRE O VALOR FINANCIADO
 * (preço do imóvel menos entrada + FGTS), nunca sobre o valor cheio do imóvel.
 * Usar o valor do imóvel como base superestima a parcela e a renda exigida.
 *
 * O valor do imóvel é usado apenas como fallback quando o valor financiado
 * não foi informado, pois não há como calcular a parcela sem uma base de crédito.
 */
export function avaliarRendaMinima(params: {
  valor_financiamento: number;
  prazo_meses: number;
  taxa_ano: number;
  sistema: SistemaAmortizacao;
  renda_informada?: number | null;
  /** Valor do imóvel — usado apenas como fallback se não houver valor financiado. */
  valor_imovel?: number | null;
}): AvaliacaoRenda | null {
  const { valor_financiamento, prazo_meses, taxa_ano, sistema, renda_informada, valor_imovel } =
    params;

  // Base do cálculo: valor financiado (correto). Cai para o valor do imóvel
  // apenas quando o financiado não foi informado.
  const base =
    Number.isFinite(valor_financiamento) && valor_financiamento > 0
      ? valor_financiamento
      : Number.isFinite(valor_imovel) && (valor_imovel ?? 0) > 0
        ? (valor_imovel as number)
        : 0;

  if (
    !Number.isFinite(base) ||
    base <= 0 ||
    !Number.isFinite(prazo_meses) ||
    prazo_meses <= 0
  ) {
    return null;
  }

  const { primeira_parcela } = calcularSimulacao({
    valor_financiamento: base,
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

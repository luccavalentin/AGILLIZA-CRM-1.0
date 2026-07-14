/**
 * Cálculo local de simulação (Simulação Rápida) — sem chamada ao provedor.
 * Estimativa por SAC e PRICE. Módulo puro (client + server safe).
 * As taxas são estimativas de mercado por banco e servem apenas para
 * a simulação rápida; a simulação personalizada usa os valores reais do banco.
 */

export type SistemaAmortizacao = "S" | "P"; // SAC | PRICE

export interface BancoTaxaRef {
  banco_id: string;
  codigo_banco: number;
  nome_banco: string;
  /** taxa anual efetiva estimada (ex.: 0.1149 = 11,49% a.a.) */
  taxa_ano: number;
}

/**
 * Taxas anuais de referência por código COMPE — fallback quando não há
 * histórico recente de simulação no banco. Valores calibrados pela média
 * observada nos últimos retornos reais dos bancos (2025-2026).
 */
const TAXA_PADRAO_ANO: Record<number, number> = {
  237: 0.1265, // Bradesco  — média real ~12,65% a.a.
  33: 0.1255, // Santander  — média real ~12,55% a.a.
  341: 0.1325, // Itaú       — média real ~13,25% a.a.
  77: 0.1199, // Inter
  104: 0.1189, // Caixa
};

export function taxaAnoDeBanco(
  codigo_banco: number,
  override?: Record<number, number> | null,
): number {
  const dinamica = override?.[codigo_banco];
  if (dinamica != null && dinamica > 0) return dinamica;
  return TAXA_PADRAO_ANO[codigo_banco] ?? 0.1299;
}


export interface EntradaCalculo {
  valor_financiamento: number;
  prazo_meses: number;
  taxa_ano: number;
  sistema: SistemaAmortizacao;
}

export interface ResultadoCalculo {
  primeira_parcela: number;
  ultima_parcela: number;
  parcela_media: number;
  total_pago: number;
  total_juros: number;
  taxa_mes: number;
}

function taxaMensal(taxaAno: number): number {
  return Math.pow(1 + taxaAno, 1 / 12) - 1;
}

export function calcularSimulacao({
  valor_financiamento,
  prazo_meses,
  taxa_ano,
  sistema,
}: EntradaCalculo): ResultadoCalculo {
  const i = taxaMensal(taxa_ano);
  const n = Math.max(1, Math.round(prazo_meses));
  const pv = Math.max(0, valor_financiamento);

  if (sistema === "P") {
    // PRICE: parcela fixa
    const fator = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    const parcela = pv * fator;
    const total = parcela * n;
    return {
      primeira_parcela: parcela,
      ultima_parcela: parcela,
      parcela_media: parcela,
      total_pago: total,
      total_juros: total - pv,
      taxa_mes: i,
    };
  }

  // SAC: amortização constante, juros decrescentes
  const amort = pv / n;
  let saldo = pv;
  let total = 0;
  let primeira = 0;
  let ultima = 0;
  for (let k = 0; k < n; k++) {
    const juros = saldo * i;
    const parcela = amort + juros;
    if (k === 0) primeira = parcela;
    if (k === n - 1) ultima = parcela;
    total += parcela;
    saldo -= amort;
  }
  return {
    primeira_parcela: primeira,
    ultima_parcela: ultima,
    parcela_media: total / n,
    total_pago: total,
    total_juros: total - pv,
    taxa_mes: i,
  };
}

export interface ComparativoBancoRapido extends BancoTaxaRef {
  resultado: ResultadoCalculo;
}

export function compararBancosRapido(
  bancos: BancoTaxaRef[],
  base: { valor_financiamento: number; prazo_meses: number; sistema: SistemaAmortizacao },
): ComparativoBancoRapido[] {
  return bancos
    .map((b) => ({
      ...b,
      resultado: calcularSimulacao({
        valor_financiamento: base.valor_financiamento,
        prazo_meses: base.prazo_meses,
        taxa_ano: b.taxa_ano,
        sistema: base.sistema,
      }),
    }))
    .sort((a, b) => a.resultado.primeira_parcela - b.resultado.primeira_parcela);
}

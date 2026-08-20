/**
 * Cálculos automáticos da folha (regras CLT).
 * Tabelas vigentes 2025 — INSS progressivo, IRRF com dedução por dependente
 * e FGTS informativo (não é descontado do empregado).
 */

// INSS 2025 — progressivo, teto de contribuição R$ 8.157,41
const INSS_FAIXAS: Array<{ ate: number; aliquota: number }> = [
  { ate: 1518.0, aliquota: 0.075 },
  { ate: 2793.88, aliquota: 0.09 },
  { ate: 4190.83, aliquota: 0.12 },
  { ate: 8157.41, aliquota: 0.14 },
];
const INSS_TETO_BASE = 8157.41;

// IRRF 2025 — a partir de maio/2025
const IRRF_TABELA: Array<{ ate: number; aliquota: number; deducao: number }> = [
  { ate: 2428.8, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
];
export const IRRF_DEP = 189.59;

export interface CalculoCLT {
  inss: number;
  aliquota_efetiva_inss: number;
  base_irrf: number;
  irrf: number;
  aliquota_efetiva_irrf: number;
  fgts: number; // depósito do empregador (não desconta)
}

/** INSS progressivo por faixas. */
export function calcularINSS(bruto: number): { valor: number; aliquotaEfetiva: number } {
  const base = Math.min(bruto, INSS_TETO_BASE);
  let inss = 0;
  let anterior = 0;
  for (const f of INSS_FAIXAS) {
    if (base <= anterior) break;
    const teto = Math.min(base, f.ate);
    inss += (teto - anterior) * f.aliquota;
    anterior = f.ate;
    if (base <= f.ate) break;
  }
  const valor = round2(inss);
  const aliquotaEfetiva = bruto > 0 ? valor / bruto : 0;
  return { valor, aliquotaEfetiva };
}

/** IRRF a partir da base (bruto − INSS − dependentes × dedução − pensão). */
export function calcularIRRF(baseIRRF: number): { valor: number; aliquotaEfetiva: number } {
  if (baseIRRF <= 0) return { valor: 0, aliquotaEfetiva: 0 };
  const faixa = IRRF_TABELA.find((f) => baseIRRF <= f.ate)!;
  const valor = round2(Math.max(0, baseIRRF * faixa.aliquota - faixa.deducao));
  const aliquotaEfetiva = baseIRRF > 0 ? valor / baseIRRF : 0;
  return { valor, aliquotaEfetiva };
}

/**
 * Cálculo consolidado (INSS + IRRF + FGTS) para uma remuneração bruta CLT.
 * @param bruto  salário base + proventos tributáveis
 * @param dependentesIR quantidade de dependentes para IR
 * @param pensao pensão alimentícia (deduz da base IRRF)
 */
export function calcularCLT(bruto: number, dependentesIR = 0, pensao = 0): CalculoCLT {
  const { valor: inss, aliquotaEfetiva: aliqInss } = calcularINSS(bruto);
  const baseIRRF = Math.max(0, bruto - inss - dependentesIR * IRRF_DEP - pensao);
  const { valor: irrf, aliquotaEfetiva: aliqIrrf } = calcularIRRF(baseIRRF);
  const fgts = round2(bruto * 0.08);
  return {
    inss,
    aliquota_efetiva_inss: aliqInss,
    base_irrf: round2(baseIRRF),
    irrf,
    aliquota_efetiva_irrf: aliqIrrf,
    fgts,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

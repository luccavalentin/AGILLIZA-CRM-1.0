/**
 * Tabelas e cálculos da folha CLT, por vigência.
 *
 * A competência escolhe a tabela: um holerite de 2025 continua calculado como
 * em 2025 e o de 2026 usa as regras de 2026. Fontes:
 *  - INSS 2026, salário mínimo e salário-família: Portaria Interministerial
 *    MPS/MF nº 13, de 09/01/2026.
 *  - IRRF: tabela progressiva mensal vigente desde maio/2025, desconto
 *    simplificado mensal (R$ 607,20) e, a partir de jan/2026, a redução da
 *    Lei 15.270/2025 (isenção efetiva até R$ 5.000; redução decrescente até
 *    R$ 7.350).
 * FGTS é informativo (depósito do empregador, não desconta do empregado).
 */

export interface Competencia {
  ano: number;
  mes: number;
}

interface Vigencia {
  /** Primeira competência (ano*100+mês) em que a tabela vale. */
  desde: number;
  salarioMinimo: number;
  inss: Array<{ ate: number; aliquota: number }>;
  salarioFamilia: { quota: number; teto: number };
  /** Redução da Lei 15.270/2025 (null antes de 2026). */
  reducaoIr: { isencaoAte: number; reducaoMaxima: number; ate: number; a: number; b: number } | null;
}

const VIGENCIAS: Vigencia[] = [
  {
    desde: 202501,
    salarioMinimo: 1518,
    inss: [
      { ate: 1518.0, aliquota: 0.075 },
      { ate: 2793.88, aliquota: 0.09 },
      { ate: 4190.83, aliquota: 0.12 },
      { ate: 8157.41, aliquota: 0.14 },
    ],
    salarioFamilia: { quota: 65.0, teto: 1906.04 },
    reducaoIr: null,
  },
  {
    desde: 202601,
    salarioMinimo: 1621,
    inss: [
      { ate: 1621.0, aliquota: 0.075 },
      { ate: 2902.84, aliquota: 0.09 },
      { ate: 4354.27, aliquota: 0.12 },
      { ate: 8475.55, aliquota: 0.14 },
    ],
    salarioFamilia: { quota: 67.54, teto: 1980.38 },
    reducaoIr: { isencaoAte: 5000, reducaoMaxima: 312.89, ate: 7350, a: 978.62, b: 0.133145 },
  },
];

// IRRF — tabela progressiva mensal vigente desde maio/2025.
const IRRF_TABELA: Array<{ ate: number; aliquota: number; deducao: number }> = [
  { ate: 2428.8, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
];
export const IRRF_DEP = 189.59;
/** Desconto simplificado mensal: substitui as deduções legais quando é maior. */
export const IRRF_DESCONTO_SIMPLIFICADO = 607.2;

function hoje(): Competencia {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

/** Tabela vigente na competência (a mais recente com `desde` ≤ competência). */
export function vigencia(c: Competencia = hoje()): Vigencia {
  const chave = c.ano * 100 + c.mes;
  return [...VIGENCIAS].reverse().find((v) => v.desde <= chave) ?? VIGENCIAS[0];
}

export const salarioMinimo = (c?: Competencia) => vigencia(c).salarioMinimo;
export const salarioFamilia = (c?: Competencia) => vigencia(c).salarioFamilia;

/** INSS progressivo por faixas, limitado ao teto da vigência. */
export function calcularINSS(
  bruto: number,
  c?: Competencia,
): { valor: number; aliquotaEfetiva: number } {
  const faixas = vigencia(c).inss;
  const base = Math.min(Math.max(0, bruto), faixas[faixas.length - 1].ate);
  let inss = 0;
  let anterior = 0;
  for (const f of faixas) {
    if (base <= anterior) break;
    inss += (Math.min(base, f.ate) - anterior) * f.aliquota;
    anterior = f.ate;
  }
  const valor = round2(inss);
  return { valor, aliquotaEfetiva: bruto > 0 ? valor / bruto : 0 };
}

/** Imposto da tabela progressiva sobre uma base já deduzida. */
function impostoDaTabela(base: number): number {
  if (base <= 0) return 0;
  const faixa = IRRF_TABELA.find((f) => base <= f.ate)!;
  return Math.max(0, base * faixa.aliquota - faixa.deducao);
}

export interface EntradaIRRF {
  /** Rendimento tributável bruto do mês (antes do INSS). */
  rendimento: number;
  inss: number;
  dependentes?: number;
  pensao?: number;
  competencia?: Competencia;
}

/**
 * IRRF mensal: base pelo maior entre deduções legais (INSS + dependentes +
 * pensão) e o desconto simplificado; depois, a redução da Lei 15.270/2025
 * calculada sobre o rendimento bruto, sem deixar o imposto negativo.
 */
export function calcularIRRFMensal(e: EntradaIRRF): { valor: number; base: number; reducao: number } {
  const legais = e.inss + (e.dependentes ?? 0) * IRRF_DEP + (e.pensao ?? 0);
  const base = round2(Math.max(0, e.rendimento - Math.max(legais, IRRF_DESCONTO_SIMPLIFICADO)));
  const imposto = impostoDaTabela(base);
  const r = vigencia(e.competencia).reducaoIr;
  let reducao = 0;
  if (r && e.rendimento <= r.isencaoAte) reducao = Math.min(imposto, r.reducaoMaxima);
  else if (r && e.rendimento <= r.ate) reducao = Math.max(0, r.a - r.b * e.rendimento);
  reducao = Math.min(imposto, reducao);
  return { valor: round2(imposto - reducao), base, reducao: round2(reducao) };
}

export interface CalculoCLT {
  inss: number;
  aliquota_efetiva_inss: number;
  base_irrf: number;
  irrf: number;
  aliquota_efetiva_irrf: number;
  fgts: number; // depósito do empregador (não desconta)
}

/** INSS + IRRF + FGTS de uma remuneração bruta CLT na competência. */
export function calcularCLT(bruto: number, dependentesIR = 0, pensao = 0, c?: Competencia): CalculoCLT {
  const { valor: inss, aliquotaEfetiva } = calcularINSS(bruto, c);
  const ir = calcularIRRFMensal({ rendimento: bruto, inss, dependentes: dependentesIR, pensao, competencia: c });
  return {
    inss,
    aliquota_efetiva_inss: aliquotaEfetiva,
    base_irrf: ir.base,
    irrf: ir.valor,
    aliquota_efetiva_irrf: ir.base > 0 ? ir.valor / ir.base : 0,
    fgts: round2(bruto * 0.08),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

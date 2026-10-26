/**
 * Cálculos da folha CLT (INSS, IRRF, FGTS) sobre uma tabela fiscal.
 *
 * Nenhum número de lei mora aqui: as faixas, o salário mínimo, o salário-família, a
 * dedução por dependente, o desconto simplificado e a redução da Lei 15.270/2025 vêm de
 * `rh_tabelas_fiscais` (padrão do sistema + vigências próprias do correspondente,
 * editáveis em RH › Configurações › Tabelas da folha). A competência escolhe a vigência:
 * um holerite de 2025 continua calculado como em 2025.
 * FGTS é informativo (depósito do empregador, não desconta do empregado).
 */

export interface Competencia {
  ano: number;
  mes: number;
}

export interface FaixaINSS {
  ate: number;
  aliquota: number;
}

export interface FaixaIRRF {
  /** null = última faixa, sem limite. */
  ate: number | null;
  aliquota: number;
  deducao: number;
}

export interface ReducaoIRRF {
  isencao_ate: number;
  reducao_maxima: number;
  ate: number;
  a: number;
  b: number;
}

/** Uma vigência de `rh_tabelas_fiscais`. */
export interface TabelaFiscal {
  id?: string;
  /** null = padrão do sistema. */
  correspondente_id?: string | null;
  /** Primeiro dia do mês em que passa a valer (yyyy-mm-01). */
  vigencia_desde: string;
  salario_minimo: number;
  inss_faixas: FaixaINSS[];
  irrf_faixas: FaixaIRRF[];
  irrf_dependente: number;
  irrf_desconto_simplificado: number;
  irrf_reducao: ReducaoIRRF | null;
  salario_familia_quota: number;
  salario_familia_teto: number;
  fgts_aliquota: number;
  fonte?: string | null;
}

const chave = (c: Competencia) => c.ano * 100 + c.mes;
const chaveVigencia = (iso: string) => Number(iso.slice(0, 4)) * 100 + Number(iso.slice(5, 7));

/**
 * Vigência que vale na competência: a mais recente com início até ela. Na mesma data, a
 * própria do correspondente vence a padrão do sistema. `null` se nenhuma alcança.
 */
export function tabelaVigente(tabelas: TabelaFiscal[], c: Competencia): TabelaFiscal | null {
  const alvo = chave(c);
  const candidatas = tabelas
    .filter((t) => chaveVigencia(t.vigencia_desde) <= alvo)
    .sort((a, b) => {
      const d = chaveVigencia(b.vigencia_desde) - chaveVigencia(a.vigencia_desde);
      if (d !== 0) return d;
      return (b.correspondente_id ? 1 : 0) - (a.correspondente_id ? 1 : 0);
    });
  return candidatas[0] ?? null;
}

/** Normaliza a linha do banco (numeric chega como texto). */
export function normalizarTabelaFiscal(r: Record<string, unknown>): TabelaFiscal {
  const n = (v: unknown) => Number(v ?? 0);
  const inss = (Array.isArray(r.inss_faixas) ? r.inss_faixas : []) as Array<Record<string, unknown>>;
  const irrf = (Array.isArray(r.irrf_faixas) ? r.irrf_faixas : []) as Array<Record<string, unknown>>;
  const red = r.irrf_reducao as Record<string, unknown> | null | undefined;
  return {
    id: r.id as string | undefined,
    correspondente_id: (r.correspondente_id as string | null | undefined) ?? null,
    vigencia_desde: String(r.vigencia_desde).slice(0, 10),
    salario_minimo: n(r.salario_minimo),
    inss_faixas: inss.map((f) => ({ ate: n(f.ate), aliquota: n(f.aliquota) })),
    irrf_faixas: irrf.map((f) => ({
      ate: f.ate == null ? null : n(f.ate),
      aliquota: n(f.aliquota),
      deducao: n(f.deducao),
    })),
    irrf_dependente: n(r.irrf_dependente),
    irrf_desconto_simplificado: n(r.irrf_desconto_simplificado),
    irrf_reducao: red
      ? {
          isencao_ate: n(red.isencao_ate),
          reducao_maxima: n(red.reducao_maxima),
          ate: n(red.ate),
          a: n(red.a),
          b: n(red.b),
        }
      : null,
    salario_familia_quota: n(r.salario_familia_quota),
    salario_familia_teto: n(r.salario_familia_teto),
    fgts_aliquota: r.fgts_aliquota == null ? 0.08 : n(r.fgts_aliquota),
    fonte: (r.fonte as string | null | undefined) ?? null,
  };
}

/** INSS progressivo por faixas, limitado ao teto da tabela. */
export function calcularINSS(
  bruto: number,
  t: TabelaFiscal,
): { valor: number; aliquotaEfetiva: number } {
  const faixas = t.inss_faixas;
  if (faixas.length === 0) return { valor: 0, aliquotaEfetiva: 0 };
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
function impostoDaTabela(base: number, t: TabelaFiscal): number {
  if (base <= 0) return 0;
  const faixa = t.irrf_faixas.find((f) => f.ate == null || base <= f.ate);
  if (!faixa) return 0;
  return Math.max(0, base * faixa.aliquota - faixa.deducao);
}

export interface EntradaIRRF {
  /** Rendimento tributável bruto do mês (antes do INSS). */
  rendimento: number;
  inss: number;
  dependentes?: number;
  pensao?: number;
}

/**
 * IRRF mensal: base pelo maior entre deduções legais (INSS + dependentes + pensão) e o
 * desconto simplificado; depois, a redução (Lei 15.270/2025, quando a tabela tiver)
 * calculada sobre o rendimento bruto, sem deixar o imposto negativo.
 */
export function calcularIRRFMensal(
  e: EntradaIRRF,
  t: TabelaFiscal,
): { valor: number; base: number; reducao: number } {
  const legais = e.inss + (e.dependentes ?? 0) * t.irrf_dependente + (e.pensao ?? 0);
  const base = round2(Math.max(0, e.rendimento - Math.max(legais, t.irrf_desconto_simplificado)));
  const imposto = impostoDaTabela(base, t);
  const r = t.irrf_reducao;
  let reducao = 0;
  if (r && e.rendimento <= r.isencao_ate) reducao = Math.min(imposto, r.reducao_maxima);
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

/** INSS + IRRF + FGTS de uma remuneração bruta CLT. */
export function calcularCLT(bruto: number, t: TabelaFiscal, dependentesIR = 0, pensao = 0): CalculoCLT {
  const { valor: inss, aliquotaEfetiva } = calcularINSS(bruto, t);
  const ir = calcularIRRFMensal({ rendimento: bruto, inss, dependentes: dependentesIR, pensao }, t);
  return {
    inss,
    aliquota_efetiva_inss: aliquotaEfetiva,
    base_irrf: ir.base,
    irrf: ir.valor,
    aliquota_efetiva_irrf: ir.base > 0 ? ir.valor / ir.base : 0,
    fgts: round2(bruto * t.fgts_aliquota),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

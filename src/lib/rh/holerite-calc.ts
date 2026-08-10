/**
 * Motor de cálculo do holerite (recibo de pagamento) conforme a CLT.
 *
 * Regras aplicadas:
 * - Jornada mensal padrão de 220 h (valor-hora = salário ÷ 220).
 * - Horas extras 50% / 100% e adicional noturno 20% (art. 73 CLT).
 * - Insalubridade sobre o salário mínimo (10/20/40%) e periculosidade 30%
 *   sobre o salário base (art. 192 e 193 CLT).
 * - Faltas injustificadas descontam 1/30 avos + DSR correspondente.
 * - Vale-transporte: desconto limitado a 6% do salário base (Lei 7.418/85).
 * - INSS progressivo, IRRF com dedução por dependente e pensão alimentícia.
 * - FGTS 8% (depósito do empregador — não desconta do empregado).
 */
import { calcularINSS, calcularIRRF, IRRF_DEP } from "@/lib/rh/clt";

export const JORNADA_MENSAL_PADRAO = 220;
export const SALARIO_MINIMO = 1518;
/** Quota do salário-família 2025 e teto de remuneração para ter direito. */
export const SALARIO_FAMILIA_QUOTA = 65;
export const SALARIO_FAMILIA_TETO = 1819.26;

export interface HoleriteEntrada {
  salario_base: number;
  jornada_mensal: number;
  dias_trabalhados: number; // base 30
  faltas_dias: number;
  dsr_perdidos: number;
  horas_extras_50: number;
  horas_extras_100: number;
  horas_noturnas: number;
  adicional_noturno_pct: number; // 20 por padrão
  insalubridade_pct: number; // 0 | 10 | 20 | 40
  periculosidade: boolean; // 30% do salário base
  comissoes: number;
  bonificacoes: number;
  ferias_valor: number;
  decimo_terceiro: number;
  outros_proventos: number;
  outros_proventos_desc: string;

  // Descontos
  desconta_vt: boolean;
  vt_valor_passagens: number; // custo real; desconto = min(6% salário, custo)
  desconta_vr: boolean;
  vr_desconto: number;
  desconta_va: boolean;
  va_desconto: number;
  plano_saude: number;
  plano_odonto: number;
  adiantamento: number;
  emprestimo_consignado: number;
  contribuicao_sindical: number;
  pensao_alimenticia: number;
  outros_descontos: number;
  outros_descontos_desc: string;

  dependentes_ir: number;
  filhos_salario_familia: number;
}

export const ENTRADA_PADRAO: HoleriteEntrada = {
  salario_base: 0,
  jornada_mensal: JORNADA_MENSAL_PADRAO,
  dias_trabalhados: 30,
  faltas_dias: 0,
  dsr_perdidos: 0,
  horas_extras_50: 0,
  horas_extras_100: 0,
  horas_noturnas: 0,
  adicional_noturno_pct: 20,
  insalubridade_pct: 0,
  periculosidade: false,
  comissoes: 0,
  bonificacoes: 0,
  ferias_valor: 0,
  decimo_terceiro: 0,
  outros_proventos: 0,
  outros_proventos_desc: "Outros proventos",
  desconta_vt: false,
  vt_valor_passagens: 0,
  desconta_vr: false,
  vr_desconto: 0,
  desconta_va: false,
  va_desconto: 0,
  plano_saude: 0,
  plano_odonto: 0,
  adiantamento: 0,
  emprestimo_consignado: 0,
  contribuicao_sindical: 0,
  pensao_alimenticia: 0,
  outros_descontos: 0,
  outros_descontos_desc: "Outros descontos",
  dependentes_ir: 0,
  filhos_salario_familia: 0,
};

export interface LinhaHolerite {
  codigo: string;
  descricao: string;
  referencia: string;
  valor: number;
}

export interface HoleriteResultado {
  proventos: LinhaHolerite[];
  descontos: LinhaHolerite[];
  total_proventos: number;
  total_descontos: number;
  liquido: number;
  base_inss: number;
  inss: number;
  base_irrf: number;
  irrf: number;
  base_fgts: number;
  fgts: number;
  valor_hora: number;
  valor_dia: number;
}

function r2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function num(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** Calcula o holerite completo a partir das entradas informadas pelo DP. */
export function calcularHolerite(e: HoleriteEntrada): HoleriteResultado {
  const salario = num(e.salario_base);
  const jornada = num(e.jornada_mensal) || JORNADA_MENSAL_PADRAO;
  const valorHora = salario > 0 ? salario / jornada : 0;
  const valorDia = salario / 30;

  const proventos: LinhaHolerite[] = [];
  const descontos: LinhaHolerite[] = [];

  // ---- Proventos --------------------------------------------------------
  const diasPagos = Math.max(0, Math.min(30, num(e.dias_trabalhados)));
  const salarioProporcional = r2(valorDia * diasPagos);
  proventos.push({
    codigo: "001",
    descricao: "Salário base",
    referencia: `${diasPagos.toFixed(0)} dias`,
    valor: salarioProporcional,
  });

  const he50 = r2(num(e.horas_extras_50) * valorHora * 1.5);
  if (he50 > 0) {
    proventos.push({
      codigo: "010",
      descricao: "Horas extras 50%",
      referencia: `${num(e.horas_extras_50).toFixed(2)} h`,
      valor: he50,
    });
  }
  const he100 = r2(num(e.horas_extras_100) * valorHora * 2);
  if (he100 > 0) {
    proventos.push({
      codigo: "011",
      descricao: "Horas extras 100%",
      referencia: `${num(e.horas_extras_100).toFixed(2)} h`,
      valor: he100,
    });
  }
  const adNoturno = r2(
    num(e.horas_noturnas) * valorHora * (num(e.adicional_noturno_pct) / 100),
  );
  if (adNoturno > 0) {
    proventos.push({
      codigo: "020",
      descricao: "Adicional noturno",
      referencia: `${num(e.horas_noturnas).toFixed(2)} h · ${num(e.adicional_noturno_pct)}%`,
      valor: adNoturno,
    });
  }
  const insal = r2(SALARIO_MINIMO * (num(e.insalubridade_pct) / 100));
  if (insal > 0) {
    proventos.push({
      codigo: "030",
      descricao: "Adicional de insalubridade",
      referencia: `${num(e.insalubridade_pct)}% do mínimo`,
      valor: insal,
    });
  }
  const peric = e.periculosidade ? r2(salario * 0.3) : 0;
  if (peric > 0) {
    proventos.push({
      codigo: "031",
      descricao: "Adicional de periculosidade",
      referencia: "30% do salário",
      valor: peric,
    });
  }
  const comissoes = r2(num(e.comissoes));
  if (comissoes > 0) {
    proventos.push({ codigo: "040", descricao: "Comissões", referencia: "—", valor: comissoes });
  }
  const bonif = r2(num(e.bonificacoes));
  if (bonif > 0) {
    proventos.push({ codigo: "041", descricao: "Bonificação / prêmio", referencia: "—", valor: bonif });
  }
  const ferias = r2(num(e.ferias_valor));
  if (ferias > 0) {
    proventos.push({ codigo: "050", descricao: "Férias + 1/3 constitucional", referencia: "—", valor: ferias });
  }
  const decimo = r2(num(e.decimo_terceiro));
  if (decimo > 0) {
    proventos.push({ codigo: "051", descricao: "13º salário", referencia: "—", valor: decimo });
  }
  const outrosProv = r2(num(e.outros_proventos));
  if (outrosProv > 0) {
    proventos.push({
      codigo: "090",
      descricao: e.outros_proventos_desc?.trim() || "Outros proventos",
      referencia: "—",
      valor: outrosProv,
    });
  }

  // Salário-família (não integra base de INSS/IRRF/FGTS).
  const temDireitoSF = salario > 0 && salario <= SALARIO_FAMILIA_TETO;
  const salarioFamilia =
    temDireitoSF && num(e.filhos_salario_familia) > 0
      ? r2(num(e.filhos_salario_familia) * SALARIO_FAMILIA_QUOTA)
      : 0;
  if (salarioFamilia > 0) {
    proventos.push({
      codigo: "060",
      descricao: "Salário-família",
      referencia: `${num(e.filhos_salario_familia)} cota(s)`,
      valor: salarioFamilia,
    });
  }

  // ---- Base de incidência ----------------------------------------------
  const baseIncidencia = r2(
    salarioProporcional + he50 + he100 + adNoturno + insal + peric + comissoes +
      bonif + ferias + decimo + outrosProv,
  );

  // ---- Descontos --------------------------------------------------------
  const faltas = r2(valorDia * num(e.faltas_dias));
  if (faltas > 0) {
    descontos.push({
      codigo: "101",
      descricao: "Faltas injustificadas",
      referencia: `${num(e.faltas_dias)} dia(s)`,
      valor: faltas,
    });
  }
  const dsr = r2(valorDia * num(e.dsr_perdidos));
  if (dsr > 0) {
    descontos.push({
      codigo: "102",
      descricao: "DSR sobre faltas",
      referencia: `${num(e.dsr_perdidos)} dia(s)`,
      valor: dsr,
    });
  }

  const { valor: inss } = calcularINSS(Math.max(0, baseIncidencia - faltas - dsr));
  const baseInss = r2(Math.max(0, baseIncidencia - faltas - dsr));
  if (inss > 0) {
    descontos.push({
      codigo: "110",
      descricao: "INSS",
      referencia: "tabela progressiva",
      valor: inss,
    });
  }

  const pensao = r2(num(e.pensao_alimenticia));
  const baseIrrf = r2(
    Math.max(0, baseInss - inss - num(e.dependentes_ir) * IRRF_DEP - pensao),
  );
  const { valor: irrf } = calcularIRRF(baseIrrf);
  if (irrf > 0) {
    descontos.push({
      codigo: "111",
      descricao: "IRRF",
      referencia:
        num(e.dependentes_ir) > 0 ? `${num(e.dependentes_ir)} dependente(s)` : "tabela mensal",
      valor: irrf,
    });
  }

  const vt = e.desconta_vt
    ? r2(Math.min(salario * 0.06, num(e.vt_valor_passagens) || salario * 0.06))
    : 0;
  if (vt > 0) {
    descontos.push({
      codigo: "120",
      descricao: "Vale-transporte",
      referencia: "limite 6%",
      valor: vt,
    });
  }
  const vr = e.desconta_vr ? r2(num(e.vr_desconto)) : 0;
  if (vr > 0) {
    descontos.push({ codigo: "121", descricao: "Vale-refeição", referencia: "coparticipação", valor: vr });
  }
  const va = e.desconta_va ? r2(num(e.va_desconto)) : 0;
  if (va > 0) {
    descontos.push({ codigo: "122", descricao: "Vale-alimentação", referencia: "coparticipação", valor: va });
  }
  const saude = r2(num(e.plano_saude));
  if (saude > 0) {
    descontos.push({ codigo: "130", descricao: "Plano de saúde", referencia: "—", valor: saude });
  }
  const odonto = r2(num(e.plano_odonto));
  if (odonto > 0) {
    descontos.push({ codigo: "131", descricao: "Plano odontológico", referencia: "—", valor: odonto });
  }
  const adiant = r2(num(e.adiantamento));
  if (adiant > 0) {
    descontos.push({ codigo: "140", descricao: "Adiantamento salarial", referencia: "—", valor: adiant });
  }
  const consig = r2(num(e.emprestimo_consignado));
  if (consig > 0) {
    descontos.push({ codigo: "141", descricao: "Empréstimo consignado", referencia: "—", valor: consig });
  }
  const sindical = r2(num(e.contribuicao_sindical));
  if (sindical > 0) {
    descontos.push({ codigo: "150", descricao: "Contribuição sindical", referencia: "—", valor: sindical });
  }
  if (pensao > 0) {
    descontos.push({ codigo: "151", descricao: "Pensão alimentícia", referencia: "—", valor: pensao });
  }
  const outrosDesc = r2(num(e.outros_descontos));
  if (outrosDesc > 0) {
    descontos.push({
      codigo: "190",
      descricao: e.outros_descontos_desc?.trim() || "Outros descontos",
      referencia: "—",
      valor: outrosDesc,
    });
  }

  const total_proventos = r2(
    proventos.reduce((s, l) => s + l.valor, 0),
  );
  const total_descontos = r2(descontos.reduce((s, l) => s + l.valor, 0));

  return {
    proventos,
    descontos,
    total_proventos,
    total_descontos,
    liquido: r2(total_proventos - total_descontos),
    base_inss: baseInss,
    inss,
    base_irrf: baseIrrf,
    irrf,
    base_fgts: baseInss,
    fgts: r2(baseInss * 0.08),
    valor_hora: r2(valorHora),
    valor_dia: r2(valorDia),
  };
}

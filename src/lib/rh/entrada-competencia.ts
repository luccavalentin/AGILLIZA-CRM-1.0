/**
 * Entrada do holerite de um funcionário numa competência, montada a partir do
 * que o DP lançou no sistema.
 *
 * É a única fonte da prévia da folha, da aba "Prévia da folha" da ficha, do
 * fechamento e do "Gerar holerite": antes cada tela montava a sua e o mesmo
 * funcionário saía com três líquidos diferentes no mesmo mês. Função pura —
 * quem busca os dados no banco é `folha.functions.ts`.
 */
import { ENTRADA_PADRAO, JORNADA_MENSAL_PADRAO, type HoleriteEntrada } from "@/lib/rh/holerite-calc";
import type { Competencia } from "@/lib/rh/clt";

/** Tipos de `rh_lancamentos` (o que entra na competência além de salário e benefícios). */
export type TipoLancamento =
  | "hora_extra_50"
  | "hora_extra_100"
  | "adicional_noturno"
  | "atraso"
  | "comissao"
  | "bonus"
  | "outro_provento"
  | "desconto"
  | "emprestimo_consignado"
  | "pensao_alimenticia"
  | "contribuicao_sindical";

/** Tipos medidos em horas (o motor converte pelo valor-hora). */
export const LANCAMENTO_EM_HORAS: ReadonlySet<TipoLancamento> = new Set([
  "hora_extra_50",
  "hora_extra_100",
  "adicional_noturno",
  "atraso",
]);

export const LANCAMENTO_LABEL: Record<TipoLancamento, string> = {
  hora_extra_50: "Horas extras 50%",
  hora_extra_100: "Horas extras 100%",
  adicional_noturno: "Adicional noturno (horas)",
  atraso: "Atraso (horas)",
  comissao: "Comissão",
  bonus: "Bônus / prêmio",
  outro_provento: "Outro provento",
  desconto: "Desconto",
  emprestimo_consignado: "Empréstimo consignado",
  pensao_alimenticia: "Pensão alimentícia",
  contribuicao_sindical: "Contribuição sindical",
};

/** Provento (soma) ou desconto (subtrai) — para a tela pintar o sinal certo. */
export const LANCAMENTO_NATUREZA: Record<TipoLancamento, "provento" | "desconto"> = {
  hora_extra_50: "provento",
  hora_extra_100: "provento",
  adicional_noturno: "provento",
  atraso: "desconto",
  comissao: "provento",
  bonus: "provento",
  outro_provento: "provento",
  desconto: "desconto",
  emprestimo_consignado: "desconto",
  pensao_alimenticia: "desconto",
  contribuicao_sindical: "desconto",
};

export interface DadosCompetencia {
  salarioAtual: number;
  /** Jornada semanal da ficha (44 h → 220 h/mês). Sem ela, 220 h. */
  jornadaSemanal?: number | null;
  alteracoesSalariais: Array<{ vigencia: string; salario_anterior: number | null; salario_novo: number }>;
  beneficios: Array<{
    nome: string;
    valor: number;
    desconto: number;
    vigencia_inicio: string | null;
    vigencia_fim: string | null;
  }>;
  /** Ocorrências do tipo falta (não abonadas são descontadas). */
  faltas: Array<{ data_inicio: string; data_fim: string | null; abonada: boolean }>;
  adiantamentos: number[];
  /** Lançamentos ativos da competência (`rh_lancamentos`). */
  lancamentos: Array<{ tipo: TipoLancamento; quantidade: number | null; valor: number; descricao?: string | null }>;
  dependentes: Array<{ ir: boolean; salario_familia: boolean; data_nascimento: string | null }>;
}

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/** Primeiro e último dia (yyyy-mm-dd) da competência. */
export function limitesDaCompetencia(c: Competencia): { inicio: string; fim: string } {
  const ultimo = new Date(Date.UTC(c.ano, c.mes, 0)).getUTCDate();
  return { inicio: iso(c.ano, c.mes, 1), fim: iso(c.ano, c.mes, ultimo) };
}

/** Salário vigente no mês: a última alteração com vigência até o fim dele. */
export function salarioNaCompetencia(d: DadosCompetencia, c: Competencia): number {
  const { fim } = limitesDaCompetencia(c);
  const ordenadas = [...d.alteracoesSalariais].sort((a, b) => a.vigencia.localeCompare(b.vigencia));
  const vigente = ordenadas.filter((a) => a.vigencia <= fim).pop();
  if (vigente) return Number(vigente.salario_novo);
  const futura = ordenadas.find((a) => a.vigencia > fim);
  return futura?.salario_anterior != null ? Number(futura.salario_anterior) : d.salarioAtual;
}

/** Dias de falta não abonada dentro do mês e semanas atingidas (cada uma perde o DSR). */
export function faltasNaCompetencia(d: DadosCompetencia, c: Competencia): { dias: number; dsr: number } {
  const { inicio, fim } = limitesDaCompetencia(c);
  const dias = new Set<string>();
  for (const f of d.faltas) {
    if (f.abonada) continue;
    const de = f.data_inicio > inicio ? f.data_inicio : inicio;
    const ate = (f.data_fim ?? f.data_inicio) < fim ? (f.data_fim ?? f.data_inicio) : fim;
    for (let t = Date.parse(`${de}T00:00:00Z`); t <= Date.parse(`${ate}T00:00:00Z`); t += 86400000) {
      dias.add(new Date(t).toISOString().slice(0, 10));
    }
  }
  // Semana de domingo a sábado: a falta injustificada faz perder o repouso daquela semana.
  const semanas = new Set(
    [...dias].map((dia) => {
      const t = Date.parse(`${dia}T00:00:00Z`);
      return new Date(t - new Date(t).getUTCDay() * 86400000).toISOString().slice(0, 10);
    }),
  );
  return { dias: dias.size, dsr: semanas.size };
}

const vigenteNoMes = (b: { vigencia_inicio: string | null; vigencia_fim: string | null }, c: Competencia) => {
  const { inicio, fim } = limitesDaCompetencia(c);
  return (!b.vigencia_inicio || b.vigencia_inicio <= fim) && (!b.vigencia_fim || b.vigencia_fim >= inicio);
};

function idadeEm(nascimento: string, dia: string): number {
  const [a, m, d] = nascimento.split("-").map(Number);
  const [ra, rm, rd] = dia.split("-").map(Number);
  return ra - a - (rm < m || (rm === m && rd < d) ? 1 : 0);
}

const soma = (xs: number[]) => xs.reduce((s, x) => s + (Number(x) || 0), 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Jornada mensal a partir da semanal (CLT: semanal × 5; 44 h → 220 h). */
export function jornadaMensal(semanal?: number | null): number {
  const s = Number(semanal);
  return Number.isFinite(s) && s > 0 ? Math.round(s * 5) : JORNADA_MENSAL_PADRAO;
}

export function montarEntradaDaCompetencia(d: DadosCompetencia, c: Competencia): HoleriteEntrada {
  const e: HoleriteEntrada = { ...ENTRADA_PADRAO };
  e.salario_base = salarioNaCompetencia(d, c);
  e.jornada_mensal = jornadaMensal(d.jornadaSemanal);

  const faltas = faltasNaCompetencia(d, c);
  e.faltas_dias = faltas.dias;
  e.dsr_perdidos = faltas.dsr;

  // Benefício em espécie (VT, VR…) não é provento em dinheiro: entra só a
  // coparticipação do funcionário, e o VT respeita o teto de 6% no motor.
  for (const b of d.beneficios.filter((x) => vigenteNoMes(x, c))) {
    const nome = b.nome.toLowerCase();
    const desconto = Number(b.desconto) || 0;
    if (/transporte|\bvt\b/.test(nome)) {
      e.desconta_vt = true;
      const custo = Number(b.valor) || 0;
      e.vt_valor_passagens += desconto > 0 ? Math.min(desconto, custo || desconto) : custo;
    } else if (desconto <= 0) {
      continue;
    } else if (/refei|\bvr\b/.test(nome)) {
      e.desconta_vr = true;
      e.vr_desconto += desconto;
    } else if (/aliment|\bva\b/.test(nome)) {
      e.desconta_va = true;
      e.va_desconto += desconto;
    } else if (/odonto/.test(nome)) {
      e.plano_odonto += desconto;
    } else if (/sa[uú]de|m[eé]dic/.test(nome)) {
      e.plano_saude += desconto;
    } else {
      e.outros_descontos += desconto;
    }
  }

  e.adiantamento = soma(d.adiantamentos);

  let descontosAvulsos = 0;
  for (const l of d.lancamentos) {
    const q = Number(l.quantidade) || 0;
    const v = Number(l.valor) || 0;
    switch (l.tipo) {
      case "hora_extra_50":
        e.horas_extras_50 += q;
        break;
      case "hora_extra_100":
        e.horas_extras_100 += q;
        break;
      case "adicional_noturno":
        e.horas_noturnas += q;
        break;
      case "atraso":
        e.atrasos_horas += q;
        break;
      case "comissao":
        e.comissoes += v;
        break;
      case "bonus":
        e.bonificacoes += v;
        break;
      case "outro_provento":
        e.outros_proventos += v;
        break;
      case "desconto":
        descontosAvulsos += v;
        break;
      case "emprestimo_consignado":
        e.emprestimo_consignado += v;
        break;
      case "pensao_alimenticia":
        e.pensao_alimenticia += v;
        break;
      case "contribuicao_sindical":
        e.contribuicao_sindical += v;
        break;
    }
  }
  e.outros_descontos = r2(e.outros_descontos + descontosAvulsos);
  e.outros_proventos = r2(e.outros_proventos);
  if (e.outros_descontos > 0) e.outros_descontos_desc = "Descontos do mês";
  if (e.outros_proventos > 0) e.outros_proventos_desc = "Outros proventos do mês";

  const { fim } = limitesDaCompetencia(c);
  e.dependentes_ir = d.dependentes.filter((x) => x.ir).length;
  e.filhos_salario_familia = d.dependentes.filter(
    (x) => x.salario_familia && x.data_nascimento && idadeEm(x.data_nascimento, fim) <= 14,
  ).length;
  return e;
}

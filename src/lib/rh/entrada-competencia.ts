/**
 * Entrada do holerite de um funcionário numa competência, montada a partir do
 * que o DP lançou no sistema.
 *
 * É a única fonte da prévia da folha, da aba "Prévia da folha" da ficha e do
 * "Gerar holerite": antes cada tela montava a sua e o mesmo funcionário saía
 * com três líquidos diferentes no mesmo mês. Função pura — quem busca os dados
 * no banco é `folha.functions.ts`.
 */
import { ENTRADA_PADRAO, type HoleriteEntrada } from "@/lib/rh/holerite-calc";
import type { Competencia } from "@/lib/rh/clt";

export interface DadosCompetencia {
  salarioAtual: number;
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
  descontos: number[];
  ajustes: Array<{ tipo: "provento" | "desconto"; valor: number }>;
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

export function montarEntradaDaCompetencia(d: DadosCompetencia, c: Competencia): HoleriteEntrada {
  const e: HoleriteEntrada = { ...ENTRADA_PADRAO };
  e.salario_base = salarioNaCompetencia(d, c);

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
  e.outros_descontos += soma(d.descontos) + soma(d.ajustes.filter((a) => a.tipo === "desconto").map((a) => a.valor));
  e.outros_proventos = soma(d.ajustes.filter((a) => a.tipo === "provento").map((a) => a.valor));
  if (e.outros_descontos > 0) e.outros_descontos_desc = "Descontos e ajustes do mês";
  if (e.outros_proventos > 0) e.outros_proventos_desc = "Ajustes do mês";

  const { fim } = limitesDaCompetencia(c);
  e.dependentes_ir = d.dependentes.filter((x) => x.ir).length;
  e.filhos_salario_familia = d.dependentes.filter(
    (x) => x.salario_familia && x.data_nascimento && idadeEm(x.data_nascimento, fim) <= 14,
  ).length;
  return e;
}

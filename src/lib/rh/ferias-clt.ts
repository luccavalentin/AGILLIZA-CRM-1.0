/**
 * Motor de férias CLT (arts. 129 a 145 da CLT).
 *
 * A partir da DATA DE ADMISSÃO o sistema gera automaticamente todos os
 * períodos aquisitivos (12 meses cada), o respectivo período concessivo
 * (12 meses seguintes ao fim do aquisitivo), os dias de direito conforme
 * as faltas injustificadas (art. 130) e o saldo ainda não gozado.
 */

export type FeriasSituacao =
  | "em_curso" // período aquisitivo ainda sendo formado
  | "disponivel" // adquirido, dentro do prazo concessivo
  | "a_vencer" // concessivo termina em <= 90 dias
  | "vencida" // concessivo expirado -> pagamento em dobro (art. 137)
  | "gozada"; // saldo zerado

export interface PeriodoAquisitivo {
  /** 1 = primeiro período após a admissão */
  indice: number;
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD
  /** Limite legal para conceder as férias (fim do aquisitivo + 12 meses). */
  limite_concessivo: string;
  completo: boolean;
  /** Meses já trabalhados no período (0..12) — usado no proporcional. */
  meses_computados: number;
  faltas_injustificadas: number;
  dias_direito: number;
  dias_gozados: number;
  dias_abono: number;
  saldo_dias: number;
  situacao: FeriasSituacao;
  /** Dias restantes até o limite concessivo (negativo = vencido). */
  dias_para_vencer: number;
}

const DIA = 86400000;

const toDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
};
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addMonths = (d: Date, n: number) => {
  const r = new Date(d.getTime());
  const dia = r.getUTCDate();
  r.setUTCMonth(r.getUTCMonth() + n);
  if (r.getUTCDate() < dia) r.setUTCDate(0);
  return r;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DIA);
const diffDias = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DIA);

/** Art. 130 da CLT — dias de férias conforme faltas injustificadas no período. */
export function diasDireitoPorFaltas(faltas: number): number {
  if (faltas <= 5) return 30;
  if (faltas <= 14) return 24;
  if (faltas <= 23) return 18;
  if (faltas <= 32) return 12;
  return 0; // mais de 32 faltas: perde o direito
}

export interface GozoRegistrado {
  periodo_aquisitivo_inicio: string;
  dias_gozados: number;
  abono_dias: number;
  status: string;
}

export interface OcorrenciaFalta {
  data_inicio: string;
  dias: number | null;
  abonada: boolean;
}

export interface CalculoFeriasEntrada {
  data_admissao: string;
  data_demissao?: string | null;
  /** Referência do cálculo (default: hoje). */
  hoje?: string;
  gozos?: GozoRegistrado[];
  faltas?: OcorrenciaFalta[];
  /** Salário atual para provisão financeira. */
  salario?: number;
}

export interface CalculoFeriasResultado {
  periodos: PeriodoAquisitivo[];
  /** Dias adquiridos e ainda não gozados (todos os períodos completos). */
  saldo_total: number;
  /** Dias de períodos com concessivo expirado (risco de pagamento em dobro). */
  dias_vencidos: number;
  /** Dias que vencem nos próximos 90 dias. */
  dias_a_vencer: number;
  /** Avos do período aquisitivo em formação (0..12). */
  avos_proporcionais: number;
  /** Provisão contábil: (saldo + proporcional) + 1/3 constitucional. */
  provisao: number;
  /** Alerta principal para o gestor. */
  alerta: "vencida" | "a_vencer" | "ok";
  proximo_vencimento: string | null;
}

export function calcularFeriasCLT(entrada: CalculoFeriasEntrada): CalculoFeriasResultado {
  const admissao = toDate(entrada.data_admissao);
  const hoje = toDate(entrada.hoje ?? new Date().toISOString());
  const fimVinculo = entrada.data_demissao ? toDate(entrada.data_demissao) : hoje;
  const referencia = fimVinculo < hoje ? fimVinculo : hoje;

  const gozos = entrada.gozos ?? [];
  const faltas = (entrada.faltas ?? []).filter((f) => !f.abonada);

  const periodos: PeriodoAquisitivo[] = [];
  let indice = 0;
  let cursor = admissao;

  // Gera períodos aquisitivos até alcançar a referência (limite de segurança: 60).
  while (cursor <= referencia && indice < 60) {
    indice += 1;
    const inicio = cursor;
    const fim = addDays(addMonths(inicio, 12), -1);
    const limite = addDays(addMonths(fim, 12), 0);
    const completo = fim <= referencia;

    const mesesBrutos = Math.floor(diffDias(referencia, inicio) / 30.4375);
    const meses_computados = completo ? 12 : Math.max(0, Math.min(12, mesesBrutos));

    const faltasPeriodo = faltas
      .filter((f) => {
        const d = toDate(f.data_inicio);
        return d >= inicio && d <= fim;
      })
      .reduce((acc, f) => acc + (f.dias ?? 1), 0);

    const dias_direito = completo ? diasDireitoPorFaltas(faltasPeriodo) : 0;

    const doPeriodo = gozos.filter(
      (g) => g.status !== "cancelada" && g.periodo_aquisitivo_inicio.slice(0, 10) === toIso(inicio),
    );
    const dias_gozados = doPeriodo.reduce((a, g) => a + (g.dias_gozados ?? 0), 0);
    const dias_abono = doPeriodo.reduce((a, g) => a + (g.abono_dias ?? 0), 0);
    const saldo_dias = Math.max(0, dias_direito - dias_gozados - dias_abono);
    const dias_para_vencer = diffDias(limite, referencia);

    let situacao: FeriasSituacao;
    if (!completo) situacao = "em_curso";
    else if (saldo_dias === 0) situacao = "gozada";
    else if (dias_para_vencer < 0) situacao = "vencida";
    else if (dias_para_vencer <= 90) situacao = "a_vencer";
    else situacao = "disponivel";

    periodos.push({
      indice,
      inicio: toIso(inicio),
      fim: toIso(fim),
      limite_concessivo: toIso(limite),
      completo,
      meses_computados,
      faltas_injustificadas: faltasPeriodo,
      dias_direito,
      dias_gozados,
      dias_abono,
      saldo_dias,
      situacao,
      dias_para_vencer,
    });

    cursor = addMonths(inicio, 12);
  }

  const saldo_total = periodos.reduce((a, p) => a + p.saldo_dias, 0);
  const dias_vencidos = periodos
    .filter((p) => p.situacao === "vencida")
    .reduce((a, p) => a + p.saldo_dias, 0);
  const dias_a_vencer = periodos
    .filter((p) => p.situacao === "a_vencer")
    .reduce((a, p) => a + p.saldo_dias, 0);

  const emFormacao = periodos.find((p) => !p.completo);
  const avos_proporcionais = emFormacao?.meses_computados ?? 0;

  const salario = entrada.salario ?? 0;
  const valorDia = salario / 30;
  const baseProvisao = valorDia * saldo_total + valorDia * ((avos_proporcionais / 12) * 30);
  const provisao = Math.round(baseProvisao * (4 / 3) * 100) / 100;

  const pendentes = periodos
    .filter((p) => p.saldo_dias > 0 && p.completo)
    .sort((a, b) => a.limite_concessivo.localeCompare(b.limite_concessivo));

  return {
    periodos,
    saldo_total,
    dias_vencidos,
    dias_a_vencer,
    avos_proporcionais,
    provisao,
    alerta: dias_vencidos > 0 ? "vencida" : dias_a_vencer > 0 ? "a_vencer" : "ok",
    proximo_vencimento: pendentes[0]?.limite_concessivo ?? null,
  };
}

export const SITUACAO_LABEL: Record<FeriasSituacao, string> = {
  em_curso: "Período em formação",
  disponivel: "Disponível",
  a_vencer: "A vencer (90 dias)",
  vencida: "Vencida — dobro",
  gozada: "Gozada",
};

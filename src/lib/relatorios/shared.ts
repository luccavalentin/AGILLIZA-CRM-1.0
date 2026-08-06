/** Tipos e helpers client-safe do módulo de Relatórios (Etapa 08). */
export { formatBRL, formatPercent } from "@/lib/simulacao/format";

export type Periodo = "hoje" | "7d" | "15d" | "30d" | "mes" | "mes_anterior" | "ano" | "custom";

export type Escopo = "minha" | "equipe" | "geral";

export interface ReportFiltros {
  periodo: Periodo;
  de?: string;
  ate?: string;
  escopo: Escopo;
  banco?: string;
  produto?: string;
  status?: string;
  responsavel?: string;
  cliente?: string;
  valorMin?: number;
  valorMax?: number;
  busca?: string;
  /** Filtros multi-seleção (Etapa: refino de filtros). */
  bancos?: string[];
  analistas?: string[];
  comerciais?: string[];
  corretores?: string[];
  imobiliarias?: string[];
}

export const PERIODO_LABEL: Record<Periodo, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "15d": "Últimos 15 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
  mes_anterior: "Mês anterior",
  ano: "Este ano",
  custom: "Período personalizado",
};

export const ESCOPO_LABEL: Record<Escopo, string> = {
  minha: "Minha",
  equipe: "Equipe",
  geral: "Geral",
};

export const filtrosPadrao = (): ReportFiltros => ({ periodo: "mes", escopo: "minha" });

/** Fuso oficial da operação (sem horário de verão desde 2019: UTC-03:00). */
export const TZ_BR = "America/Sao_Paulo";
/** Data (yyyy-mm-dd) de um timestamp no fuso de Brasília. */
export const dataBR = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ_BR });
/**
 * Limites de dia com offset explícito (-03:00). Sem o offset, o Postgres
 * interpreta a string como UTC e os registros criados após as 21h (horário de
 * Brasília) ficam de fora do período — KPIs "sem dados" mesmo havendo dados.
 */
export const inicioDiaBR = (dia: string) => `${dia}T00:00:00-03:00`;
export const fimDiaBR = (dia: string) => `${dia}T23:59:59.999-03:00`;

/** Resolve um intervalo [de, ate] em ISO (yyyy-mm-dd) a partir do filtro de período. */
export function resolverIntervalo(f: ReportFiltros): { de: string; ate: string } {
  // "Hoje" ancorado no fuso America/Sao_Paulo (o servidor roda em UTC).
  const hojeStr = new Date().toLocaleDateString("en-CA", { timeZone: TZ_BR });
  const [hy, hm, hd] = hojeStr.split("-").map(Number);
  const hoje = new Date(hy, hm - 1, hd);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const menosDias = (n: number) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - n);
    return d;
  };
  switch (f.periodo) {
    case "hoje":
      return { de: iso(hoje), ate: iso(hoje) };
    case "7d":
      return { de: iso(menosDias(7)), ate: iso(hoje) };
    case "15d":
      return { de: iso(menosDias(15)), ate: iso(hoje) };
    case "30d":
      return { de: iso(menosDias(30)), ate: iso(hoje) };
    case "mes":
      return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: iso(hoje) };
    case "mes_anterior": {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { de: iso(ini), ate: iso(fim) };
    }
    case "ano":
      return { de: iso(new Date(hoje.getFullYear(), 0, 1)), ate: iso(hoje) };
    case "custom":
      return {
        de: f.de || iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
        ate: f.ate || iso(hoje),
      };
  }
}

export type ColAlign = "left" | "right" | "center";
export type ColFooter = "sum" | "count" | "avg" | "none";

export interface ReportColumn {
  key: string;
  label: string;
  align?: ColAlign;
  footer?: ColFooter;
  /** "brl" | "int" | "pct" | "date" | "text" */
  format?: "brl" | "int" | "pct" | "date" | "text";
}

export interface ReportKpi {
  label: string;
  valor: string;
  hint?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
  /**
   * Se informado, torna o KPI clicável: abre um diálogo com as linhas de
   * `rows` que satisfazem TODOS os pares chave/valor listados.
   */
  filters?: Array<{ key: string; values: (string | number | boolean)[] }>;
  /** Título opcional do diálogo de detalhamento (padrão: label). */
  titulo?: string;
}


export interface ChartSerie {
  label: string;
  valor: number;
  valor2?: number;
}

export interface ReportChart {
  titulo: string;
  subtitulo?: string;
  tipo: "bar" | "line" | "barh" | "funnel" | "donut";
  dados: ChartSerie[];
  serie1?: string;
  serie2?: string;
  moeda?: boolean;
}

/** Comparativo mês a mês (últimos 6 meses) — independe do período do filtro. */
export interface ComparativoMensal {
  /** Rótulos dos 6 meses, do mais antigo ao mais recente (ex.: "Jul/25"). */
  meses: string[];
  /** Propostas enviadas por mês. */
  quantidade: number[];
  /** Taxa de aprovação (%) por mês. */
  taxaAprovacao: number[];
  /** Ranking de bancos com a quantidade por mês. */
  bancos: { nome: string; valores: number[] }[];
}

export interface ReportTabela {
  titulo: string;
  subtitulo?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
}

export interface ReportTabelaGrupo {
  titulo: string;
  descricao?: string;
  tabelas: ReportTabela[];
}

export interface ReportResult {
  titulo: string;
  descricao: string;
  modulo: string;
  kpis: ReportKpi[];
  charts: ReportChart[];
  columns: ReportColumn[];
  rows: ReportRow[];
  ranking?: { titulo: string; columns: ReportColumn[]; rows: ReportRow[] };
  /** Blocos de tabelas agrupadas (usado no relatório gerencial). */
  tabelas?: ReportTabelaGrupo[];
  /** Comparativo mês a mês (últimos 6 meses) aplicado a todos os relatórios. */
  comparativoMensal?: ComparativoMensal;
  /** Opções completas para os filtros (independem do resultado filtrado). */
  filtrosDisponiveis?: {
    bancos?: string[];
    statuses?: { value: string; label: string }[];
    produtos?: string[];
    responsaveis?: { value: string; label: string }[];
    analistas?: { value: string; label: string }[];
    comerciais?: { value: string; label: string }[];
    corretores?: { value: string; label: string }[];
    imobiliarias?: { value: string; label: string }[];
  };
}

export type ReportCell = string | number | boolean | null;
export type ReportRow = Record<string, ReportCell>;

/** Serializa filtros para query string compartilhável. */
export function filtrosParaSearch(f: ReportFiltros): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== "" && v !== null) out[k] = String(v);
  }
  return out;
}

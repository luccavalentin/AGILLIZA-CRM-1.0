/**
 * Exportações em PDF (com logo Agilliza e identidade visual) das listagens
 * de Tarefas e Demandas — reutiliza o motor institucional `exportPDF`.
 */
import { exportPDF } from "@/lib/relatorios/report-pdf";
import type { ReportColumn, ReportKpi, ReportRow } from "@/lib/relatorios/shared";

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const STATUS_TAREFA_LABEL: Record<string, string> = {
  aberta: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_DEMANDA_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const PRIORIDADE_LABEL: Record<string, string> = {
  p1: "Alta",
  p2: "Média",
  p3: "Baixa",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

function slaDemanda(prazo: string | null | undefined, status: string): string {
  if (status === "concluida") return "Concluída";
  if (status === "cancelada") return "Cancelada";
  if (!prazo) return "Sem prazo";
  const restante = new Date(prazo).getTime() - Date.now();
  if (restante < 0) return "SLA vencido";
  const horas = Math.round(restante / 3600_000);
  if (horas < 24) return `${horas}h restantes`;
  const dias = Math.ceil(restante / 86_400_000);
  return `${dias}d restantes`;
}

export function baixarTarefasPDF(params: {
  tarefas: Array<{
    numero?: string | null;
    titulo: string;
    status: string;
    prioridade?: string | null;
    prazo: string | null;
    nome_responsavel?: string | null;
    nome_cliente?: string | null;
  }>;
  escopo: string;
}) {
  const { tarefas, escopo } = params;

  const total = tarefas.length;
  const abertas = tarefas.filter((t) => t.status === "aberta").length;
  const andamento = tarefas.filter((t) => t.status === "em_andamento").length;
  const concluidas = tarefas.filter((t) => t.status === "concluida").length;
  const vencidas = tarefas.filter(
    (t) =>
      t.prazo &&
      t.status !== "concluida" &&
      t.status !== "cancelada" &&
      new Date(t.prazo).getTime() < Date.now(),
  ).length;

  const kpis: ReportKpi[] = [
    { label: "Total", valor: String(total) },
    { label: "A fazer", valor: String(abertas) },
    { label: "Em andamento", valor: String(andamento) },
    { label: "Vencidas", valor: String(vencidas), tone: vencidas > 0 ? "danger" : "neutral" },
    { label: "Concluídas", valor: String(concluidas), tone: "success" },
    {
      label: "Conclusão",
      valor: total ? `${Math.round((concluidas / total) * 100)}%` : "0%",
    },
  ];

  const columns: ReportColumn[] = [
    { key: "numero", label: "Número" },
    { key: "titulo", label: "Título" },
    { key: "cliente", label: "Cliente" },
    { key: "responsavel", label: "Responsável" },
    { key: "prioridade", label: "Prioridade" },
    { key: "status", label: "Status" },
    { key: "prazo", label: "Prazo", align: "right" },
  ];

  const rows: ReportRow[] = tarefas.map((t) => ({
    numero: t.numero ?? "—",
    titulo: t.titulo,
    cliente: t.nome_cliente ?? "—",
    responsavel: t.nome_responsavel ?? "—",
    prioridade: PRIORIDADE_LABEL[String(t.prioridade ?? "").toLowerCase()] ?? "—",
    status: STATUS_TAREFA_LABEL[t.status] ?? t.status,
    prazo: fmtDataHora(t.prazo),
  }));

  const emitido = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const meta = [`Escopo: ${escopo}`, `Registros: ${total}`, `Emitido em: ${emitido}`];

  exportPDF(
    "Tarefas",
    "Relação de tarefas operacionais com prazo, responsável e situação.",
    meta,
    kpis,
    columns,
    rows,
    `agilliza-tarefas-${new Date().toISOString().slice(0, 10)}`,
    undefined,
    undefined,
    undefined,
    "landscape",
  );
}

export function baixarDemandasPDF(params: {
  demandas: Array<{
    numero?: string | null;
    titulo: string;
    status: string;
    prioridade?: string | null;
    prazo_sla?: string | null;
    nome_responsavel?: string | null;
    tipo_responsavel?: string | null;
    nome_cliente?: string | null;
    numero_proposta?: string | null;
    numero_simulacao?: string | null;
    nao_lidas?: number;
  }>;
  escopo: string;
}) {
  const { demandas, escopo } = params;

  const total = demandas.length;
  const ativas = demandas.filter(
    (d) => d.status === "aberta" || d.status === "em_andamento",
  ).length;
  const aguardando = demandas.filter((d) => d.status === "aguardando").length;
  const vencidas = demandas.filter(
    (d) =>
      d.prazo_sla &&
      d.status !== "concluida" &&
      d.status !== "cancelada" &&
      new Date(d.prazo_sla).getTime() < Date.now(),
  ).length;
  const naoLidas = demandas.reduce((n, d) => n + (d.nao_lidas ?? 0), 0);
  const concluidas = demandas.filter((d) => d.status === "concluida").length;

  const kpis: ReportKpi[] = [
    { label: "Total", valor: String(total) },
    { label: "Ativas", valor: String(ativas) },
    { label: "Aguardando", valor: String(aguardando), tone: "warning" },
    { label: "Vencidas", valor: String(vencidas), tone: vencidas > 0 ? "danger" : "neutral" },
    { label: "Não lidas", valor: String(naoLidas) },
    { label: "Concluídas", valor: String(concluidas), tone: "success" },
  ];

  const columns: ReportColumn[] = [
    { key: "numero", label: "Número" },
    { key: "titulo", label: "Título" },
    { key: "cliente", label: "Cliente" },
    { key: "responsavel", label: "Responsável" },
    { key: "prioridade", label: "Prioridade" },
    { key: "status", label: "Status" },
    { key: "sla", label: "SLA", align: "right" },
    { key: "prazo", label: "Prazo", align: "right" },
  ];

  const rows: ReportRow[] = demandas.map((d) => ({
    numero: d.numero ?? "—",
    titulo: d.titulo,
    cliente: d.nome_cliente ?? "—",
    responsavel: d.nome_responsavel
      ? d.tipo_responsavel
        ? `${d.nome_responsavel} · ${d.tipo_responsavel}`
        : d.nome_responsavel
      : "—",
    prioridade: PRIORIDADE_LABEL[String(d.prioridade ?? "").toLowerCase()] ?? "—",
    status: STATUS_DEMANDA_LABEL[d.status] ?? d.status,
    sla: slaDemanda(d.prazo_sla, d.status),
    prazo: fmtDataHora(d.prazo_sla),
  }));

  const emitido = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const meta = [`Escopo: ${escopo}`, `Registros: ${total}`, `Emitido em: ${emitido}`];

  exportPDF(
    "Demandas",
    "Relação de demandas operacionais com SLA, responsável e situação.",
    meta,
    kpis,
    columns,
    rows,
    `agilliza-demandas-${new Date().toISOString().slice(0, 10)}`,
    undefined,
    undefined,
    undefined,
    "landscape",
  );
}

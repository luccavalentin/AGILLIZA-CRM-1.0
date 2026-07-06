import { exportPDF } from "@/lib/relatorios/report-pdf";
import { formatBRL, formatPercent } from "@/lib/simulacao/format";
import type { ReportColumn, ReportKpi, ReportRow } from "@/lib/relatorios/shared";

interface SimulacaoPdfInput {
  simulacao: any;
  bancos: any[];
}

const LABEL_STATUS_BANCO: Record<string, string> = {
  aguardando: "Aguardando",
  simulada: "Simulação",
  erro: "Erro",
  expirada: "Expirada",
};

/** Gera e baixa um PDF institucional de uma simulação (dados + comparativo de bancos). */
export function baixarSimulacaoPDF({ simulacao: s, bancos }: SimulacaoPdfInput) {
  const produto =
    s.produto === "home_equity"
      ? "Home Equity"
      : s.produto === "financiamento_imobiliario"
        ? "Financiamento imobiliário"
        : "Operação";

  const meta = [
    `Nº ${s.numero_simulacao ?? "—"}`,
    `Cliente: ${s.nome_cliente ?? "—"}`,
    `Produto: ${produto}`,
    `UF: ${s.uf ?? "—"}`,
  ];

  const kpis: ReportKpi[] = [
    { label: "Valor do imóvel", valor: formatBRL(s.valor_imovel) },
    { label: "Financiamento", valor: formatBRL(s.valor_financiamento) },
    { label: "Entrada", valor: formatBRL(s.valor_entrada) },
    { label: "Prazo", valor: s.prazo ? `${s.prazo} meses` : "—" },
    { label: "Sistema", valor: s.sistema_amortizacao === "P" ? "PRICE" : "SAC" },
    { label: "FGTS", valor: s.utiliza_fgts === "S" ? "Sim" : "Não" },
  ];

  const columns: ReportColumn[] = [
    { key: "banco", label: "Banco" },
    { key: "situacao", label: "Situação" },
    { key: "parcela", label: "Parcela", align: "right" },
    { key: "taxa", label: "Taxa a.a.", align: "right" },
    { key: "prazo", label: "Prazo máx", align: "right" },
    { key: "financiamento", label: "Financ. máx", align: "right" },
    { key: "iof", label: "IOF", align: "right" },
  ];

  const rows: ReportRow[] = (bancos ?? []).map((b) => ({
    banco: b.nome_banco ?? "—",
    situacao: LABEL_STATUS_BANCO[b.status_banco ?? ""] ?? (b.status_banco || "—"),
    parcela: b.valor_parcela != null ? formatBRL(b.valor_parcela) : "—",
    taxa: b.taxa_juros_ano != null ? formatPercent(b.taxa_juros_ano / 100) : "—",
    prazo: b.prazo_pagamento_max ? `${b.prazo_pagamento_max}m` : "—",
    financiamento: b.valor_financiamento_max != null ? formatBRL(b.valor_financiamento_max) : "—",
    iof: b.valor_iof != null ? formatBRL(b.valor_iof) : "—",
  }));

  exportPDF(
    `Simulação ${s.numero_simulacao ?? ""}`.trim(),
    `${produto} · ${s.nome_cliente ?? "Cliente não informado"}`,
    meta,
    kpis,
    columns,
    rows,
  );
}

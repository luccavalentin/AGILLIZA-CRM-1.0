import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { exportPDF } from "@/lib/relatorios/report-pdf";
import { formatBRL, formatPercent } from "@/lib/simulacao/format";
import type { ReportColumn, ReportKpi, ReportRow } from "@/lib/relatorios/shared";
import { extrairDetalheBanco } from "@/lib/simulacao/detalhe-banco";
import { AGILLIZA_LOGO_LIGHT, AGILLIZA_LOGO_RATIO } from "@/lib/relatorios/brand-logo";

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

/** Gera e baixa um PDF institucional consolidado (dados + comparativo de bancos). */
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

// ---------------------------------------------------------------------------
// PDF individual por banco (detalhes + plano de pagamento completo)
// ---------------------------------------------------------------------------

const AZUL = "#000F9F";
const CORAL = "#F5333F";
const GRAFITE = "#0B0B0F";
const CINZA = "#6B7280";
const ZEBRA = "#F7F8FA";
const HEADER_H = 84;

function pctTxt(v: number | null, casas = 4): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: casas })}%`;
}

function drawHeaderBanco(doc: jsPDF, pageW: number, titulo: string, descricao: string) {
  drawBrandHeader(doc, pageW, HEADER_H, titulo, descricao);
}

function drawFooterBanco(doc: jsPDF, pageW: number, pageH: number, pageNum: number, total: number) {
  const y = pageH - 22;
  doc.setDrawColor("#E4E6EF");
  doc.setLineWidth(0.5);
  doc.line(32, y, pageW - 32, y);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(CINZA);
  const emitido = new Date().toLocaleString("pt-BR");
  doc.text(`Agilliza · Crédito Imobiliário  —  Emitido em ${emitido}`, 32, y + 12);
  doc.text(`Página ${pageNum} de ${total}`, pageW - 32, y + 12, { align: "right" });
}

/** Gera e baixa o PDF detalhado de um único banco (dados + todas as parcelas). */
export function baixarBancoDetalhePDF({ simulacao: s, banco: b }: { simulacao: any; banco: any }) {
  const detalhe = extrairDetalheBanco(b?.raw_response);
  const nomeBanco = b?.nome_banco ?? "Banco";
  const produto =
    s.produto === "home_equity"
      ? "Home Equity"
      : s.produto === "financiamento_imobiliario"
        ? "Financiamento imobiliário"
        : "Operação";

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const titulo = `${nomeBanco} — Simulação ${s.numero_simulacao ?? ""}`.trim();
  const descricao = `${produto} · ${s.nome_cliente ?? "Cliente não informado"}`;

  let y = HEADER_H + 24;
  doc.setTextColor(GRAFITE);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    [
      `Nº ${s.numero_simulacao ?? "—"}`,
      `Cliente: ${s.nome_cliente ?? "—"}`,
      `UF: ${s.uf ?? "—"}`,
    ].join("   ·   "),
    32,
    y,
  );
  y += 18;

  // Grade de detalhes (cartões)
  const detalhes: { label: string; valor: string }[] = [
    {
      label: "Situação",
      valor: LABEL_STATUS_BANCO[b?.status_banco ?? ""] ?? (b?.status_banco || "—"),
    },
    {
      label: "Taxa de juros a.a.",
      valor: pctTxt(detalhe?.taxaJurosAno ?? b?.taxa_juros_ano ?? null),
    },
    { label: "Taxa de juros a.m.", valor: pctTxt(detalhe?.taxaJurosMes ?? null) },
    { label: "CET", valor: pctTxt(detalhe?.cet ?? null) },
    { label: "CESH", valor: pctTxt(detalhe?.cesh ?? null) },
    { label: "Valor do imóvel", valor: formatBRL(detalhe?.valorImovel ?? s.valor_imovel) },
    {
      label: "Financiamento",
      valor: formatBRL(detalhe?.valorFinanciamento ?? b?.valor_financiamento_max),
    },
    { label: "Entrada", valor: formatBRL(detalhe?.valorEntrada ?? s.valor_entrada) },
    { label: "IOF", valor: formatBRL(detalhe?.iof ?? b?.valor_iof) },
    {
      label: "Prazo",
      valor:
        (detalhe?.prazoMeses ?? b?.prazo_pagamento_max) != null
          ? `${detalhe?.prazoMeses ?? b?.prazo_pagamento_max} meses`
          : "—",
    },
    {
      label: "Sistema",
      valor: detalhe?.sistemaAmortizacao ?? (s.sistema_amortizacao === "P" ? "PRICE" : "SAC"),
    },
    { label: "1ª parcela", valor: formatBRL(detalhe?.primeiraParcela ?? b?.valor_parcela) },
    { label: "Última parcela", valor: formatBRL(detalhe?.ultimaParcela ?? null) },
    { label: "Somatório parcelas", valor: formatBRL(detalhe?.somatorioParcelas ?? null) },
    { label: "Seguradora", valor: detalhe?.seguradora ?? "—" },
  ];

  const gap = 8;
  const cols = 3;
  const cardW = (pageW - 64 - gap * (cols - 1)) / cols;
  const cardH = 40;
  detalhes.forEach((d, i) => {
    const col = i % cols;
    const rowIdx = Math.floor(i / cols);
    const x = 32 + col * (cardW + gap);
    const cy = y + rowIdx * (cardH + gap);
    doc.setFillColor(ZEBRA);
    doc.setDrawColor("#E4E6EF");
    doc.roundedRect(x, cy, cardW, cardH, 4, 4, "FD");
    doc.setFillColor(CORAL);
    doc.rect(x, cy + 7, 3, cardH - 14, "F");
    doc.setTextColor(CINZA);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(d.label.toUpperCase(), x + 10, cy + 15, { maxWidth: cardW - 16 });
    doc.setTextColor(AZUL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(d.valor, x + 10, cy + 31, { maxWidth: cardW - 16 });
  });
  const linhas = Math.ceil(detalhes.length / cols);
  y += linhas * (cardH + gap) + 12;

  // Título da tabela de parcelas
  const parcelas = detalhe?.parcelas ?? [];
  doc.setTextColor(GRAFITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Plano de pagamento (${parcelas.length} parcelas)`, 32, y);
  y += 8;

  if (parcelas.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(CINZA);
    doc.text("Detalhamento de parcelas indisponível para esta simulação.", 32, y + 16);
  } else {
    autoTable(doc, {
      startY: y,
      head: [
        [
          "Parc.",
          "Data",
          "Amortização",
          "Juros",
          "Seguro MIP",
          "Seguro DFI",
          "Tarifa",
          "Parcela",
          "Saldo devedor",
        ],
      ],
      body: parcelas.map((p) => [
        String(p.numero),
        p.data ?? "—",
        formatBRL(p.amortizacao),
        formatBRL(p.juros),
        formatBRL(p.seguroMip),
        formatBRL(p.seguroDfi),
        formatBRL(p.tarifa),
        formatBRL(p.parcela),
        formatBRL(p.saldoDevedor),
      ]),
      margin: { left: 32, right: 32, top: HEADER_H + 16, bottom: 40 },
      styles: {
        fontSize: 6.5,
        cellPadding: 3,
        textColor: GRAFITE,
        lineColor: "#E4E6EF",
        lineWidth: 0.25,
      },
      headStyles: { fillColor: AZUL, textColor: "#FFFFFF", fontStyle: "bold", fontSize: 6.5 },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: {
        0: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
      },
      didDrawPage: () => drawHeaderBanco(doc, pageW, titulo, descricao),
    });
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (parcelas.length === 0) drawHeaderBanco(doc, pageW, titulo, descricao);
    drawFooterBanco(doc, pageW, pageH, p, total);
  }

  const nome = `${nomeBanco}-${s.numero_simulacao ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`agilliza-${nome}.pdf`);
}

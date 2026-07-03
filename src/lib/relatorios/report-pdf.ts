import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportColumn, ReportRow, ReportKpi } from "@/lib/relatorios/shared";
import { formatCell, footerValue } from "@/lib/relatorios/report-format";

/** Cores institucionais fixas do PDF (ignora o tema do usuário). */
const AZUL = "#000F9F";
const GRAFITE = "#0B0B0F";
const ZEBRA = "#F7F8FA";

/** Exporta o relatório em PDF com cabeçalho institucional, KPIs e tabela zebrada. */
export function exportPDF(
  titulo: string,
  descricao: string,
  meta: string[],
  kpis: ReportKpi[],
  columns: ReportColumn[],
  rows: ReportRow[],
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Cabeçalho institucional
  doc.setFillColor(AZUL);
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, 32, 26);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(descricao, 32, 42);

  let y = 78;
  doc.setTextColor(GRAFITE);
  doc.setFontSize(8);
  doc.text(meta.join("   ·   "), 32, y);
  y += 16;

  // KPIs em grade
  doc.setFontSize(8);
  const kpiW = (pageW - 64) / Math.min(kpis.length || 1, 6);
  kpis.slice(0, 6).forEach((k, i) => {
    const x = 32 + i * kpiW;
    doc.setTextColor("#6B7280");
    doc.setFont("helvetica", "normal");
    doc.text(k.label.toUpperCase(), x, y);
    doc.setTextColor(GRAFITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(k.valor, x, y + 14);
    doc.setFontSize(8);
  });
  y += 30;

  const head = [columns.map((c) => c.label)];
  const body = rows.map((r) => columns.map((c) => formatCell(r[c.key], c.format)));
  const foot = [columns.map((c, i) => (i === 0 ? "TOTAIS" : footerValue(rows, c)))];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    margin: { left: 32, right: 32 },
    styles: { fontSize: 7.5, cellPadding: 3, textColor: GRAFITE },
    headStyles: { fillColor: AZUL, textColor: "#FFFFFF", fontStyle: "bold" },
    footStyles: { fillColor: "#E9EBF5", textColor: GRAFITE, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: columns.reduce((acc, c, i) => {
      if (c.align === "right" || c.format === "brl" || c.format === "int" || c.format === "pct") acc[i] = { halign: "right" };
      return acc;
    }, {} as Record<number, { halign: "right" }>),
  });

  const nome = titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`${nome}.pdf`);
}

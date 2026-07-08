import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportColumn, ReportRow, ReportKpi } from "@/lib/relatorios/shared";
import { formatCell, footerValue } from "@/lib/relatorios/report-format";
import { AGILLIZA_LOGO_LIGHT, AGILLIZA_LOGO_RATIO } from "@/lib/relatorios/brand-logo";

/** Cores institucionais fixas do PDF (ignora o tema do usuário). */
const AZUL = "#000F9F";
const CORAL = "#F5333F";
const GRAFITE = "#0B0B0F";
const CINZA = "#6B7280";
const ZEBRA = "#F7F8FA";

const HEADER_H = 84;

/** Desenha o cabeçalho institucional (faixa azul + logo à esquerda + título) em cada página. */
function drawHeader(doc: jsPDF, pageW: number, titulo: string, descricao: string) {
  drawBrandHeader(doc, pageW, HEADER_H, titulo, descricao);
}

/**
 * Cabeçalho institucional compartilhado: faixa azul com a logo Agilliza em destaque
 * à esquerda, separador coral e título/subtítulo. Usado em todos os PDFs enviados ao cliente.
 */
export function drawBrandHeader(
  doc: jsPDF,
  pageW: number,
  headerH: number,
  titulo: string,
  descricao: string,
) {
  doc.setFillColor(AZUL);
  doc.rect(0, 0, pageW, headerH, "F");
  // Detalhe coral inferior
  doc.setFillColor(CORAL);
  doc.rect(0, headerH, pageW, 3, "F");

  // Logo em destaque (canto esquerdo)
  const logoH = 34;
  const logoW = logoH * AGILLIZA_LOGO_RATIO;
  const logoX = 32;
  const logoY = (headerH - logoH) / 2;
  let textoX = 32;
  try {
    doc.addImage(AGILLIZA_LOGO_LIGHT, "PNG", logoX, logoY, logoW, logoH);
    // Separador vertical entre logo e título
    const sepX = logoX + logoW + 18;
    doc.setDrawColor("#4655C4");
    doc.setLineWidth(1);
    doc.line(sepX, headerH * 0.28, sepX, headerH * 0.72);
    textoX = sepX + 18;
  } catch {
    /* fallback silencioso — mantém o título alinhado à esquerda */
  }

  const centroY = headerH / 2;
  doc.setTextColor("#FFFFFF");
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, textoX, centroY - 3);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#C7CBF0");
  doc.text(descricao, textoX, centroY + 13);
}

/** Desenha o rodapé institucional com paginação. */
function drawFooter(doc: jsPDF, pageW: number, pageH: number, pageNum: number, total: number) {
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

/** Exporta o relatório em PDF com cabeçalho institucional, KPIs e tabela zebrada. */
export function exportPDF(
  titulo: string,
  descricao: string,
  meta: string[],
  kpis: ReportKpi[],
  columns: ReportColumn[],
  rows: ReportRow[],
  filename?: string,
  nota?: string,
  /** Logos opcionais desenhados na 1ª coluna, indexados pelo texto da célula (ex.: nome do banco). */
  firstColLogos?: Record<string, { logo: string; ratio: number }>,
  /** Callback opcional para anexar páginas extras (ex.: detalhamento por banco) antes da paginação. */
  appendPages?: (doc: jsPDF, pageW: number, pageH: number) => void,
  /** Orientação da página (padrão: landscape). */
  orientation: "landscape" | "portrait" = "landscape",
  /** Informações do documento em destaque (Data, Cliente, CPF...). Substitui a linha meta. */
  docInfo?: { label: string; value: string }[],
) {
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  let y = HEADER_H + 22;

  // Painel de informações do documento (Data, Cliente, CPF...) — legível e profissional.
  if (docInfo && docInfo.length) {
    const boxX = 32;
    const boxW = pageW - 64;
    const boxH = 46;
    doc.setFillColor(ZEBRA);
    doc.setDrawColor("#E4E6EF");
    doc.setLineWidth(0.75);
    doc.roundedRect(boxX, y, boxW, boxH, 5, 5, "FD");
    doc.setFillColor(CORAL);
    doc.rect(boxX, y + 9, 3, boxH - 18, "F");

    const innerX = boxX + 16;
    const innerW = boxW - 28;
    const n = docInfo.length;
    const colW = innerW / n;
    docInfo.forEach((it, i) => {
      const cx = innerX + i * colW;
      // separador entre colunas
      if (i > 0) {
        doc.setDrawColor("#E1E3EE");
        doc.setLineWidth(0.5);
        doc.line(cx - 8, y + 12, cx - 8, y + boxH - 12);
      }
      doc.setTextColor(CINZA);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(it.label.toUpperCase(), cx, y + 18, { maxWidth: colW - 12 });
      doc.setTextColor(AZUL);
      doc.setFont("helvetica", "bold");
      // fonte adaptativa para caber no espaço da coluna
      let vSize = 11;
      doc.setFontSize(vSize);
      while (vSize > 8 && doc.getTextWidth(String(it.value)) > colW - 12) {
        vSize -= 0.5;
        doc.setFontSize(vSize);
      }
      doc.text(String(it.value), cx, y + 34, { maxWidth: colW - 10 });
    });
    y += boxH + 18;
  } else {
    doc.setTextColor(GRAFITE);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(meta.join("   ·   "), 32, y);
    y += 20;
  }

  // KPIs em cartões (com quebra em linhas quando não cabem lado a lado)
  if (kpis.length) {
    const gap = 10;
    const lista = kpis.slice(0, 6);
    const maxPorLinha = orientation === "portrait" ? 3 : 6;
    const porLinha = Math.min(lista.length, maxPorLinha);
    const cardW = (pageW - 64 - gap * (porLinha - 1)) / porLinha;
    const cardH = 46;
    lista.forEach((k, i) => {
      const linha = Math.floor(i / porLinha);
      const col = i % porLinha;
      const x = 32 + col * (cardW + gap);
      const cy = y + linha * (cardH + gap);
      doc.setFillColor(ZEBRA);
      doc.setDrawColor("#E4E6EF");
      doc.roundedRect(x, cy, cardW, cardH, 4, 4, "FD");
      doc.setFillColor(CORAL);
      doc.rect(x, cy + 8, 3, cardH - 16, "F");
      doc.setTextColor(CINZA);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(k.label.toUpperCase(), x + 12, cy + 18, { maxWidth: cardW - 20 });
      doc.setTextColor(AZUL);
      doc.setFont("helvetica", "bold");
      // fonte adaptativa: garante o valor em uma única linha
      let size = 13;
      doc.setFontSize(size);
      while (size > 9 && doc.getTextWidth(String(k.valor)) > cardW - 20) {
        size -= 0.5;
        doc.setFontSize(size);
      }
      doc.text(String(k.valor), x + 12, cy + 36);
    });
    const linhas = Math.ceil(lista.length / porLinha);
    y += linhas * cardH + (linhas - 1) * gap + 20;
  }

  const head = [columns.map((c) => c.label)];
  const body = rows.map((r) => columns.map((c) => formatCell(r[c.key], c.format)));
  const foot = [columns.map((c, i) => (i === 0 ? "TOTAIS" : footerValue(rows, c)))];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    margin: { left: 32, right: 32, top: HEADER_H + 16, bottom: 40 },
    styles: {
      fontSize: 7.5,
      cellPadding: 4,
      textColor: GRAFITE,
      lineColor: "#E4E6EF",
      lineWidth: 0.25,
    },
    headStyles: { fillColor: AZUL, textColor: "#FFFFFF", fontStyle: "bold" },
    footStyles: { fillColor: "#E9EBF5", textColor: AZUL, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: columns.reduce(
      (acc, c, i) => {
        if (c.align === "right" || c.format === "brl" || c.format === "int" || c.format === "pct")
          acc[i] = { halign: "right" };
        if (i === 0 && firstColLogos)
          acc[0] = { ...(acc[0] ?? {}), cellPadding: { top: 4, right: 4, bottom: 4, left: 30 } };
        return acc;
      },
      {} as Record<number, any>,
    ),
    didDrawPage: () => {
      drawHeader(doc, pageW, titulo, descricao);
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0 || !firstColLogos) return;
      const brand = firstColLogos[String(data.cell.raw ?? "")];
      if (!brand) return;
      const h = Math.min(data.cell.height - 6, 12);
      const w = h * brand.ratio;
      const x = data.cell.x + 5;
      const yy = data.cell.y + (data.cell.height - h) / 2;
      try {
        doc.addImage(brand.logo, "PNG", x, yy, w, h);
      } catch {
        /* fallback silencioso */
      }
    },
  });

  // Disclaimer opcional (ex.: simulações) logo abaixo da tabela.
  if (nota && nota.trim()) {
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    let ny = finalY + 18;
    if (ny > pageH - 60) {
      doc.addPage();
      drawHeader(doc, pageW, titulo, descricao);
      ny = HEADER_H + 30;
    }
    doc.setTextColor(CINZA);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.text(nota.trim(), 32, ny, { maxWidth: pageW - 64, lineHeightFactor: 1.4 });
  }

  // Páginas extras opcionais (ex.: detalhamento de cada banco) antes da paginação.
  if (appendPages) appendPages(doc, pageW, pageH);

  // Rodapé com paginação (após conhecer o total de páginas)
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, pageW, pageH, p, total);
  }

  if (filename && filename.trim()) {
    const limpo = filename.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
    doc.save(`${limpo}.pdf`);
  } else {
    const nome = titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    doc.save(`agilliza-${nome}.pdf`);
  }
}

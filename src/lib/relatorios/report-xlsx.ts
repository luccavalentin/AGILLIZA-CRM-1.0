import ExcelJS from "exceljs";
import type { ReportColumn, ReportRow, ReportCell } from "@/lib/relatorios/shared";
import { formatCell, footerValue } from "@/lib/relatorios/report-format";

// Paleta Agilliza (evitar tokens CSS aqui: XLSX exige cores ARGB literais).
const BRAND = "FF000F9F"; // Azul Agilliza
const BRAND_DARK = "FF000A66";
const BRAND_SOFT = "FFEAF0FF"; // linha zebra clara
const BRAND_TITLE_BG = "FF000F9F";
const TEXT_ON_BRAND = "FFFFFFFF";
const TOTAL_BG = "FFE6EBFF";
const TOTAL_BORDER = "FF000F9F";
const META_TEXT = "FF475569";
const BORDER = "FFD8DEE9";

/** Formato numérico Excel a partir do tipo de coluna. */
function numFmt(format?: ReportColumn["format"]): string | undefined {
  switch (format) {
    case "brl":
      return '"R$" #,##0.00;[Red]-"R$" #,##0.00';
    case "int":
      return "#,##0";
    case "pct":
      return '0.0"%"';
    case "date":
      return "dd/mm/yyyy";
    default:
      return undefined;
  }
}

/** Converte o valor bruto para o tipo que o Excel entende, mantendo célula numérica quando possível. */
function excelValue(
  value: ReportCell,
  format?: ReportColumn["format"],
): string | number | Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (format === "brl" || format === "int" || format === "pct") {
    const n = Number(value);
    return Number.isFinite(n) ? n : formatCell(value, format);
  }
  if (format === "date") {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? formatCell(value, format) : d;
  }
  return String(value);
}

/**
 * Exporta o relatório em XLSX com identidade Agilliza:
 * capa (título + meta), cabeçalho azul, zebra, filtros, painéis congelados e totais destacados.
 */
export async function exportXLSX(
  nomeArquivo: string,
  titulo: string,
  meta: string[],
  columns: ReportColumn[],
  rows: ReportRow[],
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agilliza";
  wb.company = "Agilliza";
  wb.created = new Date();

  const ws = wb.addWorksheet("Relatório", {
    views: [{ state: "frozen", ySplit: 4 + meta.length }],
    properties: { defaultRowHeight: 18 },
  });

  const totalCols = Math.max(columns.length, 1);
  const lastColLetter = ws.getColumn(totalCols).letter;

  // ---------- Título ----------
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = titulo;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: TEXT_ON_BRAND } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_TITLE_BG } };
  ws.getRow(1).height = 30;

  // ---------- Meta ----------
  meta.forEach((linha, i) => {
    const row = 2 + i;
    ws.mergeCells(row, 1, row, totalCols);
    const cell = ws.getCell(row, 1);
    cell.value = linha;
    cell.font = { name: "Calibri", size: 10, color: { argb: META_TEXT } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  });

  const headerRowIdx = 2 + meta.length + 1; // linha em branco entre meta e header
  ws.getRow(headerRowIdx - 1).height = 6;

  // ---------- Cabeçalho ----------
  const headerRow = ws.getRow(headerRowIdx);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.label;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: TEXT_ON_BRAND } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = {
      vertical: "middle",
      horizontal: c.format === "brl" || c.format === "int" || c.format === "pct" ? "right" : "left",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: BRAND_DARK } },
      bottom: { style: "medium", color: { argb: BRAND_DARK } },
      left: { style: "thin", color: { argb: BRAND_DARK } },
      right: { style: "thin", color: { argb: BRAND_DARK } },
    };
  });
  headerRow.height = 26;

  // ---------- Corpo ----------
  const firstDataRow = headerRowIdx + 1;
  rows.forEach((r, rIdx) => {
    const row = ws.getRow(firstDataRow + rIdx);
    columns.forEach((c, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = excelValue(r[c.key], c.format);
      const fmt = numFmt(c.format);
      if (fmt) cell.numFmt = fmt;
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF1F2937" } };
      cell.alignment = {
        vertical: "middle",
        horizontal:
          c.format === "brl" || c.format === "int" || c.format === "pct" ? "right" : "left",
        wrapText: false,
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: BORDER } },
        right: { style: "hair", color: { argb: BORDER } },
      };
      if (rIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
      }
    });
    row.height = 18;
  });

  // ---------- Totais ----------
  const totalRowIdx = firstDataRow + rows.length;
  const totalRow = ws.getRow(totalRowIdx);
  columns.forEach((c, i) => {
    const cell = totalRow.getCell(i + 1);
    if (i === 0) {
      cell.value = "TOTAIS";
    } else if (c.footer && c.footer !== "none") {
      const nums = rows.map((r) => Number(r[c.key])).filter((n) => Number.isFinite(n));
      const soma = nums.reduce((s, n) => s + n, 0);
      const val =
        c.footer === "count"
          ? rows.length
          : c.footer === "avg"
            ? nums.length
              ? soma / nums.length
              : 0
            : soma;
      cell.value = val;
      const fmt = numFmt(c.format);
      if (fmt) cell.numFmt = fmt;
    } else {
      cell.value = null;
    }
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRAND_DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
    cell.alignment = {
      vertical: "middle",
      horizontal:
        i === 0
          ? "left"
          : c.format === "brl" || c.format === "int" || c.format === "pct"
            ? "right"
            : "left",
      indent: i === 0 ? 1 : 0,
    };
    cell.border = {
      top: { style: "medium", color: { argb: TOTAL_BORDER } },
      bottom: { style: "medium", color: { argb: TOTAL_BORDER } },
    };
  });
  totalRow.height = 22;

  // Rodapé discreto
  const footerRowIdx = totalRowIdx + 2;
  ws.mergeCells(footerRowIdx, 1, footerRowIdx, totalCols);
  const footer = ws.getCell(footerRowIdx, 1);
  footer.value = `Agilliza · Gerado em ${new Date().toLocaleString("pt-BR")}`;
  footer.font = { name: "Calibri", size: 9, italic: true, color: { argb: META_TEXT } };
  footer.alignment = { horizontal: "right" };

  // ---------- Larguras ----------
  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    const headerLen = c.label.length;
    const sampleLen = rows.slice(0, 60).reduce((m, r) => {
      const s = formatCell(r[c.key], c.format);
      return Math.max(m, s.length);
    }, 0);
    const isMoney = c.format === "brl";
    col.width = Math.min(Math.max(headerLen + 2, sampleLen + 2, isMoney ? 16 : 12), 44);
  });

  // ---------- Filtros ----------
  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: totalRowIdx - 1 > headerRowIdx ? totalRowIdx - 1 : headerRowIdx, column: totalCols },
  };

  // ---------- Impressão ----------
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    printTitlesRow: `${headerRowIdx}:${headerRowIdx}`,
  };
  ws.headerFooter = {
    oddHeader: `&L&B${titulo}&R&D`,
    oddFooter: `&LAgilliza&RPágina &P de &N`,
  };

  // Zoom confortável
  ws.views = [
    {
      state: "frozen",
      ySplit: headerRowIdx,
      xSplit: 0,
      zoomScale: 100,
      showGridLines: false,
    },
  ];

  // Silencia lint sobre variável utilizada (letra da última coluna reservada para futuros ranges).
  void lastColLetter;

  // ---------- Download ----------
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Geração de planilhas consolidadas e formatadas (XLSX) do módulo de
 * Comparativo de dados — identidade visual Agilliza.
 *
 * Usa ExcelJS (o `xlsx` community não grava estilos), com capa/resumo,
 * cabeçalho azul, zebra, filtros, painéis congelados, totais e impressão
 * já configurada.
 */
import ExcelJS from "exceljs";

import type { AbaXlsx, ColunaXlsx, TipoColuna } from "./xlsx-tipos";

export { abaResumo } from "./xlsx-tipos";
export type { AbaXlsx, ColunaXlsx, TipoColuna } from "./xlsx-tipos";

// Paleta Agilliza (ARGB literal — XLSX não entende tokens CSS).
const BRAND = "FF000F9F";
const BRAND_DARK = "FF000A66";
const ZEBRA = "FFEAF0FF";
const TOTAL_BG = "FFE6EBFF";
const TEXTO = "FF1F2937";
const META = "FF475569";
const BORDA = "FFD8DEE9";
const BRANCO = "FFFFFFFF";

const FORMATO: Record<TipoColuna, string | undefined> = {
  texto: undefined,
  brl: '"R$" #,##0.00;[Red]-"R$" #,##0.00;"—"',
  data: "dd/mm/yyyy",
  int: "#,##0",
  pct: '0.0"%"',
};

function ehNumerica(tipo: TipoColuna) {
  return tipo === "brl" || tipo === "int" || tipo === "pct";
}

function valorExcel(v: unknown, tipo: TipoColuna): string | number | Date | null {
  if (v == null || v === "") return null;
  if (ehNumerica(tipo)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : String(v);
  }
  if (tipo === "data") {
    const s = String(v).slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(`${s}T12:00:00Z`);
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d;
  }
  return String(v);
}

function largura(col: ColunaXlsx, linhas: Record<string, unknown>[]): number {
  if (col.width) return col.width;
  const maior = linhas.slice(0, 200).reduce((max, l) => {
    const v = l[col.key];
    return Math.max(max, v == null ? 0 : String(v).length);
  }, col.header.length);
  return Math.min(52, Math.max(col.tipo === "brl" ? 16 : 11, maior + 2));
}

function montarCapa(ws: ExcelJS.Worksheet, aba: AbaXlsx, titulo: string) {
  ws.mergeCells(1, 1, 1, 2);
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: BRANCO } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  ws.getRow(1).height = 32;

  ws.mergeCells(2, 1, 2, 2);
  const s = ws.getCell(2, 1);
  s.value = aba.subtitulo ?? `Gerado em ${new Date().toLocaleString("pt-BR")}`;
  s.font = { name: "Calibri", size: 10, italic: true, color: { argb: META } };
  s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(3).height = 8;

  aba.linhas.forEach((l, i) => {
    const row = ws.getRow(4 + i);
    const a = row.getCell(1);
    const b = row.getCell(2);
    a.value = String(l.rotulo ?? "");
    b.value = typeof l.valor === "number" ? l.valor : String(l.valor ?? "—");
    a.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRAND_DARK } };
    b.font = { name: "Calibri", size: 11, color: { argb: TEXTO } };
    a.alignment = { vertical: "middle", indent: 1 };
    b.alignment = { vertical: "middle", horizontal: typeof l.valor === "number" ? "right" : "left" };
    if (typeof l.valor === "number") b.numFmt = "#,##0";
    for (const c of [a, b]) {
      c.border = { bottom: { style: "hair", color: { argb: BORDA } } };
      if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    }
    row.height = 20;
  });

  ws.getColumn(1).width = aba.colunas[0]?.width ?? 40;
  ws.getColumn(2).width = aba.colunas[1]?.width ?? 28;
  ws.views = [{ state: "frozen", ySplit: 3, showGridLines: false }];
}

function montarTabela(ws: ExcelJS.Worksheet, aba: AbaXlsx, titulo: string) {
  const nCol = Math.max(aba.colunas.length, 1);

  ws.mergeCells(1, 1, 1, nCol);
  const t = ws.getCell(1, 1);
  t.value = `${titulo} — ${aba.nome}`;
  t.font = { name: "Calibri", size: 14, bold: true, color: { argb: BRANCO } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, nCol);
  const s = ws.getCell(2, 1);
  s.value = aba.subtitulo ?? `${aba.linhas.length} registro(s)`;
  s.font = { name: "Calibri", size: 10, color: { argb: META } };
  s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(3).height = 6;

  const headerIdx = 4;
  const header = ws.getRow(headerIdx);
  aba.colunas.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = {
      vertical: "middle",
      horizontal: ehNumerica(c.tipo ?? "texto") ? "right" : "left",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: BRAND_DARK } },
      bottom: { style: "medium", color: { argb: BRAND_DARK } },
      left: { style: "thin", color: { argb: BRAND_DARK } },
      right: { style: "thin", color: { argb: BRAND_DARK } },
    };
  });
  header.height = 26;

  const primeira = headerIdx + 1;
  aba.linhas.forEach((l, r) => {
    const row = ws.getRow(primeira + r);
    aba.colunas.forEach((c, i) => {
      const tipo = c.tipo ?? "texto";
      const cell = row.getCell(i + 1);
      const v = valorExcel(l[c.key], tipo);
      cell.value = v === null ? "—" : v;
      const fmt = FORMATO[tipo];
      if (fmt && v !== null && typeof v !== "string") cell.numFmt = fmt;
      cell.font = { name: "Calibri", size: 10, color: { argb: TEXTO } };
      cell.alignment = {
        vertical: "middle",
        horizontal: ehNumerica(tipo) ? "right" : "left",
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: BORDA } },
        right: { style: "hair", color: { argb: BORDA } },
      };
      if (r % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    });
    row.height = 18;
  });

  // Totais (apenas se houver colunas somáveis e linhas).
  const temTotais = aba.linhas.length > 0 && aba.colunas.some((c) => c.total || c.tipo === "brl");
  const totalIdx = primeira + aba.linhas.length;
  if (temTotais) {
    const row = ws.getRow(totalIdx);
    aba.colunas.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const modo = c.total ?? (c.tipo === "brl" ? "sum" : undefined);
      if (i === 0) {
        cell.value = "TOTAIS";
      } else if (modo === "count") {
        cell.value = aba.linhas.length;
        cell.numFmt = FORMATO.int ?? "#,##0";
      } else if (modo === "sum") {
        const soma = aba.linhas.reduce((s, l) => {
          const n = Number(l[c.key]);
          return Number.isFinite(n) ? s + n : s;
        }, 0);
        cell.value = soma;
        cell.numFmt = FORMATO[c.tipo ?? "int"] ?? "#,##0";

      } else {
        cell.value = null;
      }
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRAND_DARK } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
      cell.alignment = {
        vertical: "middle",
        horizontal: i === 0 ? "left" : ehNumerica(c.tipo ?? "texto") ? "right" : "left",
        indent: i === 0 ? 1 : 0,
      };
      cell.border = {
        top: { style: "medium", color: { argb: BRAND } },
        bottom: { style: "medium", color: { argb: BRAND } },
      };
    });
    row.height = 22;
  }

  aba.colunas.forEach((c, i) => {
    ws.getColumn(i + 1).width = largura(c, aba.linhas);
  });

  if (aba.linhas.length) {
    ws.autoFilter = {
      from: { row: headerIdx, column: 1 },
      to: { row: primeira + aba.linhas.length - 1, column: nCol },
    };
  }

  ws.views = [{ state: "frozen", ySplit: headerIdx, xSplit: 0, showGridLines: false }];
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    printTitlesRow: `${headerIdx}:${headerIdx}`,
  };
  ws.headerFooter = {
    oddHeader: `&L&B${titulo} — ${aba.nome}&R&D`,
    oddFooter: `&LAgilliza&RPágina &P de &N`,
  };
}

/** Escreve o arquivo consolidado e formatado. */
export async function baixarXlsx(
  nomeArquivo: string,
  abas: AbaXlsx[],
  titulo = "Comparativo de dados",
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agilliza";
  wb.company = "Agilliza";
  wb.created = new Date();

  for (const aba of abas) {
    const nome = aba.nome.slice(0, 31).replace(/[\\/*?:[\]]/g, "-");
    const ws = wb.addWorksheet(nome, { properties: { defaultRowHeight: 18 } });
    if (aba.capa) montarCapa(ws, aba, titulo);
    else montarTabela(ws, aba, titulo);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo.endsWith(".xlsx") ? nomeArquivo : `${nomeArquivo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

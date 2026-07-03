import * as XLSX from "xlsx";
import type { ReportColumn, ReportRow } from "@/lib/relatorios/shared";
import { formatCell, footerValue } from "@/lib/relatorios/report-format";

/** Exporta a tabela detalhada em XLSX com colunas formatadas e linha de totais. */
export function exportXLSX(
  nomeArquivo: string,
  titulo: string,
  meta: string[],
  columns: ReportColumn[],
  rows: ReportRow[],
) {
  const header = columns.map((c) => c.label);
  const body = rows.map((r) => columns.map((c) => formatCell(r[c.key], c.format)));
  const totais = columns.map((c, i) => (i === 0 ? "TOTAIS" : footerValue(rows, c)));

  const aoa: (string | number)[][] = [[titulo], meta, [], header, ...body, totais];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.label.length + 2, 16) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
}

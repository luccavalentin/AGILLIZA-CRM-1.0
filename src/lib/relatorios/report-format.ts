import type { ReportColumn, ReportCell } from "@/lib/relatorios/shared";
import { formatBRL } from "@/lib/simulacao/format";
import { formatData } from "@/lib/financeiro/format";

/** Formata uma célula conforme o tipo da coluna (uso em tabela, PDF e XLSX). */
export function formatCell(value: ReportCell, format?: ReportColumn["format"]): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (format) {
    case "brl":
      return formatBRL(Number(value));
    case "int":
      return Number(value).toLocaleString("pt-BR");
    case "pct":
      return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    case "date":
      return formatData(String(value));
    default:
      return String(value);
  }
}

/** Calcula o valor de rodapé (soma/média/contagem) de uma coluna numérica. */
export function footerValue(rows: Record<string, ReportCell>[], col: ReportColumn): string {
  if (!col.footer || col.footer === "none") return "";
  const nums = rows.map((r) => Number(r[col.key])).filter((n) => Number.isFinite(n));
  if (col.footer === "count") return rows.length.toLocaleString("pt-BR");
  const soma = nums.reduce((s, n) => s + n, 0);
  const val = col.footer === "avg" ? (nums.length ? soma / nums.length : 0) : soma;
  return formatCell(val, col.format);
}

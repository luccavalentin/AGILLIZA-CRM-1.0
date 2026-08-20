/**
 * Geração de PDF dos comparativos (lote banco × sistema e planilhas × planilhas).
 * Reaproveita o layout institucional dos relatórios (cabeçalho, KPIs e tabela).
 */
import { exportPDF } from "@/lib/relatorios/report-pdf";
import type { ReportColumn, ReportKpi, ReportRow } from "@/lib/relatorios/shared";

export type ModoSaida = "download" | "print";

export interface SecaoPdf {
  titulo: string;
  linhas: ReportRow[];
}

/** Gera (ou imprime) o PDF de um comparativo. */
export function gerarPdfComparativo(opcoes: {
  titulo: string;
  descricao: string;
  meta: string[];
  kpis: ReportKpi[];
  colunas: ReportColumn[];
  linhas: ReportRow[];
  arquivo: string;
  modo: ModoSaida;
}) {
  const { titulo, descricao, meta, kpis, colunas, linhas, arquivo, modo } = opcoes;
  exportPDF(
    titulo,
    descricao,
    meta,
    kpis,
    colunas,
    linhas,
    arquivo,
    undefined,
    undefined,
    undefined,
    "landscape",
    undefined,
    modo,
  );
}

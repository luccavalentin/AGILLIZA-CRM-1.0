/**
 * Exportação Word (.doc) institucional Agilliza.
 * Gera um documento HTML compatível com Microsoft Word contendo a logo,
 * faixa de cabeçalho, painel de contexto, KPIs e a tabela formatada.
 */
import type { ReportColumn, ReportRow, ReportKpi } from "@/lib/relatorios/shared";
import { formatCell, footerValue } from "@/lib/relatorios/report-format";
import { AGILLIZA_LOGO_LIGHT } from "@/lib/relatorios/brand-logo";

const AZUL = "#000F9F";
const CORAL = "#FF5A45";
const BORDA = "#D8DEE9";
const ZEBRA = "#F3F6FF";

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Exporta a relação em Word (.doc) com a identidade visual da Agilliza. */
export function exportDOCX(
  titulo: string,
  descricao: string,
  meta: string[],
  kpis: ReportKpi[],
  columns: ReportColumn[],
  rows: ReportRow[],
  filename = "agilliza-relatorio",
  orientation: "landscape" | "portrait" = "landscape",
) {
  const emitidoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const kpiHtml = kpis.length
    ? `<table class="kpis"><tr>${kpis
        .map(
          (k) => `<td class="kpi">
            <div class="kpi-label">${esc(k.label)}</div>
            <div class="kpi-valor">${esc(k.valor)}</div>
            ${k.hint ? `<div class="kpi-hint">${esc(k.hint)}</div>` : ""}
          </td>`,
        )
        .join("")}</tr></table>`
    : "";

  const temRodape = columns.some((c) => c.footer);
  const rodapeHtml = temRodape
    ? `<tr class="totais">${columns
        .map(
          (c) =>
            `<td class="${c.align === "right" ? "right" : ""}">${
              c.footer ? esc(footerValue(rows, c)) : c === columns[0] ? "Totais" : ""
            }</td>`,
        )
        .join("")}</tr>`
    : "";

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8" /><title>${esc(titulo)}</title>
<style>
  @page { size: A4 ${orientation}; margin: 1.6cm 1.4cm; }
  body { font-family: Calibri, Arial, sans-serif; color:#1E293B; font-size:10pt; }
  .header { background:${AZUL}; color:#fff; padding:14px 16px; border-bottom:4px solid ${CORAL}; }
  .header img { height:34px; }
  .header h1 { font-size:17pt; margin:8px 0 2px; color:#fff; }
  .header p { margin:0; font-size:9pt; color:#DDE4FF; }
  .meta { margin:10px 0 14px; font-size:8.5pt; color:#475569; }
  .kpis { width:100%; border-collapse:separate; border-spacing:6px 0; margin-bottom:14px; }
  .kpi { border:1px solid ${BORDA}; border-left:3px solid ${AZUL}; padding:8px 10px; }
  .kpi-label { font-size:8pt; color:#64748B; text-transform:uppercase; letter-spacing:.06em; }
  .kpi-valor { font-size:13pt; font-weight:bold; color:${AZUL}; }
  .kpi-hint { font-size:8pt; color:#64748B; }
  table.dados { width:100%; border-collapse:collapse; }
  table.dados th { background:${AZUL}; color:#fff; font-size:8.5pt; text-align:left;
    padding:6px 8px; border:1px solid ${AZUL}; text-transform:uppercase; letter-spacing:.04em; }
  table.dados td { border:1px solid ${BORDA}; padding:5px 8px; font-size:9pt; }
  table.dados tr.zebra td { background:${ZEBRA}; }
  table.dados tr.totais td { background:#E6EBFF; font-weight:bold; border-top:2px solid ${AZUL}; }
  .right { text-align:right; }
  .rodape { margin-top:14px; font-size:8pt; color:#64748B; border-top:1px solid ${BORDA}; padding-top:6px; }
</style></head>
<body>
  <div class="header">
    <img src="${AGILLIZA_LOGO_LIGHT}" alt="Agilliza" />
    <h1>${esc(titulo)}</h1>
    <p>${esc(descricao)}</p>
  </div>
  <div class="meta">${[...meta, `Emitido em ${emitidoEm}`].map(esc).join(" &nbsp;·&nbsp; ")}</div>
  ${kpiHtml}
  <table class="dados">
    <thead><tr>${columns
      .map((c) => `<th class="${c.align === "right" ? "right" : ""}">${esc(c.label)}</th>`)
      .join("")}</tr></thead>
    <tbody>
      ${rows
        .map(
          (r, i) =>
            `<tr class="${i % 2 ? "zebra" : ""}">${columns
              .map(
                (c) =>
                  `<td class="${c.align === "right" ? "right" : ""}">${esc(
                    formatCell(r[c.key], c.format),
                  )}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")}
      ${rodapeHtml}
    </tbody>
  </table>
  <p class="rodape">Agilliza · Documento gerado automaticamente pelo sistema · ${rows.length} registro(s)</p>
</body></html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.doc`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Exporta a relação em CSV (compatível com Excel pt-BR). */
export function exportCSV(
  columns: ReportColumn[],
  rows: ReportRow[],
  filename = "agilliza-relatorio",
) {
  const sep = ";";
  const linha = (vals: string[]) =>
    vals.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(sep);
  const conteudo = [
    linha(columns.map((c) => c.label)),
    ...rows.map((r) => linha(columns.map((c) => formatCell(r[c.key], c.format)))),
  ].join("\r\n");
  const blob = new Blob(["\ufeff", conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

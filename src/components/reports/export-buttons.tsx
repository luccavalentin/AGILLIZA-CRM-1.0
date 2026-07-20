import { useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registrarExport } from "@/lib/relatorios/reports.functions";
import type { ReportResult, ReportFiltros } from "@/lib/relatorios/shared";

/** Botões de exportação PDF/XLSX que registram histórico e auditoria. */
export function ExportButtons({
  codigo,
  result,
  meta,
  filtros,
}: {
  codigo: string;
  result: ReportResult;
  meta: string[];
  filtros: ReportFiltros;
}) {
  const [busy, setBusy] = useState(false);
  const registrar = useServerFn(registrarExport);

  async function log(formato: string) {
    try {
      await registrar({
        data: {
          codigo,
          formato,
          registros: result.rows.length,
          filtros: filtros as unknown as Record<string, unknown>,
        },
      });
    } catch {
      /* auditoria best-effort */
    }
  }

  async function onPDF() {
    setBusy(true);
    try {
      const { exportPDF } = await import("@/lib/relatorios/report-pdf");
      // Auto-orienta: até 7 colunas cabem em retrato; acima disso, paisagem para não cortar.
      const orient: "landscape" | "portrait" =
        result.columns.length > 7 ? "landscape" : "portrait";
      exportPDF(
        result.titulo,
        result.descricao,
        meta,
        result.kpis,
        result.columns,
        result.rows,
        undefined,
        undefined,
        undefined,
        undefined,
        orient,
      );
      await log("pdf");
    } catch (e) {
      console.error("[exportPDF]", e);
      toast.error("Falha ao gerar PDF.");

    } finally {
      setBusy(false);
    }
  }


  async function onXLSX() {
    setBusy(true);
    try {
      const { exportXLSX } = await import("@/lib/relatorios/report-xlsx");
      exportXLSX(codigo, result.titulo, meta, result.columns, result.rows);
      await log("xlsx");
    } catch {
      toast.error("Falha ao gerar XLSX.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onPDF} disabled={busy}>
        <FileText className="mr-1.5 h-3.5 w-3.5 opacity-70" /> PDF
      </Button>
      <Button variant="outline" size="sm" onClick={onXLSX} disabled={busy}>
        <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 opacity-70" /> XLSX
      </Button>
    </div>
  );
}

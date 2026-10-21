import { useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registrarExport } from "@/lib/relatorios/reports.functions";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import type { ReportResult, ReportFiltros } from "@/lib/relatorios/shared";

/**
 * Botões de exportação PDF/XLSX que registram histórico e auditoria.
 *
 * Os dados já estão na tela, então o arquivo nasce no navegador. Por isso o
 * registro vem ANTES do arquivo: é ele que confere a permissão "Exportar" no
 * servidor. Sem ela, o botão nem aparece; se aparecer por cache velho, o
 * servidor recusa e o arquivo não é gerado.
 */
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
  const podeExportar = usePermissao("relatorios.geral", "export");

  async function autorizar(formato: string): Promise<boolean> {
    try {
      await registrar({
        data: {
          codigo,
          formato,
          registros: result.rows.length,
          filtros: filtros as unknown as Record<string, unknown>,
        },
      });
      return true;
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível exportar."));
      return false;
    }
  }

  // Slug amigável (sem acentos) para nome de arquivo, preservando palavras.
  function slug(s: string) {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function nomeArquivo() {
    const partes: string[] = [result.titulo];
    if (filtros.status) {
      const labelStatus =
        result.filtrosDisponiveis?.statuses?.find((s) => s.value === filtros.status)?.label ??
        filtros.status;
      partes.push(labelStatus);
    }
    return `agilliza-${partes.map(slug).filter(Boolean).join("-")}`;
  }

  async function onPDF() {
    setBusy(true);
    try {
      if (!(await autorizar("pdf"))) return;
      const { exportPDF } = await import("@/lib/relatorios/report-pdf");
      // Auto-orienta: até 7 colunas cabem em retrato; acima disso, paisagem para não cortar.
      const orient: "landscape" | "portrait" = result.columns.length > 7 ? "landscape" : "portrait";
      exportPDF(
        result.titulo,
        result.descricao,
        meta,
        result.kpis,
        result.columns,
        result.rows,
        nomeArquivo(),
        undefined,
        undefined,
        undefined,
        orient,
      );
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
      if (!(await autorizar("xlsx"))) return;
      const { exportXLSX } = await import("@/lib/relatorios/report-xlsx");
      await exportXLSX(codigo, result.titulo, meta, result.columns, result.rows);
    } catch {
      toast.error("Falha ao gerar XLSX.");
    } finally {
      setBusy(false);
    }
  }

  if (!podeExportar) return null;

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

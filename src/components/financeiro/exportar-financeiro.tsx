import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileType2,
  Loader2,
  Printer,
  Table2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReportColumn, ReportRow, ReportKpi } from "@/lib/relatorios/shared";

export interface ExportarFinanceiroProps {
  titulo: string;
  descricao: string;
  /** Linhas de contexto (filtros, período, escopo) impressas no cabeçalho. */
  meta?: string[];
  kpis?: ReportKpi[];
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Nome base do arquivo (sem extensão). Padrão: derivado do título. */
  arquivo?: string;
  orientation?: "landscape" | "portrait";
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default";
  className?: string;
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

/**
 * Botão único de exportação para qualquer tela do Financeiro:
 * PDF, Excel, Word, CSV e impressão — todos com logo, cores e formatação Agilliza.
 */
export function ExportarFinanceiro({
  titulo,
  descricao,
  meta = [],
  kpis = [],
  columns,
  rows,
  arquivo,
  orientation = "landscape",
  variant = "outline",
  size = "sm",
  className,
}: ExportarFinanceiroProps) {
  const [busy, setBusy] = useState(false);
  const nome = arquivo ?? `agilliza-${slug(titulo)}-${new Date().toISOString().slice(0, 10)}`;
  const metaFinal = [...meta, `${rows.length} registro(s)`];

  function semDados() {
    if (rows.length === 0) {
      toast.error("Não há dados na relação atual para exportar.");
      return true;
    }
    return false;
  }

  async function run(tarefa: () => Promise<void> | void, erro: string) {
    if (semDados()) return;
    setBusy(true);
    try {
      await tarefa();
    } catch (e) {
      console.error("[financeiro:export]", e);
      toast.error(erro);
    } finally {
      setBusy(false);
    }
  }

  const gerarPDF = (modo: "download" | "print") =>
    run(async () => {
      const { exportPDF } = await import("@/lib/relatorios/report-pdf");
      exportPDF(
        titulo,
        descricao,
        metaFinal,
        kpis,
        columns,
        rows,
        nome,
        undefined,
        undefined,
        undefined,
        orientation,
        undefined,
        modo,
      );
    }, modo === "print" ? "Falha ao abrir a impressão." : "Falha ao gerar o PDF.");

  const gerarXLSX = () =>
    run(async () => {
      const { exportXLSX } = await import("@/lib/relatorios/report-xlsx");
      await exportXLSX(nome, titulo, metaFinal, columns, rows);
      toast.success("Planilha gerada.");
    }, "Falha ao gerar a planilha.");

  const gerarDOC = () =>
    run(async () => {
      const { exportDOCX } = await import("@/lib/relatorios/report-docx");
      exportDOCX(titulo, descricao, metaFinal, kpis, columns, rows, nome, orientation);
      toast.success("Documento Word gerado.");
    }, "Falha ao gerar o documento Word.");

  const gerarCSV = () =>
    run(async () => {
      const { exportCSV } = await import("@/lib/relatorios/report-docx");
      exportCSV(columns, rows, nome);
    }, "Falha ao gerar o CSV.");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={busy} className={className}>
          {busy ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 size-4 opacity-70" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {titulo}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void gerarPDF("download")}>
          <FileText className="mr-2 size-4 text-destructive" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void gerarXLSX()}>
          <FileSpreadsheet className="mr-2 size-4 text-emerald-600" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void gerarDOC()}>
          <FileType2 className="mr-2 size-4 text-blue-600" /> Word (.doc)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void gerarCSV()}>
          <Table2 className="mr-2 size-4 text-muted-foreground" /> CSV
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void gerarPDF("print")}>
          <Printer className="mr-2 size-4 text-muted-foreground" /> Imprimir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

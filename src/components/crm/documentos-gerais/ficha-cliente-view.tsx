import { ChevronRight, ClipboardList, FileText, FolderOpen, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentosTab } from "@/components/crm/documentos-tab";
import { FichaDialog } from "./ficha-dialog";
import { titulo } from "./helpers";
import type { DGCliente } from "@/lib/crm/documentos-gerais.functions";

export function FichaClienteView({
  cliente,
  fichaAberta,
  onVoltar,
  onAbrirFicha,
  onFecharFicha,
}: {
  cliente: DGCliente;
  fichaAberta: boolean;
  onVoltar: () => void;
  onAbrirFicha: () => void;
  onFecharFicha: (open: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button className="hover:text-foreground" onClick={onVoltar}>
          Documentos Gerais
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{titulo(cliente.nome)}</span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm">
        <span className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg ring-1 ring-inset ring-primary/30">
              <FolderOpen className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">
                {titulo(cliente.nome)}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {cliente.numero_cliente && (
                  <span className="inline-flex items-center gap-1">
                    <IdCard className="h-3 w-3" /> {cliente.numero_cliente}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {cliente.total_documentos} documento(s)
                </span>
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={onAbrirFicha}
            className="group relative w-full overflow-hidden bg-gradient-to-r from-primary to-primary/80 shadow-md transition-all hover:shadow-lg hover:brightness-110 sm:w-auto"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <ClipboardList className="mr-2 h-4 w-4" /> Consultar ficha
          </Button>
        </div>
      </div>

      <DocumentosTab clienteId={cliente.cliente_id} />

      <FichaDialog
        clienteId={cliente.cliente_id}
        clienteNome={cliente.nome}
        open={fichaAberta}
        onOpenChange={onFecharFicha}
      />
    </div>
  );
}

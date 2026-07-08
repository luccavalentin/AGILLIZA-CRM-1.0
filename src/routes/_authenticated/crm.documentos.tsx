import { createFileRoute } from "@tanstack/react-router";
import { FolderTree } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { DocumentosGerais } from "@/components/crm/documentos-gerais";

export const Route = createFileRoute("/_authenticated/crm/documentos")({
  head: () => ({ meta: [{ title: "Documentos Gerais — CRM — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
});

function Pagina() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-gradient-to-r from-primary/8 via-card to-card p-5 shadow-sm">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-inner">
          <FolderTree className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Documentos Gerais
          </h1>
          <p className="text-sm text-muted-foreground">
            Organizados por Comercial → Imobiliária → Corretor → Cliente, com a
            documentação de cada cliente.
          </p>
        </div>
      </div>
      <DocumentosGerais />
    </div>
  );
}

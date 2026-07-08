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
      <div className="flex items-center gap-2">
        <FolderTree className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Documentos Gerais</h1>
          <p className="text-sm text-muted-foreground">
            Pastas por Imobiliária, Corretor e Comercial, com a documentação de cada cliente.
          </p>
        </div>
      </div>
      <DocumentosGerais />
    </div>
  );
}

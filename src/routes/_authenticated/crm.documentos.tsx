import { createFileRoute } from "@tanstack/react-router";
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
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">
      <DocumentosGerais />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { DocumentosDeClientes } from "@/components/crm/documentos-clientes/documentos-clientes";

export const Route = createFileRoute("/_authenticated/crm/documentos")({
  head: () => ({ meta: [{ title: "Documentos de clientes — Agilliza" }] }),
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
    <div className="mx-auto w-full max-w-[1400px] p-3 sm:p-4 md:p-6">
      <DocumentosDeClientes />
    </div>
  );
}

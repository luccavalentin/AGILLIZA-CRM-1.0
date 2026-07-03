import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClienteForm } from "@/components/crm/cliente-form";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/crm/clientes_/novo")({
  head: () => ({ meta: [{ title: "Novo cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/crm/clientes"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Novo cliente</h1>
      </div>
      <ClienteForm />
    </div>
  );
}

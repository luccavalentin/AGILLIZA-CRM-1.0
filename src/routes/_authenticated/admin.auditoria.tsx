import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.auditoria"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={ShieldCheck} titulo="Auditoria" descricao="Trilha de auditoria e acessos." />
  );
}

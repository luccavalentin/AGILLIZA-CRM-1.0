import { createFileRoute, Outlet } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/formularios")({
  // Mesma permissão do item no menu (QA 19/09/2026).
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  head: () => ({ meta: [{ title: "Formulários — Agilliza" }] }),
  component: () => <Outlet />,
});

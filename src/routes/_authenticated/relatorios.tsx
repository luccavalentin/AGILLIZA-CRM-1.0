import { createFileRoute, Outlet } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("relatorios.geral"),
  component: () => <Outlet />,
});

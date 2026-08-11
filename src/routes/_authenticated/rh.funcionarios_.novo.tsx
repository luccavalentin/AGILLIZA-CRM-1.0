import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { FuncionarioForm } from "@/components/rh/funcionario-form";

export const Route = createFileRoute("/_authenticated/rh/funcionarios_/novo")({
  head: () => ({ meta: [{ title: "Novo funcionário — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.funcionarios"),
  component: () => <FuncionarioForm />,
});

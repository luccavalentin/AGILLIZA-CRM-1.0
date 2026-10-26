import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { FuncionarioForm } from "@/components/rh/funcionario-form";

// Admissão guiada: dados pessoais → endereço → contrato e cargo → remuneração e banco
// (só com RH · Salários · alterar) → revisão; depois, o checklist de documentos na ficha.
export const Route = createFileRoute("/_authenticated/rh/funcionarios_/novo")({
  head: () => ({ meta: [{ title: "Admissão — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.funcionarios"),
  component: () => <FuncionarioForm modo="admissao" />,
});

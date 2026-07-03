import { createFileRoute } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/operacional/tarefas")({
  head: () => ({ meta: [{ title: "Tarefas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.tarefas"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={ListChecks} titulo="Tarefas" descricao="Tarefas e pendências da esteira." />
  );
}

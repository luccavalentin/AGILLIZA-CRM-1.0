import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/regras-modulos")({
  head: () => ({ meta: [{ title: "Regras & Módulos — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.regras"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={SlidersHorizontal} titulo="Regras & Módulos" descricao="Matriz de permissões por nível de acesso." />
  );
}

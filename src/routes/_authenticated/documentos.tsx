import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [{ title: "Documentos — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("documentos.arquivos"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={FolderOpen} titulo="Documentos" descricao="Arquivos e documentação dos processos." />
  );
}

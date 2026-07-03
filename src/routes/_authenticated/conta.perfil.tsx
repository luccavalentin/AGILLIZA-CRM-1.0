import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";

export const Route = createFileRoute("/_authenticated/conta/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={UserRound} titulo="Meu perfil" descricao="Seus dados pessoais e preferências." />
  );
}

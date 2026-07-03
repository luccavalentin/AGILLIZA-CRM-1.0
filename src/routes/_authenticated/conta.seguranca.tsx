import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";

export const Route = createFileRoute("/_authenticated/conta/seguranca")({
  head: () => ({ meta: [{ title: "Segurança — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={Lock} titulo="Segurança" descricao="Senha, sessões e autenticação." />
  );
}

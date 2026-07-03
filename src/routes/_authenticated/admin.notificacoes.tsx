import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.notificacoes"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={Bell} titulo="Notificações" descricao="Central de notificações do sistema." />
  );
}

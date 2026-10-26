import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationSettings } from "@/components/shared/notification-settings";
import { ContaCabecalho } from "@/components/conta/conta-cabecalho";

export const Route = createFileRoute("/_authenticated/conta/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Agilliza" }] }),
  component: Pagina,
});

/** Conta > Notificações (C69): mesmo cabeçalho e abas de Meus dados e Segurança. */
function Pagina() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <ContaCabecalho
        pagina="notificacoes"
        acoes={
          <Button asChild variant="outline" size="sm">
            <Link to={"/admin/notificacoes" as string}>
              Ver notificações <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />
      {/* As preferências já vêm em cartões próprios (notification-settings.tsx). */}
      <NotificationSettings />
    </div>
  );
}

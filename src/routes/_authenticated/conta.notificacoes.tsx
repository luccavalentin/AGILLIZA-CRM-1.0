import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationSettings } from "@/components/shared/notification-settings";

export const Route = createFileRoute("/_authenticated/conta/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Configurações de notificação</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={"/admin/notificacoes" as string}>
            Ver notificações <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Defina quais alertas você quer receber e quais devem tocar som. As preferências valem neste
        navegador.
      </p>
      <NotificationSettings />
    </div>
  );
}

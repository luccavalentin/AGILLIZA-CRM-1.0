import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/sem-acesso")({
  head: () => ({ meta: [{ title: "Acesso negado — Agilliza" }] }),
  component: SemAcessoPage,
});

function SemAcessoPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Você não tem permissão para acessar esta área. Fale com o administrador do seu ecossistema
          se precisar de acesso.
        </p>
      </div>
      <Button asChild>
        <Link to={"/dashboard" as string}>Voltar ao início</Link>
      </Button>
    </div>
  );
}

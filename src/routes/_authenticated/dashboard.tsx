import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import { getMinhaSessao } from "@/lib/session.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Visão Geral — Agilliza" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useQuery({ queryKey: ["minha-sessao"], queryFn: () => getMinhaSessao() });
  const nome = data?.profile?.nome?.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
          <LayoutDashboard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {nome ? `Olá, ${nome}` : "Visão Geral"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Bem-vindo ao painel do correspondente. Use o menu para navegar.
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-background px-6 py-16 text-center">
        <p className="text-base font-medium text-foreground">Indicadores em breve</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Os painéis de simulações, propostas e comissões serão habilitados nas próximas etapas.
        </p>
      </div>
    </div>
  );
}

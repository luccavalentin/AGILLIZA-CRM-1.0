import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  TrendingUp,
  Calculator,
  FileText,
  Users,
  Inbox,
  ListChecks,
  Wallet,
  Percent,
  Smartphone,
  Cog,
  Download,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";

interface Item {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

const grupos: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "Visão executiva",
    itens: [
      {
        to: "/relatorios/painel-geral",
        label: "Painel geral",
        desc: "Consolidado da produção",
        icon: LayoutDashboard,
      },
      {
        to: "/relatorios/gerencial",
        label: "Gerencial",
        desc: "Andamento, aprovadas e contratos",
        icon: TrendingUp,
      },
      {
        to: "/relatorios/consolidado",
        label: "Consolidado",
        desc: "Funil, bancos e evolução",
        icon: TrendingUp,
      },
      {
        to: "/relatorios/comerciais",
        label: "Comercial",
        desc: "Desempenho por responsável",
        icon: TrendingUp,
      },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      {
        to: "/relatorios/simulacoes",
        label: "Simulações",
        desc: "Volume e conversão",
        icon: Calculator,
      },
      { to: "/relatorios/propostas", label: "Propostas", desc: "Status e volumes", icon: FileText },
      {
        to: "/relatorios/operacionais",
        label: "Operacional",
        desc: "Execução operacional",
        icon: Cog,
      },
      { to: "/relatorios/demandas", label: "Demandas", desc: "SLA e conclusão", icon: Inbox },
      { to: "/relatorios/tarefas", label: "Tarefas", desc: "Prazos e execução", icon: ListChecks },
    ],
  },
  {
    titulo: "CRM & Cliente",
    itens: [
      { to: "/relatorios/crm", label: "CRM", desc: "Base de clientes", icon: Users },
      { to: "/relatorios/clientes", label: "Clientes", desc: "Cadastro e adesão", icon: Users },
      {
        to: "/relatorios/app-cliente",
        label: "App do Cliente",
        desc: "Adesão ao aplicativo",
        icon: Smartphone,
      },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { to: "/relatorios/financeiros", label: "Financeiro", desc: "Fluxo e saldo", icon: Wallet },
      { to: "/relatorios/comissoes", label: "Comissões", desc: "Previstas e pagas", icon: Percent },
    ],
  },
  {
    titulo: "Ferramentas",
    itens: [
      {
        to: "/relatorios/personalizados",
        label: "Personalizados",
        desc: "Monte seus relatórios",
        icon: Sparkles,
      },
      {
        to: "/relatorios/exportacoes",
        label: "Exportações",
        desc: "Histórico de downloads",
        icon: Download,
      },
    ],
  },
];

export const Route = createFileRoute("/_authenticated/relatorios/")({
  head: () => ({ meta: [{ title: "Relatórios — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <header className="border-b border-border pb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Central de relatórios
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight text-foreground">
          Relatórios gerenciais
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Análises completas em padrão ERP, com filtros, exportação e impressão.
        </p>
      </header>

      {grupos.map((g) => (
        <section key={g.titulo} className="space-y-3">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {g.titulo}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.itens.map((i) => (
              <Link key={i.to} to={i.to}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <i.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{i.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{i.desc}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

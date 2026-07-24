import { Users, Smartphone, Loader2, FileCheck2 } from "lucide-react";
import type { Portal, StatusF } from "./tipos";

type KpiStats = {
  total?: number;
  portal_ativo?: number;
  em_andamento?: number;
  cadastro_completo?: number;
};

type Props = {
  kpis: KpiStats | undefined;
  statusF: StatusF;
  portal: Portal;
  etapa: string;
  setStatusF: (v: StatusF) => void;
  setPortal: (v: Portal) => void;
  setEtapa: (v: string) => void;
  setPagina: (v: number) => void;
};

export function KpiCards({
  kpis,
  statusF,
  portal,
  etapa,
  setStatusF,
  setPortal,
  setEtapa,
  setPagina,
}: Props) {
  const cards: Array<{
    label: string;
    hint: string;
    valor: number | undefined;
    icon: React.ReactNode;
    onClick: () => void;
    active: boolean;
  }> = [
    {
      label: "Total de clientes",
      hint: "Ativos no sistema",
      valor: kpis?.total,
      icon: <Users className="size-3.5" />,
      onClick: () => {
        setPortal("todos");
        setStatusF("ativo");
        setEtapa("todas");
        setPagina(1);
      },
      active: statusF === "ativo" && portal === "todos" && etapa === "todas",
    },
    {
      label: "App ativo",
      hint: "Com acesso liberado",
      valor: kpis?.portal_ativo,
      icon: <Smartphone className="size-3.5" />,
      onClick: () => {
        setPortal("ativo");
        setPagina(1);
      },
      active: portal === "ativo",
    },
    {
      label: "Em andamento",
      hint: "Em etapas da esteira",
      valor: kpis?.em_andamento,
      icon: <Loader2 className="size-3.5" />,
      onClick: () => {
        setEtapa("simulacao");
        setPagina(1);
      },
      active: etapa === "simulacao",
    },
    {
      label: "Cadastro completo",
      hint: "100% preenchido",
      valor: kpis?.cadastro_completo,
      icon: <FileCheck2 className="size-3.5" />,
      onClick: () => {
        setEtapa("cadastro_completo");
        setPagina(1);
      },
      active: etapa === "cadastro_completo",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {cards.map((k) => (
        <button
          key={k.label}
          type="button"
          onClick={k.onClick}
          aria-pressed={k.active}
          className={`crm-focus-ring group relative overflow-hidden rounded-xl border px-3.5 py-3 text-left transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px hover:border-primary/40 hover:shadow-md active:translate-y-0 active:scale-[0.99] ${
            k.active
              ? "border-primary/50 bg-primary/[0.04] shadow-[inset_3px_0_0_0_hsl(var(--primary))] ring-1 ring-primary/10"
              : "border-border/60 bg-card"
          }`}
        >
          <div className="relative flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {k.label}
            </p>
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-md transition-all duration-200 ${
                k.active
                  ? "bg-primary/10 text-primary scale-105"
                  : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              }`}
            >
              {k.icon}
            </span>
          </div>
          <p
            className={`relative mt-1.5 text-2xl font-semibold leading-none tabular-nums transition-colors ${
              k.active ? "text-primary" : "text-foreground group-hover:text-primary"
            }`}
          >
            {k.valor ?? "—"}
          </p>
          <p className="relative mt-1 truncate text-[11px] text-muted-foreground">
            {k.hint}
          </p>
        </button>
      ))}
    </div>
  );
}

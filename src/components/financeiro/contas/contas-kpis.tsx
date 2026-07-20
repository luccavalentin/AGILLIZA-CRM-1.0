import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/financeiro/format";
import type { ContaTipo } from "@/lib/financeiro/financeiro.functions";

interface Resumo {
  totalValor?: number;
  totalQtd?: number;
  abertoValor?: number;
  abertoQtd?: number;
  pagoValor?: number;
  pagoQtd?: number;
  atrasadoValor?: number;
  atrasadoQtd?: number;
}

interface Kpi {
  label: string;
  valor: number;
  qtd: number;
  icon: LucideIcon;
  tint: string;
  ring: string;
}

/**
 * Grid de KPIs do topo. Constrói a lista a partir do resumo agregado
 * no servidor. Mantém o mesmo layout responsivo (2 col mobile, 4 col
 * desktop) da versão original.
 */
export function ContasKpis({ tipo, resumo }: { tipo: ContaTipo; resumo?: Resumo }) {
  const recebe = tipo === "receber";
  const kpis: Kpi[] = [
    {
      label: "Total no período",
      valor: resumo?.totalValor ?? 0,
      qtd: resumo?.totalQtd ?? 0,
      icon: Wallet,
      tint: "text-primary",
      ring: "bg-primary/10",
    },
    {
      label: recebe ? "A receber" : "A pagar",
      valor: resumo?.abertoValor ?? 0,
      qtd: resumo?.abertoQtd ?? 0,
      icon: recebe ? ArrowDownCircle : ArrowUpCircle,
      tint: "text-amber-600 dark:text-amber-400",
      ring: "bg-amber-500/10",
    },
    {
      label: recebe ? "Recebido" : "Pago",
      valor: resumo?.pagoValor ?? 0,
      qtd: resumo?.pagoQtd ?? 0,
      icon: CheckCircle2,
      tint: "text-emerald-600 dark:text-emerald-400",
      ring: "bg-emerald-500/10",
    },
    {
      label: "Em atraso",
      valor: resumo?.atrasadoValor ?? 0,
      qtd: resumo?.atrasadoQtd ?? 0,
      icon: AlertTriangle,
      tint: "text-rose-600 dark:text-rose-400",
      ring: "bg-rose-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <div
            key={k.label}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {k.label}
              </span>
              <span className={cn("grid h-8 w-8 place-items-center rounded-lg", k.ring, k.tint)}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className={cn("mt-3 text-lg font-semibold tabular-nums sm:text-xl", k.tint)}>
              {formatBRL(k.valor)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {k.qtd} {k.qtd === 1 ? "conta" : "contas"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

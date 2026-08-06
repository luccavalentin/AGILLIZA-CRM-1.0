import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { ReportKpiCard, type KpiTone } from "@/components/financeiro/kpi-card";
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

/**
 * Grid de KPIs do topo. Usa o ReportKpiCard compartilhado com o painel
 * financeiro para manter tipografia, barra tonal, ícone envidraçado e
 * paleta semântica alinhados ao restante do módulo.
 */
export function ContasKpis({
  tipo,
  resumo,
  onSelecionar,
}: {
  tipo: ContaTipo;
  resumo?: Resumo;
  /** Abre o detalhamento do card. `status` é o filtro equivalente no servidor. */
  onSelecionar?: (kpi: { titulo: string; status: string }) => void;
}) {
  const recebe = tipo === "receber";
  const qtdSub = (n: number) => `${n} ${n === 1 ? "conta" : "contas"}`;

  const kpis: Array<{
    titulo: string;
    valor: number;
    qtd: number;
    icon: typeof Wallet;
    tone: KpiTone;
    status: string;
  }> = [
    {
      titulo: "Total no período",
      valor: resumo?.totalValor ?? 0,
      qtd: resumo?.totalQtd ?? 0,
      icon: Wallet,
      tone: "brand",
      status: "",
    },
    {
      titulo: recebe ? "A receber" : "A pagar",
      valor: resumo?.abertoValor ?? 0,
      qtd: resumo?.abertoQtd ?? 0,
      icon: recebe ? ArrowDownCircle : ArrowUpCircle,
      tone: "warning",
      status: "aberta",
    },
    {
      titulo: recebe ? "Recebido" : "Pago",
      valor: resumo?.pagoValor ?? 0,
      qtd: resumo?.pagoQtd ?? 0,
      icon: CheckCircle2,
      tone: "success",
      status: "paga",
    },
    {
      titulo: "Em atraso",
      valor: resumo?.atrasadoValor ?? 0,
      qtd: resumo?.atrasadoQtd ?? 0,
      icon: AlertTriangle,
      tone: "danger",
      status: "atrasada",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k) => (
        <ReportKpiCard
          key={k.titulo}
          titulo={k.titulo}
          valor={formatBRL(k.valor)}
          icon={k.icon}
          tone={k.tone}
          sub={qtdSub(k.qtd)}
          onClick={
            onSelecionar ? () => onSelecionar({ titulo: k.titulo, status: k.status }) : undefined
          }
        />
      ))}
    </div>
  );
}


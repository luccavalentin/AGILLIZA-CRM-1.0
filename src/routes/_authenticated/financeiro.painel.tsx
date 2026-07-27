import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Wallet, LineChart as LineChartIcon, AlertTriangle, type LucideIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { assertModuloPermitido } from "@/lib/route-guards";
import { obterKpisFinanceiros, listarContas } from "@/lib/financeiro/financeiro.functions";
import { ReportKpiCard, type KpiTone } from "@/components/financeiro/kpi-card";
import { PanelHeader, SectionTitle, PanelCard } from "@/components/common/dashboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/financeiro/format";
import { KpiDrilldownDialog, type KpiDrillItem } from "@/components/reports/kpi-drilldown-dialog";

export const Route = createFileRoute("/_authenticated/financeiro/painel")({
  head: () => ({ meta: [{ title: "Painel financeiro — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.painel"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar o painel.</div>
  ),
});

function mesLabel(iso: string) {
  const [y, m] = iso.split("-");
  return `${m}/${y.slice(2)}`;
}

type KpiFinKey = "receber" | "pagar" | "saldo" | "inadimplencia";

function Pagina() {
  const padrao = useMemo(() => {
    const hoje = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: iso(hoje) };
  }, []);
  const [de, setDe] = useState(padrao.de);
  const [ate, setAte] = useState(padrao.ate);
  const [drill, setDrill] = useState<KpiFinKey | null>(null);
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["fin-kpis", de, ate],
    queryFn: () => obterKpisFinanceiros({ data: { de: de || undefined, ate: ate || undefined } }),
  });

  const listarContasFn = useServerFn(listarContas);
  const drillQuery = useQuery({
    enabled: !!drill,
    queryKey: ["fin-kpi-drill", drill, de, ate],
    queryFn: async () => {
      if (!drill) return { itens: [] as KpiDrillItem[] };
      const tipo: "pagar" | "receber" = drill === "pagar" ? "pagar" : "receber";
      const status = drill === "inadimplencia" ? "atrasada" : "aberta";
      const r = await listarContasFn({
        data: {
          tipo,
          status,
          pagina: 1,
          porPagina: 10,
          ...(drill === "inadimplencia" ? {} : { de, ate }),
        },
      });
      const itens: KpiDrillItem[] = r.itens.map((c) => ({
        label: c.contraparte ?? c.descricao ?? c.numero ?? "Sem descrição",
        sub: c.categoria_nome ?? c.descricao ?? undefined,
        valor: formatBRL(c.valor - c.valor_pago),
        data: new Date(c.vencimento + "T00:00:00").toLocaleDateString("pt-BR"),
        to: tipo === "pagar" ? "/financeiro/contas-a-pagar" : "/financeiro/contas-a-receber",
      }));
      return { itens };
    },
  });

  const drillMeta: Record<
    KpiFinKey,
    { titulo: string; subtitulo: string; valor: string; icon: LucideIcon; tone: KpiTone; to: string; empty: string }
  > = {
    receber: {
      titulo: "Contas a receber",
      subtitulo: "Próximos vencimentos no período",
      valor: formatBRL(data?.aReceber30d ?? 0),
      icon: TrendingUp,
      tone: "success",
      to: "/financeiro/contas-a-receber",
      empty: "Nenhum recebimento no período.",
    },
    pagar: {
      titulo: "Contas a pagar",
      subtitulo: "Próximos vencimentos no período",
      valor: formatBRL(data?.aPagar30d ?? 0),
      icon: Wallet,
      tone: "warning",
      to: "/financeiro/contas-a-pagar",
      empty: "Nenhum pagamento no período.",
    },
    saldo: {
      titulo: "Saldo projetado",
      subtitulo: "Composto pelos recebimentos em aberto",
      valor: formatBRL(data?.saldoProjetado ?? 0),
      icon: LineChartIcon,
      tone: "brand",
      to: "/financeiro/fluxo-de-caixa",
      empty: "Sem projeção para o período.",
    },
    inadimplencia: {
      titulo: "Inadimplência",
      subtitulo: "Contas em atraso há mais de 10 dias",
      valor: formatBRL(data?.inadimplencia ?? 0),
      icon: AlertTriangle,
      tone: "danger",
      to: "/financeiro/contas-a-receber",
      empty: "Nenhuma conta em atraso.",
    },
  };

  const mensal = (data?.receitaDespesaMensal ?? []).map((r) => ({ ...r, label: mesLabel(r.mes) }));
  const alterado = de !== padrao.de || ate !== padrao.ate;
  const periodoLabel = alterado ? "no período" : "este mês";
  const atualizado = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo",   hour: "2-digit", minute: "2-digit" })
    : undefined;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-3 sm:p-4 md:space-y-8 md:p-6">
      <PanelHeader
        eyebrow="Financeiro · Painel"
        titulo="Painel financeiro"
        descricao="Visão geral de recebimentos, pagamentos e caixa projetado."
        atualizadoEm={atualizado}
        actions={
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
            <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
              De
              <Input
                type="date"
                className="h-9 w-full sm:w-40"
                value={de}
                onChange={(e) => setDe(e.target.value)}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
              Até
              <Input
                type="date"
                className="h-9 w-full sm:w-40"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
              />
            </label>
            {alterado && (
              <Button
                variant="ghost"
                size="sm"
                className="col-span-2 h-9 sm:col-span-1"
                onClick={() => {
                  setDe(padrao.de);
                  setAte(padrao.ate);
                }}
              >
                Restaurar mês atual
              </Button>
            )}
          </div>
        }
      />

      <SectionTitle>Indicadores executivos</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard
          titulo={`A receber (${periodoLabel})`}
          valor={formatBRL(data?.aReceber30d ?? 0)}
          icon={TrendingUp}
          tone="success"
          sub={`Hoje: ${formatBRL(data?.aReceberHoje ?? 0)}`}
          to="/financeiro/contas-a-receber"
        />
        <ReportKpiCard
          titulo={`A pagar (${periodoLabel})`}
          valor={formatBRL(data?.aPagar30d ?? 0)}
          icon={Wallet}
          tone="warning"
          sub={`Hoje: ${formatBRL(data?.aPagarHoje ?? 0)}`}
          to="/financeiro/contas-a-pagar"
        />
        <ReportKpiCard
          titulo="Saldo projetado"
          valor={formatBRL(data?.saldoProjetado ?? 0)}
          icon={LineChartIcon}
          tone="brand"
          to="/financeiro/fluxo-de-caixa"
        />
        <ReportKpiCard
          titulo="Inadimplência"
          valor={formatBRL(data?.inadimplencia ?? 0)}
          icon={AlertTriangle}
          tone="danger"
          sub="Vencido há +10 dias"
          to="/financeiro/contas-a-receber"
        />
      </div>

      <SectionTitle>Evolução</SectionTitle>
      <PanelCard
        titulo="Receita vs. despesa"
        subtitulo="Últimos 12 meses"
        abrirTo="/financeiro/fluxo-de-caixa"
      >
        <div className="h-72 w-full">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={80}
                  tickFormatter={(v) => formatBRL(Number(v))}
                />
                <Tooltip
                  formatter={(v) => formatBRL(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </PanelCard>

      <SectionTitle>Distribuição</SectionTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelCard
          titulo="Receita por banco"
          subtitulo="Em aberto"
          abrirTo="/financeiro/contas-a-receber"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.receitaPorBanco ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => formatBRL(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={110}
                />
                <Tooltip
                  formatter={(v) => formatBRL(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="valor" name="Receita" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard
          titulo="Despesa por categoria"
          subtitulo="Em aberto"
          abrirTo="/financeiro/contas-a-pagar"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.despesaPorCategoria ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => formatBRL(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={110}
                />
                <Tooltip
                  formatter={(v) => formatBRL(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="valor" name="Despesa" fill="var(--chart-5)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

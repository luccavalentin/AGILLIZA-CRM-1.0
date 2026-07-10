import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Wallet, LineChart as LineChartIcon, AlertTriangle } from "lucide-react";
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
import { obterKpisFinanceiros } from "@/lib/financeiro/financeiro.functions";
import { ReportKpiCard } from "@/components/financeiro/kpi-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/financeiro/format";

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

function Pagina() {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["fin-kpis", de, ate],
    queryFn: () => obterKpisFinanceiros({ data: { de: de || undefined, ate: ate || undefined } }),
  });

  const mensal = (data?.receitaDespesaMensal ?? []).map((r) => ({ ...r, label: mesLabel(r.mes) }));
  const periodoLabel = de || ate ? "no período" : "30d";

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
      <div className="op-hero flex flex-wrap items-end justify-between gap-3 p-4 md:p-6">
        <div className="relative min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-[11px]">
            <span className="inline-block h-1 w-5 shrink-0 rounded-full bg-primary" />
            Financeiro · Painel
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            Painel financeiro
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão geral de recebimentos, pagamentos e caixa projetado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            De
            <Input type="date" className="w-40" value={de} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            até
            <Input
              type="date"
              className="w-40"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </label>
          {(de || ate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDe("");
                setAte("");
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard
          titulo={`A receber (${periodoLabel})`}
          valor={formatBRL(data?.aReceber30d ?? 0)}
          icon={TrendingUp}
          tone="success"
          sub={`Hoje: ${formatBRL(data?.aReceberHoje ?? 0)}`}
        />
        <ReportKpiCard
          titulo={`A pagar (${periodoLabel})`}
          valor={formatBRL(data?.aPagar30d ?? 0)}
          icon={Wallet}
          tone="warning"
          sub={`Hoje: ${formatBRL(data?.aPagarHoje ?? 0)}`}
        />
        <ReportKpiCard
          titulo="Saldo projetado"
          valor={formatBRL(data?.saldoProjetado ?? 0)}
          icon={LineChartIcon}
          tone="brand"
        />
        <ReportKpiCard
          titulo="Inadimplência"
          valor={formatBRL(data?.inadimplencia ?? 0)}
          icon={AlertTriangle}
          tone="danger"
          sub="Vencido há +10 dias"
        />
      </div>

      <Card className="p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">Receita vs. despesa (12 meses)</h2>
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
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-4 text-sm font-medium text-foreground">
            Receita por banco (em aberto)
          </h2>
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
        </Card>

        <Card className="p-4">
          <h2 className="mb-4 text-sm font-medium text-foreground">
            Despesa por categoria (em aberto)
          </h2>
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
        </Card>
      </div>
    </div>
  );
}

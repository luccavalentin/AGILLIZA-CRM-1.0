import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { assertModuloPermitido } from "@/lib/route-guards";
import { obterFluxoCaixa } from "@/lib/financeiro/financeiro.functions";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/financeiro/format";

export const Route = createFileRoute("/_authenticated/financeiro/fluxo-de-caixa")({
  head: () => ({ meta: [{ title: "Fluxo de caixa — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.fluxo_caixa"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">
      Não foi possível carregar o fluxo de caixa.
    </div>
  ),
});

function Pagina() {
  const [gran, setGran] = useState<"dia" | "semana" | "mes">("mes");
  const { data, isLoading } = useQuery({
    queryKey: ["fin-fluxo", gran],
    queryFn: () => obterFluxoCaixa({ data: { granularidade: gran } }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Fluxo de caixa</h1>
          <p className="text-sm text-muted-foreground">Projeção de entradas e saídas em aberto.</p>
        </div>
        <Tabs value={gran} onValueChange={(v) => setGran(v as any)}>
          <TabsList>
            <TabsTrigger value="dia">Diário</TabsTrigger>
            <TabsTrigger value="semana">Semanal</TabsTrigger>
            <TabsTrigger value="mes">Mensal</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="p-4">
        <div className="h-80 w-full">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Sem lançamentos em aberto.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="periodo"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={90}
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
                <Bar dataKey="entrada" name="Receita" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saida" name="Despesa" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
                <Line
                  dataKey="saldo"
                  name="Saldo projetado"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}

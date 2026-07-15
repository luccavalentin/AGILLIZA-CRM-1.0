import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  Area,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  Wallet,
  Scale,
  Gauge,
  CalendarClock,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterFluxoCaixaAnalitico,
  type FluxoAnalitico,
} from "@/lib/financeiro/financeiro.functions";
import { PanelHeader, SectionTitle, HeroMetric, MiniMetric, PanelCard } from "@/components/common/dashboard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";

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

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
};

function formatCurto(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

function Pagina() {
  const [gran, setGran] = useState<"dia" | "semana" | "mes">("mes");
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["fin-fluxo-analitico", gran],
    queryFn: () => obterFluxoCaixaAnalitico({ data: { granularidade: gran } }),
  });

  const atualizado = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo",   hour: "2-digit", minute: "2-digit" })
    : undefined;

  const r = data?.resumo;
  const pontos = data?.pontos ?? [];
  const vazio = !isLoading && pontos.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-3 sm:p-4 md:space-y-8 md:p-6">
      <PanelHeader
        eyebrow="Financeiro · Fluxo de caixa"
        titulo="Fluxo de caixa"
        descricao="Caixa realizado e projeção de entradas e saídas em aberto."
        atualizadoEm={atualizado}
        actions={
          <Tabs value={gran} onValueChange={(v) => setGran(v as typeof gran)}>
            <TabsList>
              <TabsTrigger value="dia">Diário</TabsTrigger>
              <TabsTrigger value="semana">Semanal</TabsTrigger>
              <TabsTrigger value="mes">Mensal</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {vazio ? (
        <PanelCard titulo="Sem movimentações">
          <p className="py-10 text-center text-sm text-muted-foreground">
            Não há lançamentos realizados nem contas em aberto para projetar.
          </p>
        </PanelCard>
      ) : (
        <>
          <SectionTitle>Posição de caixa</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HeroMetric
              label="Saldo realizado"
              valor={formatBRL(r?.saldoRealizado ?? 0)}
              hint="Caixa efetivo acumulado"
              tone={(r?.saldoRealizado ?? 0) >= 0 ? "success" : "danger"}
              icon={Wallet}
            />
            <HeroMetric
              label="Resultado projetado"
              valor={formatBRL(r?.resultadoProj ?? 0)}
              hint="Entradas − saídas em aberto"
              tone={(r?.resultadoProj ?? 0) >= 0 ? "brand" : "warning"}
              icon={Scale}
            />
            <HeroMetric
              label="Saldo final projetado"
              valor={formatBRL(r?.saldoFinalProj ?? 0)}
              hint="Realizado + projeção"
              tone={(r?.saldoFinalProj ?? 0) >= 0 ? "success" : "danger"}
              icon={TrendingUp}
            />
            <HeroMetric
              label="Cobertura de saídas"
              valor={`${(r?.coberturaPct ?? 0).toFixed(0)}%`}
              hint="A receber ÷ a pagar (aberto)"
              tone={(r?.coberturaPct ?? 0) >= 100 ? "success" : "warning"}
              icon={Gauge}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniMetric
              label="Entradas em aberto"
              valor={formatBRL(r?.totalEntradaProj ?? 0)}
              tone="success"
            />
            <MiniMetric
              label="Saídas em aberto"
              valor={formatBRL(r?.totalSaidaProj ?? 0)}
              tone="danger"
            />
            <MiniMetric
              label="Melhor período"
              valor={r?.melhorPeriodo ? formatBRL(r.melhorPeriodo.valor) : "—"}
              tone="success"
            />
            <MiniMetric
              label="Pior período"
              valor={r?.piorPeriodo ? formatBRL(r.piorPeriodo.valor) : "—"}
              tone="danger"
            />
          </div>

          <SectionTitle>Evolução do caixa</SectionTitle>
          <PanelCard
            titulo="Entradas, saídas e saldo acumulado"
            subtitulo="Barras = entradas/saídas por período · linha = saldo projetado acumulado"
          >
            <div className="h-[360px] w-full">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      width={54}
                      tickFormatter={(v) => formatCurto(Number(v))}
                    />
                    <Tooltip formatter={(v) => formatBRL(Number(v))} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Area
                      type="monotone"
                      dataKey="saldoAcum"
                      name="Saldo acumulado"
                      stroke="var(--chart-1)"
                      strokeWidth={2.5}
                      fill="url(#gSaldo)"
                    />
                    <Bar dataKey="entrada" name="Entradas" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={34} />
                    <Bar dataKey="saida" name="Saídas" fill="var(--chart-5)" radius={[4, 4, 0, 0]} maxBarSize={34} />
                    <Line
                      type="monotone"
                      dataKey="resultado"
                      name="Resultado líquido"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </PanelCard>

          <SectionTitle>Composição em aberto</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PanelCard titulo="Entradas por origem" subtitulo="A receber em aberto" abrirTo="/financeiro/contas-a-receber">
              <DistribList itens={data?.entradasPorCategoria ?? []} tone="success" />
            </PanelCard>
            <PanelCard titulo="Saídas por categoria" subtitulo="A pagar em aberto" abrirTo="/financeiro/contas-a-pagar">
              <DistribList itens={data?.saidasPorCategoria ?? []} tone="danger" />
            </PanelCard>
          </div>

          <SectionTitle>Próximos vencimentos</SectionTitle>
          <PanelCard titulo="Agenda de caixa" subtitulo="Contas a vencer, ordenadas por data">
            <ProximosVencimentos itens={data?.proximosVencimentos ?? []} />
          </PanelCard>
        </>
      )}
    </div>
  );
}

function DistribList({
  itens,
  tone,
}: {
  itens: { nome: string; valor: number }[];
  tone: "success" | "danger";
}) {
  if (itens.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">Nada em aberto.</p>;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const barColor = tone === "success" ? "bg-success" : "bg-destructive";
  return (
    <ul className="space-y-3">
      {itens.map((i) => (
        <li key={i.nome} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-foreground">{i.nome}</span>
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatBRL(i.valor)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", barColor)}
                style={{ width: `${(i.valor / max) * 100}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
              {total > 0 ? ((i.valor / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ProximosVencimentos({ itens }: { itens: FluxoAnalitico["proximosVencimentos"] }) {
  if (itens.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">Sem vencimentos futuros.</p>;
  return (
    <ul className="divide-y divide-border">
      {itens.map((i, idx) => {
        const receber = i.tipo === "receber";
        return (
          <li key={idx} className="flex items-center gap-3 py-2.5">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                receber
                  ? "bg-success/10 text-success ring-success/20"
                  : "bg-destructive/10 text-destructive ring-destructive/20",
              )}
            >
              {receber ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{i.descricao}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <CalendarClock className="h-3 w-3 shrink-0" />
                {formatarData(i.vencimento)}
                {i.contraparte ? ` · ${i.contraparte}` : ""}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 font-mono text-sm font-semibold tabular-nums",
                receber ? "text-success" : "text-destructive",
              )}
            >
              {receber ? "+" : "−"}
              {formatBRL(i.valor)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function formatarData(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

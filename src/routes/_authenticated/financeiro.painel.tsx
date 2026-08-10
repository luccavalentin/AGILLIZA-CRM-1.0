import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  TrendingUp,
  Wallet,
  LineChart as LineChartIcon,
  AlertTriangle,
  Scale,
  PiggyBank,
  Banknote,
  Layers,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Area,
  ComposedChart,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { assertModuloPermitido } from "@/lib/route-guards";
import { obterKpisFinanceiros, listarContas } from "@/lib/financeiro/financeiro.functions";
import type { KpiTone } from "@/components/financeiro/kpi-card";
import { PanelHeader, SectionTitle, PanelCard, HeroMetric, MiniMetric } from "@/components/common/dashboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/financeiro/format";
import { KpiDrilldownDialog, type KpiDrillItem } from "@/components/reports/kpi-drilldown-dialog";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import { cn } from "@/lib/utils";

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

function formatCurto(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

type KpiFinKey = "receber" | "pagar" | "saldo" | "inadimplencia";

const SERIES: Record<string, { rotulo: string; cor: string }> = {
  receita: { rotulo: "Receitas", cor: "var(--chart-3)" },
  despesa: { rotulo: "Despesas", cor: "var(--chart-5)" },
  resultado: { rotulo: "Resultado", cor: "var(--chart-1)" },
};

const PALETA = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-2)"];

/** Tooltip editorial com tipografia tabular e cor por série. */
function FinTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[200px] rounded-xl border border-border/70 bg-card/95 p-3 shadow-xl backdrop-blur">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-1.5">
        {payload.map((p: any) => (
          <li key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{ background: SERIES[p.dataKey]?.cor ?? p.color ?? p.payload?.cor }}
              />
              {SERIES[p.dataKey]?.rotulo ?? p.name}
            </span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatBRL(Number(p.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Legenda({ chaves }: { chaves: (keyof typeof SERIES)[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {chaves.map((k) => (
        <span
          key={String(k)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
        >
          <span className="size-2 rounded-full" style={{ background: SERIES[k].cor }} />
          {SERIES[k].rotulo}
        </span>
      ))}
    </div>
  );
}

/** Ranking horizontal com barra proporcional e participação percentual. */
function Ranking({
  itens,
  cor,
  vazio,
}: {
  itens: { nome: string; valor: number }[];
  cor: string;
  vazio: string;
}) {
  const total = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
  const max = Math.max(1, ...itens.map((i) => Number(i.valor) || 0));
  if (!itens.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{vazio}</p>;
  }
  return (
    <ul className="space-y-3">
      {itens.slice(0, 7).map((i, idx) => {
        const v = Number(i.valor) || 0;
        const pct = total > 0 ? (v / total) * 100 : 0;
        return (
          <li key={`${i.nome}-${idx}`} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-right font-mono text-[10px] font-semibold text-muted-foreground/70">
                  {idx + 1}
                </span>
                <span className="truncate text-xs font-medium text-foreground">{i.nome}</span>
              </span>
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
                {formatBRL(v)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 pl-6">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted/70">
                <span
                  className="block h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(3, (v / max) * 100)}%`,
                    background: `linear-gradient(90deg, ${cor}, color-mix(in oklab, ${cor} 45%, transparent))`,
                  }}
                />
              </span>
              <span className="w-11 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {pct.toFixed(1)}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

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

  const mensal = (data?.receitaDespesaMensal ?? []).map((r: any) => {
    const receita = Number(r.receita) || 0;
    const despesa = Number(r.despesa) || 0;
    return { ...r, receita, despesa, resultado: receita - despesa, label: mesLabel(r.mes) };
  });

  const totalReceita = mensal.reduce((s: number, m: any) => s + m.receita, 0);
  const totalDespesa = mensal.reduce((s: number, m: any) => s + m.despesa, 0);
  const resultado12m = totalReceita - totalDespesa;
  const margem = totalReceita > 0 ? (resultado12m / totalReceita) * 100 : 0;
  const ticketMensal = mensal.length ? totalReceita / mensal.length : 0;

  const bancos = (data?.receitaPorBanco ?? []) as { nome: string; valor: number }[];
  const categorias = (data?.despesaPorCategoria ?? []) as { nome: string; valor: number }[];
  const categoriasTop = categorias.slice(0, 5).map((c, i) => ({
    ...c,
    valor: Number(c.valor) || 0,
    cor: PALETA[i % PALETA.length],
  }));
  const totalCategorias = categoriasTop.reduce((s, c) => s + c.valor, 0);

  const exportColunas = [
    { key: "mes", label: "Competência" },
    { key: "receita", label: "Receitas", align: "right" as const, format: "brl" as const, footer: "sum" as const },
    { key: "despesa", label: "Despesas", align: "right" as const, format: "brl" as const, footer: "sum" as const },
    { key: "resultado", label: "Resultado", align: "right" as const, format: "brl" as const, footer: "sum" as const },
  ];
  const exportLinhas = mensal.map((m: any) => ({
    mes: m.label,
    receita: m.receita,
    despesa: m.despesa,
    resultado: m.resultado,
  }));
  const exportKpis = [
    { label: "A receber", valor: formatBRL(data?.aReceber30d ?? 0), tone: "success" as const },
    { label: "A pagar", valor: formatBRL(data?.aPagar30d ?? 0), tone: "warning" as const },
    { label: "Saldo projetado", valor: formatBRL(data?.saldoProjetado ?? 0), tone: "brand" as const },
    { label: "Inadimplência", valor: formatBRL(data?.inadimplencia ?? 0), tone: "danger" as const },
  ];
  const alterado = de !== padrao.de || ate !== padrao.ate;
  const periodoLabel = alterado ? "no período" : "este mês";
  const atualizado = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      })
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
            <ExportarFinanceiro
              titulo="Painel financeiro"
              descricao="Visão geral de recebimentos, pagamentos e caixa projetado."
              meta={[`Período: ${de} até ${ate}`]}
              kpis={exportKpis}
              columns={exportColunas}
              rows={exportLinhas}
              className="col-span-2 h-9 sm:col-span-1"
            />
          </div>
        }
      />

      <SectionTitle>Indicadores executivos</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeroMetric
          label={`A receber (${periodoLabel})`}
          valor={formatBRL(data?.aReceber30d ?? 0)}
          hint={`Hoje: ${formatBRL(data?.aReceberHoje ?? 0)}`}
          icon={TrendingUp}
          tone="success"
          onDetails={() => setDrill("receber")}
        />
        <HeroMetric
          label={`A pagar (${periodoLabel})`}
          valor={formatBRL(data?.aPagar30d ?? 0)}
          hint={`Hoje: ${formatBRL(data?.aPagarHoje ?? 0)}`}
          icon={Wallet}
          tone="warning"
          onDetails={() => setDrill("pagar")}
        />
        <HeroMetric
          label="Saldo projetado"
          valor={formatBRL(data?.saldoProjetado ?? 0)}
          hint="Recebimentos em aberto − pagamentos"
          icon={PiggyBank}
          tone={(data?.saldoProjetado ?? 0) >= 0 ? "brand" : "danger"}
          onDetails={() => setDrill("saldo")}
        />
        <HeroMetric
          label="Inadimplência"
          valor={formatBRL(data?.inadimplencia ?? 0)}
          hint="Vencido há mais de 10 dias"
          icon={AlertTriangle}
          tone="danger"
          onDetails={() => setDrill("inadimplencia")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniMetric label="Receitas (12m)" valor={formatBRL(totalReceita)} tone="success" />
        <MiniMetric label="Despesas (12m)" valor={formatBRL(totalDespesa)} tone="danger" />
        <MiniMetric
          label="Resultado (12m)"
          valor={formatBRL(resultado12m)}
          tone={resultado12m >= 0 ? "brand" : "danger"}
        />
        <MiniMetric
          label="Margem líquida"
          valor={`${margem.toFixed(1)}%`}
          tone={margem >= 0 ? "success" : "danger"}
        />
      </div>

      <SectionTitle>Evolução</SectionTitle>
      <PanelCard
        titulo="Receita, despesa e resultado"
        subtitulo="Barras = receitas e despesas por competência · área = resultado líquido acumulado no mês"
        abrirTo="/financeiro/fluxo-de-caixa"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Legenda chaves={["receita", "despesa", "resultado"]} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Scale className="size-3.5" />
            Média mensal de receita: {formatBRL(ticketMensal)}
          </span>
        </div>
        <div className="h-[360px] w-full">
          {isLoading ? (
            <div className="h-full w-full animate-pulse rounded-xl bg-muted/50" />
          ) : mensal.length === 0 ? (
            <p className="py-24 text-center text-sm text-muted-foreground">
              Sem lançamentos para exibir no período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mensal} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} barGap={6}>
                <defs>
                  <linearGradient id="pfReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="pfDespesa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="pfResultado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border))" strokeOpacity={0.6} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={12}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  tickMargin={8}
                  tickFormatter={(v) => formatCurto(Number(v))}
                />
                <Tooltip
                  content={<FinTooltip />}
                  cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35, radius: 8 }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                <Area
                  type="monotone"
                  dataKey="resultado"
                  name="Resultado"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  fill="url(#pfResultado)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                />
                <Bar dataKey="receita" name="Receitas" fill="url(#pfReceita)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                <Bar dataKey="despesa" name="Despesas" fill="url(#pfDespesa)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                <Line
                  type="monotone"
                  dataKey="resultado"
                  name="Resultado"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </PanelCard>

      <SectionTitle>Distribuição</SectionTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelCard
          titulo="Receita por banco"
          subtitulo="Valores em aberto, ordenados por participação"
          abrirTo="/financeiro/contas-a-receber"
        >
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
            <Banknote className="size-4 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total em aberto</span>
            <span className="ml-auto font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatBRL(bancos.reduce((s, b) => s + (Number(b.valor) || 0), 0))}
            </span>
          </div>
          {isLoading ? (
            <div className="h-56 w-full animate-pulse rounded-xl bg-muted/50" />
          ) : (
            <Ranking itens={bancos} cor="var(--chart-1)" vazio="Nenhuma receita em aberto." />
          )}
        </PanelCard>

        <PanelCard
          titulo="Despesa por categoria"
          subtitulo="Composição das saídas em aberto"
          abrirTo="/financeiro/contas-a-pagar"
        >
          {isLoading ? (
            <div className="h-56 w-full animate-pulse rounded-xl bg-muted/50" />
          ) : categoriasTop.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Nenhuma despesa em aberto.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
              <div className="relative h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoriasTop}
                      dataKey="valor"
                      nameKey="nome"
                      innerRadius="62%"
                      outerRadius="92%"
                      paddingAngle={3}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    >
                      {categoriasTop.map((c) => (
                        <Cell key={c.nome} fill={c.cor} />
                      ))}
                    </Pie>
                    <Tooltip content={<FinTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatBRL(totalCategorias)}
                  </span>
                </div>
              </div>
              <ul className="space-y-2">
                {categoriasTop.map((c) => {
                  const pct = totalCategorias > 0 ? (c.valor / totalCategorias) * 100 : 0;
                  return (
                    <li key={c.nome} className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{c.nome}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
                      <span className={cn("w-24 shrink-0 text-right font-mono font-semibold tabular-nums text-foreground")}>
                        {formatBRL(c.valor)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {categorias.length > categoriasTop.length && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Layers className="size-3.5" />
              Exibindo as {categoriasTop.length} maiores de {categorias.length} categorias.
            </p>
          )}
        </PanelCard>
      </div>

      {drill && (
        <KpiDrilldownDialog
          open={!!drill}
          onOpenChange={(o) => !o && setDrill(null)}
          titulo={drillMeta[drill].titulo}
          subtitulo={drillMeta[drill].subtitulo}
          valor={drillMeta[drill].valor}
          icon={drillMeta[drill].icon}
          tone={drillMeta[drill].tone}
          itens={drillQuery.data?.itens ?? []}
          isLoading={drillQuery.isLoading}
          linkAbrir={drillMeta[drill].to}
          empty={drillMeta[drill].empty}
        />
      )}
    </div>
  );
}

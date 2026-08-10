import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  CalendarRange,
  X,
  Trash2,
} from "lucide-react";

import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterFluxoCaixaAnalitico,
  type FluxoAnalitico,
  limparFluxoCaixa,
} from "@/lib/financeiro/financeiro.functions";

import { PanelHeader, SectionTitle, HeroMetric, MiniMetric, PanelCard } from "@/components/common/dashboard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,

  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
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

function formatCurto(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

const SERIES: Record<string, { rotulo: string; cor: string }> = {
  entrada: { rotulo: "Entradas", cor: "var(--chart-3)" },
  saida: { rotulo: "Saídas", cor: "var(--chart-5)" },
  saldoAcum: { rotulo: "Saldo acumulado", cor: "var(--chart-1)" },
  resultado: { rotulo: "Resultado líquido", cor: "var(--chart-2)" },
};

/** Tooltip do gráfico com tipografia tabular e cores por série. */
function FluxoTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[210px] rounded-xl border border-border/70 bg-card/95 p-3 shadow-xl backdrop-blur">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-1.5">
        {payload.map((p: any) => (
          <li key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{ background: SERIES[p.dataKey]?.cor ?? p.color }}
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

/** Legenda customizada em chips, no lugar da legenda padrão do Recharts. */
function FluxoLegenda() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {Object.entries(SERIES).map(([k, s]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
        >
          <span className="size-2 rounded-full" style={{ background: s.cor }} />
          {s.rotulo}
        </span>
      ))}
    </div>
  );
}

/** Filtro por calendário: de X a X, com aplicar e limpar. */
function FiltroPeriodo({
  de,
  ate,
  onAplicar,
  onLimpar,
}: {
  de: string;
  ate: string;
  onAplicar: (de: string, ate: string) => void;
  onLimpar: () => void;
}) {
  const [rascDe, setRascDe] = useState(de);
  const [rascAte, setRascAte] = useState(ate);
  const ativo = !!(de || ate);

  return (
    <div className="grid w-full grid-cols-1 gap-2 rounded-xl border border-border/50 bg-muted/30 p-2 sm:flex sm:w-auto sm:flex-wrap sm:items-end">
      <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:items-center">
        <CalendarRange className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
        <div className="min-w-0 space-y-1">
          <Label htmlFor="fluxo-de" className="text-[10px] uppercase tracking-wide text-muted-foreground">
            De
          </Label>
          <Input
            id="fluxo-de"
            type="date"
            className="h-9 w-full sm:w-[9.5rem]"
            value={rascDe}
            onChange={(e) => setRascDe(e.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="fluxo-ate" className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Até
          </Label>
          <Input
            id="fluxo-ate"
            type="date"
            className="h-9 w-full sm:w-[9.5rem]"
            value={rascAte}
            onChange={(e) => setRascAte(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" className="h-9 flex-1 sm:flex-none" onClick={() => onAplicar(rascDe, rascAte)}>
          Aplicar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-9 flex-1 sm:flex-none"
          disabled={!ativo && !rascDe && !rascAte}
          onClick={() => {
            setRascDe("");
            setRascAte("");
            onLimpar();
          }}
        >
          <X className="mr-1 size-3.5" /> Limpar
        </Button>
      </div>
    </div>
  );
}

/** Detalhamento em modal ao clicar em um card de KPI do fluxo de caixa. */
function DetalheFluxoDialog({
  aberto,
  onClose,
  titulo,
  descricao,
  linhas,
  queryClient,
}: {
  aberto: boolean;
  onClose: () => void;
  titulo: string;
  descricao?: string;
  linhas: { rotulo: string; sub?: string; valor: number; details?: { tipo: "pagar" | "receber"; id: string }[] }[];
  queryClient: any;
}) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return (
    <Dialog open={aberto} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao ? <DialogDescription>{descricao}</DialogDescription> : null}
        </DialogHeader>
        {linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <ul className="divide-y divide-border">
            {linhas.map((l, i) => (
              <li key={`${l.rotulo}-${i}`} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{l.rotulo}</p>
                    {l.sub ? <p className="truncate text-xs text-muted-foreground">{l.sub}</p> : null}
                  </div>
                  <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                    {formatBRL(l.valor)}
                  </span>
                </div>
                {l.details && l.details.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {l.details.map((d) => (
                      <div key={d.id} className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] font-medium"
                          asChild
                        >
                          <a href={`/financeiro/contas-a-${d.tipo === "pagar" ? "pagar" : "receber"}?id=${d.id}`}>
                            Ver/Editar {d.tipo === "pagar" ? "Saída" : "Entrada"}
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (confirm(`Deseja excluir esta ${d.tipo === "pagar" ? "saída" : "entrada"}?`)) {
                              try {
                                const { excluirConta } = await import("@/lib/financeiro/financeiro.functions");
                                await excluirConta({ data: { tipo: d.tipo, id: d.id } });
                                toast.success("Excluído com sucesso!");
                                queryClient.invalidateQueries({ queryKey: ["fin-fluxo-analitico"] });
                                // O modal fechará ou atualizará sozinho conforme o estado da query
                              } catch (err: any) {
                                toast.error(err.message);
                              }
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {linhas.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono tabular-nums">{formatBRL(total)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}



function Pagina() {
  const [gran, setGran] = useState<"dia" | "semana" | "mes">("mes");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const queryClient = useQueryClient();


  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["fin-fluxo-analitico", gran, de, ate],
    queryFn: () =>
      obterFluxoCaixaAnalitico({
        data: { granularidade: gran, de: de || null, ate: ate || null },
      }),
  });

  const atualizado = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo",   hour: "2-digit", minute: "2-digit" })
    : undefined;

  const r = data?.resumo;
  const pontos = data?.pontos ?? [];
  const vazio = !isLoading && pontos.length === 0;

  // Detalhamento dos cards (clicáveis).
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const DETALHES: Record<
    string,
    { titulo: string; descricao: string; linhas: { rotulo: string; sub?: string; valor: number }[] }
  > = {
    saldoRealizado: {
      titulo: "Detalhamento de Entradas e Saídas",
      descricao: "Movimentações já efetivadas em caixa.",
      linhas: pontos.map((p: any) => ({
        rotulo: p.label,
        sub: `Entradas ${formatBRL(p.entradaReal)} · Saídas ${formatBRL(p.saidaReal)}`,
        valor: Number(p.entradaReal) - Number(p.saidaReal),
        details: p.movimentacoesRealizadas?.map((m: any) => ({
          tipo: m.tipo === "saida" ? "pagar" : "receber",
          id: m.ref_id
        })).filter((m: any) => !!m.id)
      })),
    },
    resultadoProj: {
      titulo: "Resultado projetado por período",
      descricao: "Entradas menos saídas em aberto.",
      linhas: pontos.map((p: any) => ({
        rotulo: p.label,
        sub: `A receber ${formatBRL(p.entradaProj)} · A pagar ${formatBRL(p.saidaProj)}`,
        valor: Number(p.entradaProj) - Number(p.saidaProj),
        details: p.movimentacoesProjetadas?.map((m: any) => ({
          tipo: m.tipo === "saida" ? "pagar" : "receber",
          id: m.ref_id
        })).filter((m: any) => !!m.id)
      })),
    },
    saldoFinalProj: {
      titulo: "Saldo acumulado projetado",
      descricao: "Realizado somado à projeção, período a período.",
      linhas: pontos.map((p: any) => ({ 
        rotulo: p.label, 
        valor: Number(p.saldoAcum),
        details: p.movimentacoesProjetadas?.map((m: any) => ({
          tipo: m.tipo === "saida" ? "pagar" : "receber",
          id: m.ref_id
        })).filter((m: any) => !!m.id)
      })),
    },
    coberturaPct: {
      titulo: "Cobertura de saídas",
      descricao: "Entradas e saídas em aberto por período.",
      linhas: pontos.map((p: any) => ({
        rotulo: p.label,
        sub: `A receber ${formatBRL(p.entradaProj)} · A pagar ${formatBRL(p.saidaProj)}`,
        valor: Number(p.entradaProj) - Number(p.saidaProj),
        details: p.movimentacoesProjetadas?.map((m: any) => ({
          tipo: m.tipo === "saida" ? "pagar" : "receber",
          id: m.ref_id
        })).filter((m: any) => !!m.id)
      })),
    },
    entradasProj: {
      titulo: "Entradas em aberto",
      descricao: "Contas a receber por origem.",
      linhas: (data?.entradasPorCategoria ?? []).map((c: any) => ({ 
        rotulo: c.nome, 
        valor: c.valor,
        details: c.ids?.map((id: string) => ({ tipo: "receber", id }))
      })),
    },
    saidasProj: {
      titulo: "Saídas em aberto",
      descricao: "Contas a pagar por categoria.",
      linhas: (data?.saidasPorCategoria ?? []).map((c: any) => ({ 
        rotulo: c.nome, 
        valor: c.valor,
        details: c.ids?.map((id: string) => ({ tipo: "pagar", id }))
      })),
    },
    melhor: {
      titulo: "Melhores períodos",
      descricao: "Resultado líquido por período (maior primeiro).",
      linhas: [...pontos]
        .sort((a: any, b: any) => b.resultado - a.resultado)
        .map((p: any) => ({ rotulo: p.label, valor: Number(p.resultado) })),
    },
    pior: {
      titulo: "Piores períodos",
      descricao: "Resultado líquido por período (menor primeiro).",
      linhas: [...pontos]
        .sort((a: any, b: any) => a.resultado - b.resultado)
        .map((p: any) => ({ rotulo: p.label, valor: Number(p.resultado) })),
    },
  };
  const det = detalhe ? DETALHES[detalhe] : null;


  return (
    <div className="mx-auto w-full max-w-none space-y-6 min-h-screen">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between px-4 sm:px-6 pt-6">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
            Financeiro · Fluxo de Caixa
          </p>
          <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">
            Fluxo de caixa
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground max-w-md">
              Caixa realizado e projeção de entradas e saídas em aberto.
            </p>
            {atualizado && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/20">
                <span className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                Atualizado {atualizado}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={gran} onValueChange={(v) => setGran(v as typeof gran)}>
            <TabsList className="h-10 gap-1 rounded-xl bg-muted/40 p-1">
              <TabsTrigger value="dia" className="rounded-lg px-4 py-1.5 text-xs font-semibold">
                Diário
              </TabsTrigger>
              <TabsTrigger value="semana" className="rounded-lg px-4 py-1.5 text-xs font-semibold">
                Semanal
              </TabsTrigger>
              <TabsTrigger value="mes" className="rounded-lg px-4 py-1.5 text-xs font-semibold">
                Mensal
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <ExportarFinanceiro
            titulo="Fluxo de caixa"
            descricao="Entradas, saídas, resultado líquido e saldo acumulado projetado."
            meta={[
              `Granularidade: ${gran === "dia" ? "Diária" : gran === "semana" ? "Semanal" : "Mensal"}`,
              de || ate ? `Período: ${de || "início"} até ${ate || "hoje"}` : "Período: completo",
            ]}
            columns={[
              { key: "label", label: "Período" },
              { key: "entrada", label: "Entradas", align: "right" as const, format: "brl" as const, footer: "sum" as const },
              { key: "saida", label: "Saídas", align: "right" as const, format: "brl" as const, footer: "sum" as const },
              { key: "resultado", label: "Resultado", align: "right" as const, format: "brl" as const, footer: "sum" as const },
              { key: "saldoAcum", label: "Saldo acumulado", align: "right" as const, format: "brl" as const },
            ]}
            rows={(pontos ?? []).map((p: any) => ({
              label: p.label,
              entrada: Number(p.entrada) || 0,
              saida: Number(p.saida) || 0,
              resultado: Number(p.resultado) || 0,
              saldoAcum: Number(p.saldoAcum) || 0,
            }))}
          />

          <FiltroPeriodo
            de={de}
            ate={ate}
            onAplicar={(d, a) => {
              setDe(d);
              setAte(a);
            }}
            onLimpar={() => {
              setDe("");
              setAte("");
            }}
          />
        </div>
      </div>

      <div className="p-4 sm:p-5 md:space-y-8 md:p-8">

      {(de || ate) && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
            <CalendarRange className="size-3.5" />
            Período: {de ? formatarData(de) : "início"} até {ate ? formatarData(ate) : "hoje"}
          </span>
        </p>
      )}

      {vazio ? (
        <div className="rounded-2xl border border-border/50 bg-card p-12">
          <SectionTitle>Sem movimentações</SectionTitle>
          <div className="flex min-h-[200px] flex-col items-center justify-center space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              Não há lançamentos realizados nem contas em aberto para projetar.
            </p>
          </div>
        </div>

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
              onDetails={() => setDetalhe("saldoRealizado")}
            />
            <HeroMetric
              label="Resultado projetado"
              valor={formatBRL(r?.resultadoProj ?? 0)}
              hint="Entradas − saídas em aberto"
              tone={(r?.resultadoProj ?? 0) >= 0 ? "brand" : "warning"}
              icon={Scale}
              onDetails={() => setDetalhe("resultadoProj")}
            />
            <HeroMetric
              label="Saldo final projetado"
              valor={formatBRL(r?.saldoFinalProj ?? 0)}
              hint="Realizado + projeção"
              tone={(r?.saldoFinalProj ?? 0) >= 0 ? "success" : "danger"}
              icon={TrendingUp}
              onDetails={() => setDetalhe("saldoFinalProj")}
            />
            <HeroMetric
              label="Cobertura de saídas"
              valor={`${(r?.coberturaPct ?? 0).toFixed(0)}%`}
              hint="A receber ÷ a pagar (aberto)"
              tone={(r?.coberturaPct ?? 0) >= 100 ? "success" : "warning"}
              icon={Gauge}
              onDetails={() => setDetalhe("coberturaPct")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniMetric
              label="Entradas em aberto"
              valor={formatBRL(r?.totalEntradaProj ?? 0)}
              tone="success"
              onDetails={() => setDetalhe("entradasProj")}
            />
            <MiniMetric
              label="Saídas em aberto"
              valor={formatBRL(r?.totalSaidaProj ?? 0)}
              tone="danger"
              onDetails={() => setDetalhe("saidasProj")}
            />
            <MiniMetric
              label="Melhor período"
              valor={r?.melhorPeriodo ? formatBRL(r.melhorPeriodo.valor) : "—"}
              tone="success"
              onDetails={() => setDetalhe("melhor")}
            />
            <MiniMetric
              label="Pior período"
              valor={r?.piorPeriodo ? formatBRL(r.piorPeriodo.valor) : "—"}
              tone="danger"
              onDetails={() => setDetalhe("pior")}
            />
          </div>

          <DetalheFluxoDialog
            aberto={!!det}
            onClose={() => setDetalhe(null)}
            titulo={det?.titulo ?? ""}
            descricao={det?.descricao}
            linhas={det?.linhas ?? []}
            queryClient={queryClient}
          />



          <SectionTitle>Evolução do caixa</SectionTitle>
          <PanelCard
            titulo="Entradas, saídas e saldo acumulado"
            subtitulo="Barras = entradas/saídas por período · área = saldo projetado acumulado"
          >
            <FluxoLegenda />
            <div className="h-[260px] w-full sm:h-[320px] lg:h-[380px]">
              {isLoading ? (
                <div className="h-full w-full animate-pulse rounded-xl bg-muted/50" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={pontos}
                    margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                    barGap={6}
                  >
                    <defs>
                      <linearGradient id="gSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gEntrada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.45} />
                      </linearGradient>
                      <linearGradient id="gSaida" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.45} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 6"
                      stroke="hsl(var(--border))"
                      strokeOpacity={0.6}
                      vertical={false}
                    />
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
                      content={<FluxoTooltip />}
                      cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35, radius: 8 }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                    <Area
                      type="monotone"
                      dataKey="saldoAcum"
                      name="Saldo acumulado"
                      stroke="var(--chart-1)"
                      strokeWidth={2.5}
                      fill="url(#gSaldo)"
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                      dot={false}
                    />
                    <Bar
                      dataKey="entrada"
                      name="Entradas"
                      fill="url(#gEntrada)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="saida"
                      name="Saídas"
                      fill="url(#gSaida)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      type="monotone"
                      dataKey="resultado"
                      name="Resultado líquido"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={{ r: 4 }}
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

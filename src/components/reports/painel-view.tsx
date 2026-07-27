import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  Calculator,
  Send,
  BadgeCheck,
  XCircle,
  FileSignature,
  Wallet,
  TrendingUp,
  Percent,
  Target,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  PanelHeader,
  SectionTitle,
  HeroMetric,
  MiniMetric,
  PanelCard,
  MetricList,
  AlertRow,
  ConversionFunnel,
} from "@/components/common/dashboard";
import { ReportChartView } from "@/components/reports/report-chart";
import { VisionSelector } from "@/components/reports/report-filters-bar";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { UsuarioCombobox } from "@/components/operacional/usuario-combobox";
import { listarColegas } from "@/lib/operacional/shared.functions";
import { getPanelDados } from "@/lib/relatorios/paineis.functions";
import { getEscopoRelatorios } from "@/lib/relatorios/reports.functions";
import { PERIODO_LABEL, type Periodo, type Escopo } from "@/lib/relatorios/shared";
import {
  PainelDrilldownDialog,
  type DrilldownContext,
} from "@/components/reports/painel-drilldown-dialog";

const PERIODOS: Periodo[] = ["hoje", "7d", "15d", "30d", "mes", "mes_anterior", "ano", "custom"];

/** Mapeia o rótulo de uma métrica para a rota correspondente (cards clicáveis). */
function linkParaMetrica(label: string): string | undefined {
  const l = label.toLowerCase();
  if (l.includes("taxa de aprova")) return "/relatorios/propostas";
  if (l.includes("contrato")) return "/operacional/propostas";
  if (l.includes("simula")) return "/operacional/simulacoes";
  if (l.includes("tarefa")) return "/operacional/tarefas";
  if (l.includes("demanda") || l.includes("sla")) return "/operacional/demandas";
  if (
    l.includes("proposta") ||
    l.includes("aprovad") ||
    l.includes("recusad") ||
    l.includes("análise") ||
    l.includes("analise") ||
    l.includes("rascunho")
  )
    return "/operacional/propostas";
  return undefined;
}

/** Ícone ilustrativo por rótulo de indicador executivo. */
function iconeParaMetrica(label: string): LucideIcon | undefined {
  const l = label.toLowerCase();
  if (l.includes("simula")) return Calculator;
  if (l.includes("volume")) return Wallet;
  if (l.includes("ticket")) return TrendingUp;
  if (l.includes("convers")) return Percent;
  if (l.includes("meta")) return Target;
  if (l.includes("propost")) return Send;
  if (l.includes("aprovad")) return BadgeCheck;
  if (l.includes("reprovad") || l.includes("recusad")) return XCircle;
  if (l.includes("contrato")) return FileSignature;
  return undefined;
}


/** Painel de monitoramento reutilizável (visão-geral / operacional). */
export function PainelView({
  modulo,
  eyebrow,
  titulo,
  descricao,
  realtimeTabelas,
  abrirTo,
}: {
  modulo: "visao-geral" | "operacional";
  eyebrow: string;
  titulo: string;
  descricao: string;
  realtimeTabelas: string[];
  abrirTo?: string;
}) {
  const qc = useQueryClient();
  const dadosFn = useServerFn(getPanelDados);
  const escopoFn = useServerFn(getEscopoRelatorios);

  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [escopo, setEscopo] = useState<Escopo>("minha");
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");
  const [responsavel, setResponsavel] = useState<string>("todos");
  const escopoTocado = useRef(false);
  const [drilldown, setDrilldown] = useState<DrilldownContext | null>(null);

  const { data: perms } = useQuery({
    queryKey: ["report-escopo"],
    queryFn: () => escopoFn(),
    staleTime: 5 * 60_000,
  });

  const podeFiltrarUsuario = (perms?.podeEquipe ?? false) || (perms?.podeGeral ?? false);
  const listarColegasFn = useServerFn(listarColegas);
  const { data: colegas } = useQuery({
    queryKey: ["panel-colegas"],
    queryFn: () => listarColegasFn(),
    enabled: podeFiltrarUsuario,
    staleTime: 5 * 60_000,
  });

  // Mantém "minha" por padrão; o usuário amplia manualmente para "geral".
  // O escopo "equipe" foi removido do produto.

  const mudarEscopo = (e: Escopo) => {
    escopoTocado.current = true;
    setEscopo(e);
  };

  // Só envia o intervalo personalizado quando ambas as datas estão preenchidas.
  const customPronto = periodo !== "custom" || (!!de && !!ate);
  const responsavelId = responsavel !== "todos" ? responsavel : undefined;

  const queryKey = ["panel", modulo, periodo, escopo, de, ate, responsavel];
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey,
    queryFn: () =>
      dadosFn({
        data: {
          modulo,
          periodo,
          escopo,
          ...(periodo === "custom" ? { de, ate } : {}),
          ...(responsavelId ? { responsavel: responsavelId } : {}),
        },
      }),
    enabled: customPronto,
    staleTime: 30_000,
  });

  const filtrosAtuais = {
    modulo,
    periodo,
    escopo,
    ...(periodo === "custom" ? { de, ate } : {}),
    ...(responsavelId ? { responsavel: responsavelId } : {}),
  } as DrilldownContext["filtros"];
  const abrirDetalhe = (metrica: string, valorAtual?: string) =>
    setDrilldown({ metrica, valorAtual, filtros: filtrosAtuais });


  const tabelasKey = realtimeTabelas.join(",");
  useEffect(() => {
    const tabelas = tabelasKey ? tabelasKey.split(",") : [];
    const channel = supabase.channel(`panel-${modulo}`);
    tabelas.forEach((t) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table: t }, () => {
        qc.invalidateQueries({ queryKey: ["panel", modulo] });
      });
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [modulo, qc, tabelasKey]);

  const atualizado = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo",   hour: "2-digit", minute: "2-digit" })
    : undefined;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-3 sm:p-4 md:space-y-8 md:p-6">
      <PanelHeader
        variant={modulo === "visao-geral" ? "dark" : "light"}
        eyebrow={eyebrow}
        titulo={titulo}
        descricao={descricao}
        atualizadoEm={atualizado}
        onRefresh={() => qc.invalidateQueries({ queryKey })}
        actions={
          <>
            <VisionSelector
              escopo={escopo}
              onChange={mudarEscopo}
              podeEquipe={perms?.podeEquipe ?? false}
              podeGeral={perms?.podeGeral ?? false}
            />
            {podeFiltrarUsuario && (
              <UsuarioCombobox
                value={responsavel}
                onValueChange={setResponsavel}
                usuarios={colegas ?? []}
                className="h-9 w-full sm:w-52"
                placeholder="Todos os usuários"
              />
            )}
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger
                className={
                  modulo === "visao-geral"
                    ? "h-9 w-full sm:w-40 border-white/20 bg-white/10 text-white [&_svg]:text-white/80 hover:bg-white/15"
                    : "h-9 w-full sm:w-40"
                }
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PERIODO_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {periodo === "custom" && (
              <DateRangePicker
                de={de}
                ate={ate}
                onChange={(d, a) => {
                  setDe(d);
                  setAte(a);
                }}
                className="h-9 w-full sm:w-72"
                triggerClassName={
                  modulo === "visao-geral"
                    ? "border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white [&_svg]:text-white/80"
                    : undefined
                }
                numberOfMonths={2}
              />
            )}

          </>
        }
      />

      {error ? (
        <Card className="flex items-center gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os indicadores. Tente atualizar.
          </p>
        </Card>
      ) : !customPronto ? (
        <Card className="flex items-center gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Selecione a data inicial e a data final para ver o período personalizado.
          </p>
        </Card>
      ) : isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <SectionTitle>Indicadores</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.heros.map((h) => (
              <HeroMetric
                key={h.label}
                label={h.label}
                valor={h.valor}
                hint={h.hint}
                tone={h.tone}
                delta={h.delta}
                icon={iconeParaMetrica(h.label)}
                onDetails={() => abrirDetalhe(h.label, h.valor)}
              />
            ))}
          </div>
          {data.minis.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {data.minis.map((m) => (
                <MiniMetric
                  key={m.label}
                  label={m.label}
                  valor={m.valor}
                  tone={m.tone}
                  onDetails={() => abrirDetalhe(m.label, m.valor)}
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {data.evolucao && data.evolucao.dados.length > 1 && (
              <div className="lg:col-span-5">
                <PanelCard
                  titulo={data.evolucao.titulo}
                  subtitulo={data.evolucao.subtitulo}
                  onOpen={() => abrirDetalhe(data.evolucao!.titulo)}
                >
                  <div
                    className="h-[280px] w-full cursor-pointer overflow-hidden rounded-lg transition-colors hover:bg-primary/[0.02]"
                    role="button"
                    tabIndex={0}
                    onClick={() => abrirDetalhe(data.evolucao!.titulo)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") abrirDetalhe(data.evolucao!.titulo);
                    }}
                    aria-label={`Ver detalhamento de ${data.evolucao.titulo}`}
                  >
                    <ReportChartView
                      chart={{
                        titulo: data.evolucao.titulo,
                        tipo: "line",
                        dados: data.evolucao.dados,
                        serie1: data.evolucao.serie1,
                        serie2: data.evolucao.serie2,
                      }}
                    />
                  </div>
                </PanelCard>
              </div>
            )}

            {data.funil && data.funil.etapas.some((e) => e.valor > 0) && (
              <div className="lg:col-span-3">
                <PanelCard titulo={data.funil.titulo} subtitulo="Da simulação ao contrato">
                  <ConversionFunnel
                    etapas={data.funil.etapas}
                    onItemClick={(label, valor) =>
                      abrirDetalhe(label, valor.toLocaleString("pt-BR"))
                    }
                  />
                </PanelCard>
              </div>
            )}

            <div className="lg:col-span-4">
              <PanelCard
                titulo={data.chart.titulo}
                subtitulo={data.chart.subtitulo}
                abrirTo={abrirTo}
                onOpen={() => abrirDetalhe(data.chart.titulo)}
              >
                {data.chart.porBanco ? (
                  <MetricList
                    items={data.chart.dados.map((d) => ({ label: d.label, valor: d.valor }))}
                    colorByBank
                    onItemClick={(label, valor) =>
                      abrirDetalhe(label, valor.toLocaleString("pt-BR"))
                    }
                  />
                ) : (
                  <div
                    className="w-full cursor-pointer overflow-hidden rounded-lg transition-colors hover:bg-primary/[0.02]"
                    role="button"
                    tabIndex={0}
                    onClick={() => abrirDetalhe(data.chart.titulo)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") abrirDetalhe(data.chart.titulo);
                    }}
                    aria-label={`Ver detalhamento de ${data.chart.titulo}`}
                    style={{
                      height: Math.min(420, Math.max(168, data.chart.dados.length * 52 + 44)),
                    }}
                  >
                    <ReportChartView
                      chart={{ titulo: data.chart.titulo, tipo: "barh", dados: data.chart.dados }}
                    />
                  </div>
                )}
              </PanelCard>
            </div>
          </div>


          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <PanelCard
                titulo={data.ranking.titulo}
                onOpen={() => abrirDetalhe(data.ranking.titulo)}
              >
                <MetricList
                  items={data.ranking.itens}
                  colorByBank={data.chart.porBanco}
                  onItemClick={(label, valor) =>
                    abrirDetalhe(label, valor.toLocaleString("pt-BR"))
                  }
                />
              </PanelCard>
            </div>

            <div className="lg:col-span-2">
              <PanelCard titulo="Atividades e alertas">
                {data.alertas.length === 0 ? (
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <p className="min-w-0 text-sm leading-snug text-muted-foreground">
                      Operação sem alertas críticos.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.alertas.map((a) => (
                      <AlertRow
                        key={a.titulo}
                        tone={a.tone}
                        titulo={a.titulo}
                        descricao={a.descricao}
                        contador={a.contador}
                        to={linkParaMetrica(a.titulo)}
                      />
                    ))}
                  </div>
                )}
              </PanelCard>
            </div>
          </div>

          {data.distribuicao && data.distribuicao.dados.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PanelCard
                titulo={data.distribuicao.titulo}
                subtitulo={data.distribuicao.subtitulo}
                onOpen={() => abrirDetalhe(data.distribuicao!.titulo)}
              >
                <div
                  className="h-[240px] w-full cursor-pointer overflow-hidden rounded-lg transition-colors hover:bg-primary/[0.02]"
                  role="button"
                  tabIndex={0}
                  onClick={() => abrirDetalhe(data.distribuicao!.titulo)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      abrirDetalhe(data.distribuicao!.titulo);
                  }}
                  aria-label={`Ver detalhamento de ${data.distribuicao.titulo}`}
                >
                  <ReportChartView
                    chart={{
                      titulo: data.distribuicao.titulo,
                      tipo: "donut",
                      dados: data.distribuicao.dados,
                    }}
                    colorByBank={data.distribuicao.porBanco}
                  />
                </div>
              </PanelCard>
              {data.recusadasPorBanco && data.recusadasPorBanco.itens.length > 0 && (
                <PanelCard
                  titulo={data.recusadasPorBanco.titulo}
                  onOpen={() => abrirDetalhe(data.recusadasPorBanco!.titulo)}
                >
                  <MetricList
                    items={data.recusadasPorBanco.itens}
                    colorByBank
                    onItemClick={(label, valor) =>
                      abrirDetalhe(label, valor.toLocaleString("pt-BR"))
                    }
                  />
                </PanelCard>
              )}
            </div>
          )}

          {(data.porTipoSimulacao || data.clientesPorEtapa) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.porTipoSimulacao && data.porTipoSimulacao.dados.length > 0 && (
                <PanelCard
                  titulo={data.porTipoSimulacao.titulo}
                  subtitulo={data.porTipoSimulacao.subtitulo}
                  onOpen={() => abrirDetalhe(data.porTipoSimulacao!.titulo)}
                >
                  <div
                    className="h-[240px] w-full cursor-pointer overflow-hidden rounded-lg transition-colors hover:bg-primary/[0.02]"
                    role="button"
                    tabIndex={0}
                    onClick={() => abrirDetalhe(data.porTipoSimulacao!.titulo)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        abrirDetalhe(data.porTipoSimulacao!.titulo);
                    }}
                    aria-label={`Ver detalhamento de ${data.porTipoSimulacao.titulo}`}
                  >
                    <ReportChartView
                      chart={{
                        titulo: data.porTipoSimulacao.titulo,
                        tipo: "donut",
                        dados: data.porTipoSimulacao.dados,
                      }}
                    />
                  </div>
                </PanelCard>
              )}
              {data.clientesPorEtapa && data.clientesPorEtapa.dados.length > 0 && (
                <PanelCard
                  titulo={data.clientesPorEtapa.titulo}
                  subtitulo={data.clientesPorEtapa.subtitulo}
                  abrirTo="/crm/painel"
                  onOpen={() => abrirDetalhe(data.clientesPorEtapa!.titulo)}
                >
                  <div
                    className="w-full cursor-pointer overflow-hidden rounded-lg transition-colors hover:bg-primary/[0.02]"
                    role="button"
                    tabIndex={0}
                    onClick={() => abrirDetalhe(data.clientesPorEtapa!.titulo)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        abrirDetalhe(data.clientesPorEtapa!.titulo);
                    }}
                    aria-label={`Ver detalhamento de ${data.clientesPorEtapa.titulo}`}
                    style={{
                      height: Math.min(360, Math.max(180, data.clientesPorEtapa.dados.length * 40 + 44)),
                    }}
                  >
                    <ReportChartView
                      chart={{
                        titulo: data.clientesPorEtapa.titulo,
                        tipo: "barh",
                        dados: data.clientesPorEtapa.dados,
                      }}
                    />
                  </div>
                </PanelCard>
              )}
            </div>
          )}

          {(data.volumePorBanco || data.topOperadores || data.financeiroResumo) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {data.volumePorBanco && data.volumePorBanco.dados.length > 0 && (
                <PanelCard
                  titulo={data.volumePorBanco.titulo}
                  subtitulo={data.volumePorBanco.subtitulo}
                  onOpen={() => abrirDetalhe(data.volumePorBanco!.titulo)}
                >
                  <MetricList
                    items={data.volumePorBanco.dados.map((d) => ({
                      label: d.label,
                      valor: d.valor,
                      display: d.valor.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      }),
                    }))}
                    colorByBank
                    onItemClick={(label, valor) =>
                      abrirDetalhe(
                        label,
                        valor.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        }),
                      )
                    }
                  />
                </PanelCard>
              )}
              {data.topOperadores && data.topOperadores.dados.length > 0 && (
                <PanelCard
                  titulo={data.topOperadores.titulo}
                  subtitulo={data.topOperadores.subtitulo}
                  onOpen={() => abrirDetalhe(data.topOperadores!.titulo)}
                >
                  <MetricList
                    items={data.topOperadores.dados}
                    onItemClick={(label, valor) =>
                      abrirDetalhe(label, valor.toLocaleString("pt-BR"))
                    }
                  />
                </PanelCard>
              )}
              {data.financeiroResumo && (
                <PanelCard
                  titulo={data.financeiroResumo.titulo}
                  abrirTo="/financeiro/painel"
                  onOpen={() => abrirDetalhe(data.financeiroResumo!.titulo)}
                >
                  <div className="space-y-2">
                    {data.financeiroResumo.itens.map((i) => (
                      <button
                        type="button"
                        key={i.label}
                        onClick={() => abrirDetalhe(i.label, i.valor)}
                        className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-left transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="text-sm text-muted-foreground">{i.label}</span>
                        <span className="text-sm font-semibold tabular-nums">{i.valor}</span>
                      </button>
                    ))}
                  </div>
                </PanelCard>
              )}
            </div>
          )}

        </>

      )}

      <PainelDrilldownDialog
        open={!!drilldown}
        onOpenChange={(o) => !o && setDrilldown(null)}
        contexto={drilldown}
      />
    </div>
  );
}

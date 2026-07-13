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
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PanelHeader,
  SectionTitle,
  HeroMetric,
  MiniMetric,
  PanelCard,
  MetricList,
  AlertRow,
} from "@/components/common/dashboard";
import { ReportChartView } from "@/components/reports/report-chart";
import { VisionSelector } from "@/components/reports/report-filters-bar";
import { DateInput } from "@/components/shared/date-input";
import { UsuarioCombobox } from "@/components/operacional/usuario-combobox";
import { listarColegas } from "@/lib/operacional/shared.functions";
import { getPanelDados } from "@/lib/relatorios/paineis.functions";
import { getEscopoRelatorios } from "@/lib/relatorios/reports.functions";
import { PERIODO_LABEL, type Periodo, type Escopo } from "@/lib/relatorios/shared";

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
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : undefined;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-3 sm:p-4 md:space-y-8 md:p-6">
      <PanelHeader
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
              <SelectTrigger className="h-9 w-full sm:w-40">
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
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <DateInput
                  value={de}
                  onChange={setDe}
                  aria-invalid={!de}
                  className="h-9 w-full sm:w-36"
                  placeholder="Início"
                />
                <span className="hidden text-xs text-muted-foreground sm:inline">até</span>
                <DateInput
                  value={ate}
                  onChange={setAte}
                  aria-invalid={!ate}
                  className="h-9 w-full sm:w-36"
                  placeholder="Fim"
                />
              </div>
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
          <SectionTitle>Indicadores executivos</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.heros.map((h) => (
              <HeroMetric
                key={h.label}
                label={h.label}
                valor={h.valor}
                hint={h.hint}
                tone={h.tone}
                delta={h.delta}
                to={linkParaMetrica(h.label)}
              />
            ))}
          </div>

          <SectionTitle>Volumes</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {data.minis.map((m) => (
              <MiniMetric
                key={m.label}
                label={m.label}
                valor={m.valor}
                tone={m.tone}
                to={linkParaMetrica(m.label)}
              />
            ))}
          </div>

          {data.evolucao && data.evolucao.dados.length > 1 && (
            <>
              <SectionTitle>Evolução</SectionTitle>
              <PanelCard titulo={data.evolucao.titulo} subtitulo={data.evolucao.subtitulo}>
                <div className="h-[280px] w-full overflow-hidden">
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
            </>
          )}

          <SectionTitle>Operação</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PanelCard
                titulo={data.chart.titulo}
                subtitulo={data.chart.subtitulo}
                abrirTo={abrirTo}
              >
                <div
                  className="w-full overflow-hidden"
                  style={{
                    height: Math.min(
                      420,
                      Math.max(168, data.chart.dados.length * 52 + 44),
                    ),
                  }}

                >
                  <ReportChartView
                    chart={{ titulo: data.chart.titulo, tipo: "barh", dados: data.chart.dados }}
                    colorByBank={data.chart.porBanco}
                  />
                </div>
              </PanelCard>
            </div>
            <div className="space-y-4">
              {data.distribuicao && data.distribuicao.dados.length > 0 && (
                <PanelCard
                  titulo={data.distribuicao.titulo}
                  subtitulo={data.distribuicao.subtitulo}
                >
                  <div className="h-[240px] w-full overflow-hidden">
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
              )}
              <PanelCard titulo={data.ranking.titulo}>
                <MetricList items={data.ranking.itens} colorByBank={data.chart.porBanco} />
              </PanelCard>
              {data.recusadasPorBanco && data.recusadasPorBanco.itens.length > 0 && (
                <PanelCard titulo={data.recusadasPorBanco.titulo}>
                  <MetricList items={data.recusadasPorBanco.itens} colorByBank />
                </PanelCard>
              )}
            </div>
          </div>

          <SectionTitle>Alertas</SectionTitle>
          {data.alertas.length === 0 ? (
            <Card className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <p className="min-w-0 text-sm leading-snug text-muted-foreground">
                Operação sem alertas críticos.
              </p>
            </Card>
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
        </>
      )}
    </div>
  );
}

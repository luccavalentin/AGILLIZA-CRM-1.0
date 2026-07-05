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
import { getPanelDados } from "@/lib/relatorios/paineis.functions";
import { getEscopoRelatorios } from "@/lib/relatorios/reports.functions";
import { PERIODO_LABEL, type Periodo, type Escopo } from "@/lib/relatorios/shared";

const PERIODOS: Periodo[] = ["hoje", "7d", "15d", "30d", "mes", "mes_anterior", "ano", "custom"];

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
  const escopoTocado = useRef(false);

  const { data: perms } = useQuery({ queryKey: ["report-escopo"], queryFn: () => escopoFn(), staleTime: 5 * 60_000 });

  // Amplia o escopo automaticamente para quem pode ver equipe/geral (até o usuário mudar manualmente).
  useEffect(() => {
    if (escopoTocado.current || !perms) return;
    if (perms.podeGeral) setEscopo("geral");
    else if (perms.podeEquipe) setEscopo("equipe");
  }, [perms]);

  const mudarEscopo = (e: Escopo) => {
    escopoTocado.current = true;
    setEscopo(e);
  };

  const queryKey = ["panel", modulo, periodo, escopo];
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey,
    queryFn: () => dadosFn({ data: { modulo, periodo, escopo } }),
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase.channel(`panel-${modulo}`);
    realtimeTabelas.forEach((t) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table: t }, () => {
        qc.invalidateQueries({ queryKey: ["panel", modulo] });
      });
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [modulo, qc, realtimeTabelas]);

  const atualizado = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <PanelHeader
        eyebrow={eyebrow}
        titulo={titulo}
        descricao={descricao}
        atualizadoEm={atualizado}
        onRefresh={() => qc.invalidateQueries({ queryKey })}
        actions={
          <>
            <VisionSelector escopo={escopo} onChange={mudarEscopo} podeEquipe={perms?.podeEquipe ?? false} podeGeral={perms?.podeGeral ?? false} />value
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => <SelectItem key={p} value={p}>{PERIODO_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      {error ? (
        <Card className="flex items-center gap-3 p-4">
          <p className="text-sm text-muted-foreground">Não foi possível carregar os indicadores. Tente atualizar.</p>
        </Card>
      ) : isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <SectionTitle>Indicadores executivos</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.heros.map((h) => <HeroMetric key={h.label} label={h.label} valor={h.valor} hint={h.hint} tone={h.tone} />)}
          </div>

          <SectionTitle>Volumes</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {data.minis.map((m) => <MiniMetric key={m.label} label={m.label} valor={m.valor} tone={m.tone} />)}
          </div>

          <SectionTitle>Operação</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PanelCard titulo={data.chart.titulo} subtitulo={data.chart.subtitulo} abrirTo={abrirTo}>
                <div className="h-64 w-full">
                  <ReportChartView chart={{ titulo: data.chart.titulo, tipo: "barh", dados: data.chart.dados }} />
                </div>
              </PanelCard>
            </div>
            <PanelCard titulo={data.ranking.titulo}>
              <MetricList items={data.ranking.itens} />
            </PanelCard>
          </div>

          <SectionTitle>Alertas</SectionTitle>
          {data.alertas.length === 0 ? (
            <Card className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <p className="text-sm text-muted-foreground">Operação sem alertas críticos.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.alertas.map((a) => <AlertRow key={a.titulo} tone={a.tone} titulo={a.titulo} descricao={a.descricao} contador={a.contador} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

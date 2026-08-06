import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReportShell, ReportSection } from "@/components/reports/report-shell";
import { ReportFiltersBar, VisionSelector } from "@/components/reports/report-filters-bar";
import { ReportKpiCard, ChartCard } from "@/components/reports/report-kpi-card";
import { ReportChartView } from "@/components/reports/report-chart";
import { DrilldownTable } from "@/components/reports/drilldown-table";
import { ExportButtons } from "@/components/reports/export-buttons";
import { EmptyReport } from "@/components/reports/empty-report";
import { MonthlyComparison } from "@/components/reports/monthly-comparison";
import { runReport } from "@/lib/relatorios/reports.functions";
import { resolverDrillGrafico } from "@/lib/relatorios/chart-drill";
import { ESCOPO_LABEL, PERIODO_LABEL, type ReportFiltros, type ReportKpi } from "@/lib/relatorios/shared";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";


/** Página completa de relatório reutilizada por todas as rotas de /relatorios/*. */
export function GenericReportPage({
  codigo,
  filtros,
  onFiltros,
  podeEquipe,
  podeGeral,
  comFiltroBanco,
  comFiltroStatus,
  typeSelector,
}: {
  codigo: string;
  filtros: ReportFiltros;
  onFiltros: (f: ReportFiltros) => void;
  podeEquipe: boolean;
  podeGeral: boolean;
  comFiltroBanco?: boolean;
  comFiltroStatus?: boolean;
  typeSelector?: import("react").ReactNode;
}) {

  const run = useServerFn(runReport);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["report", codigo, filtros],
    queryFn: () => run({ data: { codigo, filtros } }),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  // Mantém KPIs (ticket médio, volumes, contratos) sincronizados em tempo real.
  useRealtimeInvalidate(`report-${codigo}`, [["report", codigo]]);

  const [kpiAberto, setKpiAberto] = useState<ReportKpi | null>(null);
  const linhasKpi = useMemo(() => {
    if (!kpiAberto?.filters?.length || !data?.rows) return [];
    return data.rows.filter((r) =>
      kpiAberto.filters!.every((f) => {
        const cell = r[f.key];
        return f.values.some((v) => String(cell ?? "") === String(v));
      }),
    );
  }, [kpiAberto, data]);

  // Detalhamento de gráficos: descobre a coluna equivalente aos rótulos de cada gráfico
  // para que clicar em uma barra/fatia abra as linhas que a compõem.
  const drills = useMemo(() => {
    if (!data) return new Map<string, ReturnType<typeof resolverDrillGrafico>>();
    const m = new Map<string, ReturnType<typeof resolverDrillGrafico>>();
    for (const c of data.charts) m.set(c.titulo, resolverDrillGrafico(c, data.columns, data.rows));
    return m;
  }, [data]);

  const [graficoAberto, setGraficoAberto] = useState<{
    titulo: string;
    label: string;
    valor: number;
    rows: import("@/lib/relatorios/shared").ReportRow[];
  } | null>(null);


  const metaArr = [
    `Período: ${PERIODO_LABEL[filtros.periodo]}`,
    `Escopo: ${ESCOPO_LABEL[filtros.escopo]}`,
    `Registros: ${(data?.rows.length ?? 0).toLocaleString("pt-BR")}`,
  ];

  // Opções completas de filtro vindas do servidor (todos os bancos/produtos/status cadastrados);
  // fallback para os valores presentes no resultado quando o relatório não as fornece.
  const disp = data?.filtrosDisponiveis;
  const bancos = comFiltroBanco
    ? (disp?.bancos ??
      [
        ...new Set((data?.rows ?? []).map((r) => String(r.nome_banco ?? "")).filter(Boolean)),
      ].sort())
    : undefined;
  const produtos = comFiltroBanco
    ? (disp?.produtos ??
      [...new Set((data?.rows ?? []).map((r) => String(r.produto ?? "")).filter(Boolean))].sort())
    : undefined;
  // Status e responsáveis são filtros universais: aparecem em todos os relatórios.
  const statuses =
    disp?.statuses ??
    (comFiltroStatus
      ? [...new Set((data?.rows ?? []).map((r) => String(r.status ?? "")).filter(Boolean))]
          .sort()
          .map((v) => ({ value: v, label: v }))
      : undefined);
  const analistas = disp?.analistas;
  const comerciais = disp?.comerciais;
  const corretores = disp?.corretores;
  const imobiliarias = disp?.imobiliarias;

  return (
    <ReportShell
      modulo={data?.modulo ?? "Operacional"}
      titulo={data?.titulo ?? "Relatório"}
      typeSelector={typeSelector}
      metaChips={metaArr}

      scopeSelector={
        <VisionSelector
          escopo={filtros.escopo}
          onChange={(e) => onFiltros({ ...filtros, escopo: e })}
          podeEquipe={podeEquipe}
          podeGeral={podeGeral}
        />
      }
      exportButtons={
        data ? (
          <ExportButtons codigo={codigo} result={data} meta={metaArr} filtros={filtros} />
        ) : null
      }
      filtros={
        <ReportFiltersBar
          filtros={filtros}
          onChange={onFiltros}
          bancos={bancos}
          produtos={produtos}
          statuses={statuses}
          analistas={analistas}
          comerciais={comerciais}
          corretores={corretores}
          imobiliarias={imobiliarias}
        />
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64" />
          <Skeleton className="h-72" />
        </div>
      ) : isError ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Não foi possível carregar o relatório.
        </p>
      ) : !data || data.rows.length === 0 ? (
        <>
          {data && data.kpis.length > 0 && (
            <ReportSection titulo="Indicadores">
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                {data.kpis.map((k) => (
                  <ReportKpiCard
                    key={k.label}
                    kpi={k}
                    onClick={k.filters?.length ? () => setKpiAberto(k) : undefined}
                  />
                ))}
              </div>
            </ReportSection>
          )}
          <EmptyReport onAmpliar={() => onFiltros({ ...filtros, periodo: "ano" })} />
        </>
      ) : (
        <>
          <ReportSection titulo="Indicadores">
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
              {data.kpis.map((k) => (
                <ReportKpiCard
                  key={k.label}
                  kpi={k}
                  onClick={k.filters?.length ? () => setKpiAberto(k) : undefined}
                />
              ))}
            </div>
          </ReportSection>


          <ReportSection titulo={`Detalhamento — ${data.rows.length} registros`}>
            <DrilldownTable columns={data.columns} rows={data.rows} />
          </ReportSection>

          {data.charts.length > 0 && (
            <ReportSection titulo="Análise">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.charts.map((c) => (
                  <ChartCard key={c.titulo} titulo={c.titulo} subtitulo={c.subtitulo}>
                    <ReportChartView
                      chart={c}
                      colorByBank={/banco/i.test(c.titulo)}
                      onSelect={(label, valor) => {
                        const d = drills.get(c.titulo);
                        setGraficoAberto({
                          titulo: c.titulo,
                          label,
                          valor,
                          rows: d ? d.filtrar(label) : [],
                        });
                      }}
                    />

                  </ChartCard>
                ))}
              </div>
            </ReportSection>
          )}

          {data.comparativoMensal && (
            <ReportSection titulo="Comparativo entre os meses — últimos 6 meses">
              <MonthlyComparison dados={data.comparativoMensal} />
            </ReportSection>
          )}

          {data.tabelas &&
            data.tabelas.length > 0 &&
            data.tabelas.map((grupo) => (
              <ReportSection key={grupo.titulo} titulo={grupo.titulo}>
                <div className="space-y-6">
                  {grupo.descricao && (
                    <p className="text-xs text-muted-foreground">{grupo.descricao}</p>
                  )}
                  {grupo.tabelas.map((t) => (
                    <div key={t.titulo} className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.titulo}</p>
                        {t.subtitulo && (
                          <p className="text-xs text-muted-foreground">{t.subtitulo}</p>
                        )}
                      </div>
                      <DrilldownTable columns={t.columns} rows={t.rows} />
                    </div>
                  ))}
                </div>
              </ReportSection>
            ))}
        </>
      )}

      <Dialog open={!!graficoAberto} onOpenChange={(o) => !o && setGraficoAberto(null)}>
        <DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {graficoAberto?.titulo} — {graficoAberto?.label}
            </DialogTitle>
          </DialogHeader>
          {graficoAberto && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Valor no gráfico:{" "}
                <span className="font-semibold text-foreground">
                  {graficoAberto.valor.toLocaleString("pt-BR")}
                </span>
                {graficoAberto.rows.length > 0 && (
                  <>
                    {" · "}
                    {graficoAberto.rows.length.toLocaleString("pt-BR")} registros
                  </>
                )}
              </p>
              {data && graficoAberto.rows.length > 0 ? (
                <DrilldownTable columns={data.columns} rows={graficoAberto.rows} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Este indicador é calculado a partir de várias etapas e não possui
                  registros diretamente vinculados ao rótulo selecionado.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!kpiAberto} onOpenChange={(o) => !o && setKpiAberto(null)}>
        <DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {kpiAberto?.titulo ?? kpiAberto?.label} — {linhasKpi.length.toLocaleString("pt-BR")} registros
            </DialogTitle>
          </DialogHeader>
          {data && kpiAberto && (
            <DrilldownTable columns={data.columns} rows={linhasKpi} />
          )}
        </DialogContent>
      </Dialog>
    </ReportShell>
  );

}

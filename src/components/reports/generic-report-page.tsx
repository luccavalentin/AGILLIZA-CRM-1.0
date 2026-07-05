import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportShell, ReportSection } from "@/components/reports/report-shell";
import { ReportFiltersBar, VisionSelector } from "@/components/reports/report-filters-bar";
import { ReportKpiCard, ChartCard } from "@/components/reports/report-kpi-card";
import { ReportChartView } from "@/components/reports/report-chart";
import { DrilldownTable } from "@/components/reports/drilldown-table";
import { ExportButtons } from "@/components/reports/export-buttons";
import { EmptyReport } from "@/components/reports/empty-report";
import { MonthlyComparison } from "@/components/reports/monthly-comparison";
import { runReport } from "@/lib/relatorios/reports.functions";
import { ESCOPO_LABEL, PERIODO_LABEL, type ReportFiltros } from "@/lib/relatorios/shared";

/** Página completa de relatório reutilizada por todas as rotas de /relatorios/*. */
export function GenericReportPage({
  codigo,
  filtros,
  onFiltros,
  podeEquipe,
  podeGeral,
  comFiltroBanco,
  comFiltroStatus,
}: {
  codigo: string;
  filtros: ReportFiltros;
  onFiltros: (f: ReportFiltros) => void;
  podeEquipe: boolean;
  podeGeral: boolean;
  comFiltroBanco?: boolean;
  comFiltroStatus?: boolean;
}) {
  const run = useServerFn(runReport);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["report", codigo, filtros],
    queryFn: () => run({ data: { codigo, filtros } }),
    staleTime: 60_000,
  });

  const meta = `Período: ${PERIODO_LABEL[filtros.periodo]} · Escopo: ${ESCOPO_LABEL[filtros.escopo]} · Registros: ${data?.rows.length ?? 0}`;
  const metaArr = [`Período: ${PERIODO_LABEL[filtros.periodo]}`, `Escopo: ${ESCOPO_LABEL[filtros.escopo]}`, `Registros: ${data?.rows.length ?? 0}`];

  // Opções completas de filtro vindas do servidor (todos os bancos/produtos/status cadastrados);
  // fallback para os valores presentes no resultado quando o relatório não as fornece.
  const disp = data?.filtrosDisponiveis;
  const bancos = comFiltroBanco
    ? disp?.bancos ?? [...new Set((data?.rows ?? []).map((r) => String(r.nome_banco ?? "")).filter(Boolean))].sort()
    : undefined;
  const produtos = comFiltroBanco
    ? disp?.produtos ?? [...new Set((data?.rows ?? []).map((r) => String(r.produto ?? "")).filter(Boolean))].sort()
    : undefined;
  const statuses = comFiltroStatus
    ? disp?.statuses ??
      [...new Set((data?.rows ?? []).map((r) => String(r.status ?? "")).filter(Boolean))]
        .sort()
        .map((v) => ({ value: v, label: v }))
    : undefined;

  return (
    <ReportShell
      modulo={data?.modulo ?? "—"}
      titulo={data?.titulo ?? "Relatório"}
      descricao={data?.descricao ?? "Carregando…"}
      meta={meta}
      scopeSelector={<VisionSelector escopo={filtros.escopo} onChange={(e) => onFiltros({ ...filtros, escopo: e })} podeEquipe={podeEquipe} podeGeral={podeGeral} />}
      exportButtons={data ? <ExportButtons codigo={codigo} result={data} meta={metaArr} filtros={filtros} /> : null}
      filtros={<ReportFiltersBar filtros={filtros} onChange={onFiltros} bancos={bancos} produtos={produtos} statuses={statuses} />}
    >
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-64" />
          <Skeleton className="h-72" />
        </div>
      ) : isError ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Não foi possível carregar o relatório.</p>
      ) : !data || data.rows.length === 0 ? (
        <>
          {data && data.kpis.length > 0 && (
            <ReportSection titulo="Indicadores">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {data.kpis.map((k) => <ReportKpiCard key={k.label} kpi={k} />)}
              </div>
            </ReportSection>
          )}
          <EmptyReport onAmpliar={() => onFiltros({ ...filtros, periodo: "ano" })} />
        </>
      ) : (
        <>
          <ReportSection titulo="Indicadores">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {data.kpis.map((k) => <ReportKpiCard key={k.label} kpi={k} />)}
            </div>
          </ReportSection>

          {data.charts.length > 0 && (
            <ReportSection titulo="Análise">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.charts.map((c) => (
                  <ChartCard key={c.titulo} titulo={c.titulo} subtitulo={c.subtitulo}>
                    <ReportChartView chart={c} />
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

          <ReportSection titulo={`Detalhamento — ${data.rows.length} registros`}>
            <DrilldownTable columns={data.columns} rows={data.rows} />
          </ReportSection>
        </>
      )}
    </ReportShell>
  );
}

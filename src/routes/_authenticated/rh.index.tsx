import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  UsersRound,
  UserCheck,
  UserMinus,
  UserPlus,
  Plane,
  AlertTriangle,
  FileClock,
  Wallet,
  CalendarClock,
  CalendarCheck2,
  Clock3,
  Repeat,
  type LucideIcon,
} from "lucide-react";

import { assertModuloPermitido } from "@/lib/route-guards";
import { obterKpisRh } from "@/lib/rh/dashboard.functions";
import { listarFuncionarios } from "@/lib/rh/funcionarios.functions";
import { ReportKpiCard, type KpiTone } from "@/components/financeiro/kpi-card";
import { PanelHeader, SectionTitle } from "@/components/common/dashboard";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/financeiro/format";
import { KpiDrilldownDialog, type KpiDrillItem } from "@/components/reports/kpi-drilldown-dialog";

export const Route = createFileRoute("/_authenticated/rh/")({
  head: () => ({ meta: [{ title: "Gestão de Pessoas e RH — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.dashboard"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar o painel.</div>
  ),
});

type KpiRhKey = "ativos" | "afastados" | "ferias" | "total" | "custo";

function Pagina() {
  const fn = useServerFn(obterKpisRh);
  const listarFn = useServerFn(listarFuncionarios);
  const [drill, setDrill] = useState<KpiRhKey | null>(null);
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["rh-kpis"],
    queryFn: () => fn(),
  });

  const drillQuery = useQuery({
    enabled: !!drill,
    queryKey: ["rh-kpi-drill", drill],
    queryFn: async () => {
      if (!drill) return { itens: [] as KpiDrillItem[] };
      const statusMap: Record<KpiRhKey, string | undefined> = {
        ativos: "ativo",
        afastados: "afastado",
        ferias: "ferias",
        total: undefined,
        custo: undefined,
      };
      const r = await listarFn({
        data: { status: statusMap[drill] },
      });
      let itens = r;
      if (drill === "total") {
        itens = itens.filter((f) => f.status !== "desligado");
      }
      if (drill === "custo") {
        itens = [...itens]
          .filter((f) => f.status !== "desligado")
          .sort((a, b) => (b.salario_atual ?? 0) - (a.salario_atual ?? 0))
          .slice(0, 10);
      }
      const kpiItens: KpiDrillItem[] = itens.slice(0, 15).map((f) => ({
        label: f.nome,
        sub: [f.cargo_nome, f.departamento_nome].filter(Boolean).join(" · ") || undefined,
        valor: drill === "custo" ? formatBRL(f.salario_atual ?? 0) : undefined,
        to: "/rh/funcionarios",
      }));
      return { itens: kpiItens };
    },
  });

  const drillMeta: Record<
    KpiRhKey,
    {
      titulo: string;
      subtitulo: string;
      valor: string;
      icon: LucideIcon;
      tone: KpiTone;
      empty: string;
    }
  > = useMemo(
    () => ({
      ativos: {
        titulo: "Funcionários ativos",
        subtitulo: "Colaboradores com contrato ativo",
        valor: String(data?.ativos ?? 0),
        icon: UserCheck,
        tone: "success",
        empty: "Sem funcionários ativos.",
      },
      afastados: {
        titulo: "Funcionários afastados",
        subtitulo: "Colaboradores em afastamento",
        valor: String(data?.afastados ?? 0),
        icon: UserMinus,
        tone: "danger",
        empty: "Sem afastamentos ativos.",
      },
      ferias: {
        titulo: "Funcionários em férias",
        subtitulo: "Períodos de férias em curso",
        valor: String(data?.ferias ?? 0),
        icon: Plane,
        tone: "brand",
        empty: "Sem funcionários em férias.",
      },
      total: {
        titulo: "Quadro total",
        subtitulo: "Ativos, em experiência, afastados e férias",
        valor: String(
          (data?.ativos ?? 0) +
            (data?.experiencia ?? 0) +
            (data?.afastados ?? 0) +
            (data?.ferias ?? 0),
        ),
        icon: UsersRound,
        tone: "brand",
        empty: "Quadro vazio.",
      },
      custo: {
        titulo: "Custo mensal estimado",
        subtitulo: "Top 10 salários vigentes",
        valor: formatBRL(data?.custoMensalEstimado ?? 0),
        icon: Wallet,
        tone: "brand",
        empty: "Sem salários cadastrados.",
      },
    }),
    [data],
  );

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
        eyebrow="Gestão de Pessoas e RH · Painel"
        titulo="Gestão de Pessoas e RH"
        descricao="Quadro de funcionários, custos e movimentações do período."
        atualizadoEm={atualizado}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/rh/funcionarios">Ver funcionários</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/rh/funcionarios/novo">
                <UserPlus className="mr-2 h-4 w-4" /> Novo funcionário
              </Link>
            </Button>
          </div>
        }
      />

      <SectionTitle>Quadro de funcionários</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportKpiCard
          titulo="Ativos"
          valor={String(data?.ativos ?? 0)}
          icon={UserCheck}
          tone="success"
          onClick={() => setDrill("ativos")}
        />
        <ReportKpiCard
          titulo="Afastados"
          valor={String(data?.afastados ?? 0)}
          icon={UserMinus}
          tone="danger"
          onClick={() => setDrill("afastados")}
        />
        <ReportKpiCard
          titulo="Em férias"
          valor={String(data?.ferias ?? 0)}
          icon={Plane}
          tone="brand"
          onClick={() => setDrill("ferias")}
        />
        <ReportKpiCard
          titulo="Quadro total"
          valor={String(
            (data?.ativos ?? 0) +
              (data?.experiencia ?? 0) +
              (data?.afastados ?? 0) +
              (data?.ferias ?? 0),
          )}
          icon={UsersRound}
          tone="brand"
          onClick={() => setDrill("total")}
        />
      </div>

      <SectionTitle>Financeiro do mês</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportKpiCard
          titulo="Custo mensal estimado"
          valor={formatBRL(data?.custoMensalEstimado ?? 0)}
          icon={Wallet}
          tone="brand"
          sub="Soma dos salários atuais"
          onClick={() => setDrill("custo")}
        />
        <ReportKpiCard
          titulo="Férias programadas"
          valor={String(data?.feriasProgramadas ?? 0)}
          icon={Plane}
          tone="brand"
          to="/rh/ferias"
        />
        <ReportKpiCard
          titulo="Faltas no mês"
          valor={String(data?.faltasMes ?? 0)}
          icon={AlertTriangle}
          tone="warning"
          to="/rh/faltas-ocorrencias"
        />
        <ReportKpiCard
          titulo="Atestados no mês"
          valor={String(data?.atestadosMes ?? 0)}
          icon={FileClock}
          tone="warning"
          to="/rh/atestados"
        />
      </div>

      <SectionTitle>Férias (CLT) e tempo de casa</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportKpiCard
          titulo="Com férias vencidas"
          valor={String(data?.feriasVencidas ?? 0)}
          icon={AlertTriangle}
          tone="danger"
          sub="Risco de pagamento em dobro"
          to="/rh/ferias"
        />
        <ReportKpiCard
          titulo="Vencem em 90 dias"
          valor={String(data?.feriasAVencer90 ?? 0)}
          icon={CalendarClock}
          tone="warning"
          sub="Programar concessão"
          to="/rh/ferias"
        />
        <ReportKpiCard
          titulo="Saldo de dias"
          valor={String(data?.feriasSaldoDias ?? 0)}
          icon={CalendarCheck2}
          tone="brand"
          sub="Adquiridos e não gozados"
          to="/rh/ferias"
        />
        <ReportKpiCard
          titulo="Provisão de férias"
          valor={formatBRL(data?.feriasProvisao ?? 0)}
          icon={Wallet}
          tone="brand"
          sub="Valor provisionado"
          to="/rh/ferias"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportKpiCard
          titulo="Tempo médio de casa"
          valor={`${Math.floor((data?.tempoMedioCasaMeses ?? 0) / 12)}a ${(data?.tempoMedioCasaMeses ?? 0) % 12}m`}
          icon={Clock3}
          tone="brand"
          sub="Média do quadro ativo"
        />
        <ReportKpiCard
          titulo="Admissões no mês"
          valor={String(data?.admissoesMes ?? 0)}
          icon={UserPlus}
          tone="success"
          to="/rh/funcionarios"
        />
        <ReportKpiCard
          titulo="Desligamentos no mês"
          valor={String(data?.desligamentosMes ?? 0)}
          icon={UserMinus}
          tone="danger"
          to="/rh/funcionarios"
        />
        <ReportKpiCard
          titulo="Turnover do mês"
          valor={`${(data?.turnoverMes ?? 0).toLocaleString("pt-BR")}%`}
          icon={Repeat}
          tone="warning"
          sub="Movimentação do quadro"
        />
      </div>

      {/*
        Visualizar todos: os lançamentos saíram do menu lateral e vivem na ficha
        do funcionário, mas o gestor ainda precisa da visão consolidada.
      */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Visualizar todos</h2>
          <p className="text-xs text-muted-foreground">
            Visões consolidadas da empresa. O lançamento individual é feito na ficha de cada
            funcionário.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { to: "/rh/beneficios", label: "Benefícios" },
            { to: "/rh/adiantamentos", label: "Adiantamentos" },
            { to: "/rh/descontos", label: "Descontos" },
            { to: "/rh/alteracoes-salariais", label: "Alterações salariais" },
            { to: "/rh/previa-folha", label: "Prévia da folha" },
            { to: "/rh/holerites", label: "Holerites" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-all hover:scale-[1.01] hover:border-primary/50 hover:shadow-sm"
            >
              {l.label}
            </Link>
          ))}
        </div>
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
          linkAbrir="/rh/funcionarios"
          linkAbrirLabel="Ver todos os funcionários"
          empty={drillMeta[drill].empty}
        />
      )}
    </div>
  );
}

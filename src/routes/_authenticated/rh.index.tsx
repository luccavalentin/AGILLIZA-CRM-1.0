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
  type LucideIcon,
} from "lucide-react";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { assertModuloPermitido } from "@/lib/route-guards";
import { obterKpisRh } from "@/lib/rh/dashboard.functions";
import { listarFuncionarios } from "@/lib/rh/funcionarios.functions";
import { ReportKpiCard, type KpiTone } from "@/components/financeiro/kpi-card";
import { PanelHeader, SectionTitle, PanelCard } from "@/components/common/dashboard";
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

function mesLabel(iso: string) {
  const [y, m] = iso.split("-");
  return `${m}/${y.slice(2)}`;
}

type KpiRhKey = "ativos" | "afastados" | "ferias" | "total" | "custo";

function Pagina() {
  const fn = useServerFn(obterKpisRh);
  const listarFn = useServerFn(listarFuncionarios);
  const [drill, setDrill] = useState<KpiRhKey | null>(null);
  const { data, isLoading, dataUpdatedAt } = useQuery({
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
    { titulo: string; subtitulo: string; valor: string; icon: LucideIcon; tone: KpiTone; empty: string }
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
          (data?.ativos ?? 0) + (data?.experiencia ?? 0) + (data?.afastados ?? 0) + (data?.ferias ?? 0),
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

  const admissoes = (data?.admissoesUltimos12 ?? []).map((r) => ({ ...r, label: mesLabel(r.mes) }));
  const desligamentos = (data?.desligamentosUltimos12 ?? []).map((r) => ({
    ...r,
    label: mesLabel(r.mes),
  }));
  const evolucao = admissoes.map((a, i) => ({
    label: a.label,
    admissoes: a.total,
    desligamentos: desligamentos[i]?.total ?? 0,
  }));

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
        <ReportKpiCard titulo="Ativos" valor={String(data?.ativos ?? 0)} icon={UserCheck} tone="success" onClick={() => setDrill("ativos")} />
        <ReportKpiCard titulo="Afastados" valor={String(data?.afastados ?? 0)} icon={UserMinus} tone="danger" onClick={() => setDrill("afastados")} />
        <ReportKpiCard titulo="Em férias" valor={String(data?.ferias ?? 0)} icon={Plane} tone="brand" onClick={() => setDrill("ferias")} />
        <ReportKpiCard titulo="Quadro total" valor={String((data?.ativos ?? 0) + (data?.experiencia ?? 0) + (data?.afastados ?? 0) + (data?.ferias ?? 0))} icon={UsersRound} tone="brand" onClick={() => setDrill("total")} />
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
        <ReportKpiCard titulo="Férias programadas" valor={String(data?.feriasProgramadas ?? 0)} icon={Plane} tone="brand" to="/rh/ferias" />
        <ReportKpiCard titulo="Faltas no mês" valor={String(data?.faltasMes ?? 0)} icon={AlertTriangle} tone="warning" to="/rh/faltas-ocorrencias" />
        <ReportKpiCard titulo="Atestados no mês" valor={String(data?.atestadosMes ?? 0)} icon={FileClock} tone="warning" to="/rh/atestados" />
      </div>


      <SectionTitle>Movimentação do quadro</SectionTitle>
      <PanelCard titulo="Admissões vs. desligamentos" subtitulo="Últimos 12 meses">
        <div className="h-72 w-full">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={40} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar dataKey="admissoes" name="Admissões" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="desligamentos" name="Desligamentos" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </PanelCard>

      <SectionTitle>Distribuição por departamento</SectionTitle>
      <PanelCard titulo="Quadro por departamento" subtitulo="Excluindo desligados">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.quadroPorDepartamento ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={140} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="total" name="Funcionários" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PanelCard>
    </div>
  );
}

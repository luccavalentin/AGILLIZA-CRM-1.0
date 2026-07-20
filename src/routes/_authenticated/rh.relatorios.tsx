import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, DollarSign, TrendingUp, Users } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { obterKpisRh } from "@/lib/rh/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/rh/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · RH — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.relatorios"),
  component: RelatoriosRhPage,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RelatoriosRhPage() {
  const fn = useServerFn(obterKpisRh);
  const { data, isLoading } = useQuery({ queryKey: ["rh-kpis"], queryFn: () => fn() });

  const admissoes = (data?.admissoesUltimos12 ?? []).map((m) => ({
    mes: m.mes.slice(5),
    total: m.total,
  }));
  const desligamentos = (data?.desligamentosUltimos12 ?? []).map((m) => ({
    mes: m.mes.slice(5),
    total: m.total,
  }));
  const quadro = data?.quadroPorDepartamento ?? [];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">
          Relatórios de RH
        </h1>
        <p className="text-xs text-muted-foreground">
          Indicadores consolidados de pessoas, admissões e custo mensal.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          titulo="Funcionários ativos"
          valor={String((data?.ativos ?? 0) + (data?.experiencia ?? 0))}
          detalhe={`${data?.experiencia ?? 0} em experiência`}
          loading={isLoading}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          titulo="Em férias / afastados"
          valor={String((data?.ferias ?? 0) + (data?.afastados ?? 0))}
          detalhe={`${data?.ferias ?? 0} em férias`}
          loading={isLoading}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          titulo="Desligados"
          valor={String(data?.desligados ?? 0)}
          detalhe="Histórico total"
          loading={isLoading}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          titulo="Custo mensal estimado"
          valor={brl(data?.custoMensalEstimado ?? 0)}
          detalhe="Soma dos salários base"
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admissões (últimos 12 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={admissoes}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desligamentos (últimos 12 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={desligamentos}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quadro por departamento</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : quadro.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sem funcionários cadastrados.
            </div>
          ) : (
            <div className="space-y-2">
              {quadro.map((d) => {
                const max = Math.max(...quadro.map((x) => x.total));
                const pct = max > 0 ? (d.total / max) * 100 : 0;
                return (
                  <div key={d.nome} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{d.nome}</span>
                      <span className="text-muted-foreground">{d.total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relatórios detalhados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <RelLink to="/rh/funcionarios" titulo="Quadro de funcionários" desc="Lista completa com filtros por cargo, departamento e status." />
          <RelLink to="/rh/ferias" titulo="Controle de férias" desc="Períodos aquisitivos e programados." />
          <RelLink to="/rh/faltas-ocorrencias" titulo="Faltas e ocorrências" desc="Registros por competência e funcionário." />
          <RelLink to="/rh/previa-folha" titulo="Prévia da folha" desc="Consolidado mensal com fechamento e envio ao financeiro." />
          <RelLink to="/rh/adiantamentos" titulo="Adiantamentos" desc="Lançamentos por competência." />
          <RelLink to="/rh/descontos" titulo="Descontos" desc="Deduções aplicadas na folha." />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  titulo,
  valor,
  detalhe,
  loading,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{titulo}</span>
        </div>
        <div className="text-xl font-semibold text-foreground md:text-2xl">
          {loading ? "…" : valor}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{detalhe}</div>
      </CardContent>
    </Card>
  );
}

function RelLink({ to, titulo, desc }: { to: string; titulo: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
    >
      <BarChart3 className="mt-0.5 h-4 w-4 text-primary" />
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-primary">
          {titulo}
        </div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </Link>
  );
}

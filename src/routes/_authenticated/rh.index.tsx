import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  Cake,
  FileWarning,
  Hourglass,
  Palmtree,
  Repeat,
  Stethoscope,
  UserMinus,
  UserPlus,
  UsersRound,
  Wallet,
  ClipboardCheck,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { obterKpisRh } from "@/lib/rh/dashboard.functions";
import { ReportKpiCard } from "@/components/financeiro/kpi-card";
import { PanelHeader, SectionTitle } from "@/components/common/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoLista } from "@/components/rh/estado-lista";
import { formatBRL, formatData } from "@/lib/financeiro/format";

export const Route = createFileRoute("/_authenticated/rh/")({
  head: () => ({ meta: [{ title: "Gestão de Pessoas e RH — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.dashboard"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar o painel.</div>
  ),
});

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function Pagina() {
  const fn = useServerFn(obterKpisRh);
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["rh-kpis"], queryFn: () => fn() });
  const d = q.data;

  const atualizado = q.dataUpdatedAt
    ? new Date(q.dataUpdatedAt).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      })
    : undefined;

  if (!d) {
    return (
      <div className="mx-auto w-full max-w-[1600px] p-3 sm:p-4 md:p-6">
        <EstadoLista q={q} vazio="" erro="Não foi possível carregar o painel de RH." />
      </div>
    );
  }

  const maxMov = Math.max(1, ...d.admissoesUltimos12.map((m) => m.total), ...d.desligamentosUltimos12.map((m) => m.total));
  const maxDep = Math.max(1, ...d.quadroPorDepartamento.map((x) => x.total));

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-3 sm:p-4 md:space-y-8 md:p-6">
      <PanelHeader
        eyebrow="Gestão de Pessoas e RH · Painel"
        titulo="Gestão de Pessoas e RH"
        descricao="Quadro, movimentação, ausências, férias, documentos e custo da folha."
        atualizadoEm={atualizado}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/rh/folha">
                <CalendarRange className="mr-2 h-4 w-4" /> Folha do mês
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/rh/funcionarios/novo">
                <UserPlus className="mr-2 h-4 w-4" /> Admitir
              </Link>
            </Button>
          </div>
        }
      />

      <SectionTitle>Quadro e movimentação</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ReportKpiCard
          titulo="Headcount"
          valor={String(d.headcount)}
          icon={UsersRound}
          tone="brand"
          sub={`${d.ativos} ativos · ${d.experiencia} em experiência`}
          to="/rh/funcionarios"
        />
        <ReportKpiCard
          titulo="Admissões no mês"
          valor={String(d.admissoesMes)}
          icon={UserPlus}
          tone="success"
          sub={`${d.admissoes12} nos últimos 12 meses`}
          to="/rh/funcionarios"
        />
        <ReportKpiCard
          titulo="Desligamentos no mês"
          valor={String(d.desligamentosMes)}
          icon={UserMinus}
          tone="danger"
          sub={`${d.desligamentos12} nos últimos 12 meses`}
          to="/rh/funcionarios"
        />
        <ReportKpiCard
          titulo="Turnover 12 meses"
          valor={`${d.turnover12.toLocaleString("pt-BR")}%`}
          icon={Repeat}
          tone="warning"
          sub="Desligamentos ÷ quadro médio"
        />
      </div>

      <SectionTitle>Ausências, férias e documentos</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ReportKpiCard
          titulo="Absenteísmo do mês"
          valor={`${d.absenteismoMes.toLocaleString("pt-BR")}%`}
          icon={Stethoscope}
          tone={d.absenteismoMes > 3 ? "danger" : "warning"}
          sub={`${d.faltasDiasMes} dia(s) de falta · ${d.atestadosDiasMes} de atestado`}
          onClick={() => navigate({ to: "/rh/folha", search: { aba: "ocorrencias" } })}
        />
        <ReportKpiCard
          titulo="Férias vencidas"
          valor={String(d.feriasVencidas)}
          icon={AlertTriangle}
          tone="danger"
          sub={`${d.feriasAVencer90} vencem em 90 dias`}
          to="/rh/ferias"
        />
        <ReportKpiCard
          titulo="Documentos vencendo"
          valor={String(d.documentosVencendo30)}
          icon={FileWarning}
          tone="warning"
          sub={`${d.documentosVencidos} vencido(s) · próximos 30 dias`}
          to="/rh/documentos"
        />
        <ReportKpiCard
          titulo="Admissão pendente"
          valor={String(d.checklistPendentes)}
          icon={ClipboardCheck}
          tone="warning"
          sub="Documentos obrigatórios não entregues"
          to="/rh/funcionarios"
        />
      </div>

      {d.custo && (
        <>
          <SectionTitle>Custo da folha</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ReportKpiCard
              titulo={d.custo.fonte === "competencia" ? `Proventos ${d.custo.competencia}` : "Salários do quadro"}
              valor={formatBRL(d.custo.totalProventos)}
              icon={Wallet}
              tone="brand"
              sub={d.custo.fonte === "competencia" ? "Última competência fechada" : "Nenhuma competência fechada ainda"}
              onClick={() => navigate({ to: "/rh/folha", search: { aba: "previa" } })}
            />
            <ReportKpiCard
              titulo="Líquido pago"
              valor={d.custo.fonte === "competencia" ? formatBRL(d.custo.totalLiquido) : "—"}
              icon={Wallet}
              tone="brand"
              sub={d.custo.competencia ?? "—"}
              onClick={() => navigate({ to: "/rh/folha", search: { aba: "previa" } })}
            />
            <ReportKpiCard
              titulo="Salários vigentes"
              valor={formatBRL(d.custo.salariosAtivos)}
              icon={Wallet}
              tone="brand"
              sub="Soma do quadro hoje"
            />
            <ReportKpiCard
              titulo="Provisão de férias"
              valor={formatBRL(d.custo.provisaoFerias)}
              icon={Palmtree}
              tone="brand"
              sub="Saldo + proporcional + 1/3"
              to="/rh/ferias"
            />
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Admissões e desligamentos · 12 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-1.5 sm:gap-2">
              {d.admissoesUltimos12.map((m, i) => {
                const des = d.desligamentosUltimos12[i]?.total ?? 0;
                return (
                  <div key={m.mes} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-32 w-full items-end justify-center gap-0.5">
                      <div
                        className="w-1/2 max-w-[14px] rounded-t bg-primary"
                        style={{ height: `${(m.total / maxMov) * 100}%` }}
                        title={`${m.total} admissão(ões)`}
                      />
                      <div
                        className="w-1/2 max-w-[14px] rounded-t bg-destructive/70"
                        style={{ height: `${(des / maxMov) * 100}%` }}
                        title={`${des} desligamento(s)`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{MESES[Number(m.mes.slice(5, 7)) - 1]}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-primary" /> Admissões
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-destructive/70" /> Desligamentos
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quadro por departamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {d.quadroPorDepartamento.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem colaboradores no quadro.</p>
            ) : (
              d.quadroPorDepartamento.map((x) => (
                <div key={x.nome}>
                  <div className="flex justify-between text-xs">
                    <span className="truncate text-foreground">{x.nome}</span>
                    <span className="tabular-nums text-muted-foreground">{x.total}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(x.total / maxDep) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="h-4 w-4 text-primary" /> Aniversariantes do mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.aniversariantes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguém faz aniversário este mês.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {d.aniversariantes.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <Link to="/rh/funcionarios/$id" params={{ id: a.id }} className="min-w-0 truncate hover:text-primary">
                      {a.nome}
                      {a.cargo ? <span className="text-xs text-muted-foreground"> · {a.cargo}</span> : null}
                    </Link>
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                      dia {a.dia}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Hourglass className="h-4 w-4 text-primary" /> Experiência terminando (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.experienciaVencendo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contrato de experiência terminando.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {d.experienciaVencendo.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3">
                    <Link to="/rh/funcionarios/$id" params={{ id: e.id }} className="min-w-0 truncate hover:text-primary">
                      {e.nome}
                    </Link>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" /> {formatData(e.fim)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

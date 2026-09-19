import { AdminHero } from "@/components/admin/admin-hero";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarClock, ShieldCheck, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  estatisticasAuditoria,
  listarAuditoria,
  opcoesAuditoria,
  type AuditoriaLinha,
} from "@/lib/admin/auditoria.functions";
import {
  chaveDia,
  FILTROS_VAZIOS,
  type Filtros,
} from "@/components/admin/auditoria-page/helpers";
import { Kpi } from "@/components/admin/auditoria-page/kpi";
import { BarraFiltros } from "@/components/admin/auditoria-page/filtros";
import { TimelineAuditoria, VazioAuditoria } from "@/components/admin/auditoria-page/timeline";
import { DetalheAuditoria } from "@/components/admin/auditoria-page/detalhe";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.auditoria"),
  component: Pagina,
});

function Pagina() {
  const [rascunho, setRascunho] = useState<Filtros>(FILTROS_VAZIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [selecionado, setSelecionado] = useState<AuditoriaLinha | null>(null);

  const opcoes = useQuery({
    queryKey: ["admin-auditoria-opcoes"],
    queryFn: () => opcoesAuditoria(),
  });

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (aplicados.dataInicio) p.dataInicio = new Date(aplicados.dataInicio).toISOString();
    if (aplicados.dataFim) {
      const d = new Date(aplicados.dataFim);
      d.setHours(23, 59, 59, 999);
      p.dataFim = d.toISOString();
    }
    if (aplicados.userId) p.userId = aplicados.userId;
    if (aplicados.acao) p.acao = aplicados.acao;
    if (aplicados.entidade) p.entidade = aplicados.entidade;
    if (aplicados.busca.trim()) p.busca = aplicados.busca.trim();
    return p;
  }, [aplicados]);

  const q = useQuery({
    queryKey: ["admin-auditoria", params],
    queryFn: () => listarAuditoria({ data: params }),
  });

  // Os números do topo vêm contados do banco: a lista traz só as 200 linhas
  // mais recentes, e contar em cima delas travava "Eventos no período" em 200.
  const stats = useQuery({
    queryKey: ["admin-auditoria-kpis", params],
    queryFn: () => estatisticasAuditoria({ data: params }),
  });

  const registros = (q.data ?? []) as AuditoriaLinha[];
  const temFiltro = Object.values(aplicados).some((v) => v);
  const qtdFiltros = Object.values(aplicados).filter((v) => v).length;

  const kpis = stats.data ?? { total: 0, hoje: 0, usuarios: 0, topAcao: "—" };

  const grupos = useMemo(() => {
    const mapa = new Map<string, AuditoriaLinha[]>();
    for (const r of registros) {
      const k = chaveDia(r.created_at);
      const arr = mapa.get(k) ?? [];
      arr.push(r);
      mapa.set(k, arr);
    }
    return [...mapa.entries()];
  }, [registros]);

  function aplicar() {
    setAplicados(rascunho);
  }
  function limpar() {
    setRascunho(FILTROS_VAZIOS);
    setAplicados(FILTROS_VAZIOS);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<ShieldCheck className="h-5 w-5" />}
        titulo="Auditoria e Logs"
        descricao="Acompanhe o histórico de ações e exportações realizadas no ecossistema."
        acoes={
          <Link to={"/admin/auditoria/manutencao" as any} className="contents">
            <Button variant="outline" size="sm" className="gap-2">
              <Wrench className="h-4 w-4" />
              Manutenção
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {q.isLoading || stats.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
          ))
        ) : (
          <>
            <Kpi icon={Activity} valor={kpis.total} rotulo="Eventos no período" />
            <Kpi icon={CalendarClock} valor={kpis.hoje} rotulo="Eventos hoje" />
            <Kpi icon={Users} valor={kpis.usuarios} rotulo="Usuários envolvidos" />
            <Kpi icon={ShieldCheck} valor={kpis.topAcao} rotulo="Operação mais frequente" />
          </>
        )}
      </div>

      <BarraFiltros
        rascunho={rascunho}
        setRascunho={setRascunho}
        aplicar={aplicar}
        limpar={limpar}
        temFiltro={temFiltro}
        qtdFiltros={qtdFiltros}
        filtrosAbertos={filtrosAbertos}
        setFiltrosAbertos={setFiltrosAbertos}
        opcoes={opcoes.data}
        registros={registros}
      />

      {q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : registros.length === 0 ? (
        <VazioAuditoria temFiltro={temFiltro} />
      ) : (
        <TimelineAuditoria grupos={grupos} onSelecionar={setSelecionado} />
      )}

      <DetalheAuditoria registro={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarClientes,
  excluirCliente,
  estatisticasClientes,
  listarEtapasPipeline,
} from "@/lib/crm/clientes.functions";
import { listarColegas } from "@/lib/operacional/shared.functions";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";
import { KpiCards } from "@/components/crm/clientes-page/kpi-cards";
import { FiltrosClientes } from "@/components/crm/clientes-page/filtros";
import { ListaMobile } from "@/components/crm/clientes-page/lista-mobile";
import { ListaDesktop } from "@/components/crm/clientes-page/lista-desktop";
import type { Escopo, Portal, StatusF } from "@/components/crm/clientes-page/tipos";

export const Route = createFileRoute("/_authenticated/crm/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar clientes.</div>
  ),
});

function Pagina() {
  usePipelineRealtime();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listar = useServerFn(listarClientes);
  const excluir = useServerFn(excluirCliente);
  const stats = useServerFn(estatisticasClientes);
  const etapasFn = useServerFn(listarEtapasPipeline);
  const colegasFn = useServerFn(listarColegas);

  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [etapa, setEtapa] = useState<string>("todas");
  const [responsavel, setResponsavel] = useState<string>("todos");
  const [portal, setPortal] = useState<Portal>("todos");
  const [statusF, setStatusF] = useState<StatusF>("todos");
  const [escopo, setEscopo] = useState<Escopo>(
    () =>
      (typeof window !== "undefined" && (localStorage.getItem("clientes:escopo") as Escopo)) ||
      "geral",
  );

  // Busca ao vivo (debounced): reflete no filtro conforme o usuário digita.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusca(q.trim());
      setPagina(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const filtros = useMemo(
    () => ({
      q: busca,
      pagina,
      porPagina: 20,
      escopo,
      etapa: etapa === "todas" ? undefined : etapa,
      responsavel: responsavel === "todos" ? undefined : responsavel,
      portal: portal === "todos" ? undefined : portal,
      status: statusF === "todos" ? undefined : statusF,
    }),
    [busca, pagina, escopo, etapa, responsavel, portal, statusF],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["clientes", filtros],
    queryFn: () => listar({ data: filtros }),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // KPIs precisam refletir imediatamente inclusões/exclusões feitas em outras
  // telas (novo cliente, ficha, portal). Por isso não usam cache "morno".
  const { data: kpis } = useQuery({
    queryKey: ["clientes-stats", escopo],
    queryFn: () => stats({ data: { escopo } }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: etapas } = useQuery({
    queryKey: ["pipeline-etapas"],
    queryFn: () => etapasFn(),
    staleTime: 5 * 60_000,
  });

  const { data: colegas } = useQuery({
    queryKey: ["colegas-clientes"],
    queryFn: () => colegasFn(),
    staleTime: 5 * 60_000,
  });

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Cliente excluído.");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-stats"] });
    } catch (err: any) {
      const msg = err?.message || err?.body?.message || String(err);
      toast.error(`Não foi possível excluir o cliente: ${msg}`);
      console.error("[excluirCliente]", err);
    }
  }

  function limpar() {
    setQ("");
    setBusca("");
    setEtapa("todas");
    setResponsavel("todos");
    setPortal("todos");
    setStatusF("todos");
    setPagina(1);
  }

  const navigateToFicha = (id: string) => navigate({ to: "/crm/clientes/$id", params: { id } });

  const total = data?.total ?? 0;
  const itens = data?.itens ?? [];

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              Clientes
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Gestão de clientes do seu ecossistema.
            </p>
          </div>
        </div>
        <Button
          asChild
          className="h-11 w-full shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/80 px-5 font-semibold text-primary-foreground shadow-md ring-1 ring-primary/20 transition-all hover:shadow-lg hover:brightness-105 sm:w-auto"
        >
          <Link to="/crm/clientes/novo">
            <Plus className="size-4" /> Novo cliente
          </Link>
        </Button>
      </div>

      <KpiCards
        kpis={kpis}
        statusF={statusF}
        portal={portal}
        etapa={etapa}
        setStatusF={setStatusF}
        setPortal={setPortal}
        setEtapa={setEtapa}
        setPagina={setPagina}
      />

      <FiltrosClientes
        q={q}
        setQ={setQ}
        onSubmit={() => {
          setPagina(1);
          setBusca(q);
        }}
        etapa={etapa}
        setEtapa={setEtapa}
        responsavel={responsavel}
        setResponsavel={setResponsavel}
        portal={portal}
        setPortal={setPortal}
        statusF={statusF}
        setStatusF={setStatusF}
        escopo={escopo}
        setEscopo={setEscopo}
        etapas={etapas}
        colegas={colegas}
        onLimpar={limpar}
        setPagina={setPagina}
      />

      <ListaMobile
        isLoading={isLoading}
        itens={itens}
        navigateToFicha={navigateToFicha}
        handleExcluir={handleExcluir}
      />

      <ListaDesktop
        isLoading={isLoading}
        isFetching={isFetching}
        itens={itens}
        total={total}
        pagina={pagina}
        setPagina={setPagina}
        navigateToFicha={navigateToFicha}
        handleExcluir={handleExcluir}
      />

      {total > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm md:hidden">
          <span>
            {itens.length} de {total} cliente{total === 1 ? "" : "s"}
          </span>
          {total > 20 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina === 1 || isFetching}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Button>
              <span>Página {pagina}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina * 20 >= total || isFetching}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

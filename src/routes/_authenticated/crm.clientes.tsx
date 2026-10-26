import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icone3D } from "@/components/ui/icone-3d";
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
import { ClientesDaContaNativos } from "@/components/plataforma/conta-nativa/clientes-da-conta";
import { ClientesDoGrupo } from "@/components/plataforma/conta-nativa/clientes-do-grupo";
import { FiltroBase } from "@/components/crm/filtro-base/filtro-base";
import { useFiltroBase } from "@/components/crm/filtro-base/use-filtro-base";
import { rotuloDoFiltro } from "@/lib/plataforma/filtro-base";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";

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

  // Base exibida (C07/C08): "Sua base" (Agilliza + contas vinculadas) ou "Assinantes" (todos ou um).
  const filtroBase = useFiltroBase();
  const { alvo } = filtroBase;
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

  // "Novo cliente" só para quem pode cadastrar (o servidor recusa os demais).
  const podeCriar = usePermissao("crm.clientes", "create");
  const filtrando =
    !!busca ||
    etapa !== "todas" ||
    responsavel !== "todos" ||
    portal !== "todos" ||
    statusF !== "todos";

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["clientes", filtros],
    queryFn: () => listar({ data: filtros }),
    enabled: alvo.agilliza,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // KPIs precisam refletir imediatamente inclusões/exclusões feitas em outras
  // telas (novo cliente, ficha, portal). Por isso não usam cache "morno".
  const { data: kpis } = useQuery({
    queryKey: ["clientes-stats", escopo],
    queryFn: () => stats({ data: { escopo } }),
    enabled: alvo.agilliza,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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
        {/* Mesmo padrão do `PageHeader` (título 24/500, peça 3D do Agilliza). */}
        <div className="flex min-w-0 items-start gap-3">
          <Icone3D icone={Users} tamanho="lg" className="mt-0.5" />
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-xl font-medium tracking-tight text-foreground sm:text-2xl">
              Clientes
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {filtroBase.pode
                ? `${rotuloDoFiltro(filtroBase.filtro, filtroBase.conta)} · clientes do seu ecossistema.`
                : "Gestão de clientes do seu ecossistema."}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {alvo.agilliza && podeCriar && (
            <Button
              asChild
              data-tour="clientes-novo"
              className="h-11 w-full shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/80 px-5 font-semibold text-primary-foreground shadow-md ring-1 ring-primary/20 transition-all hover:shadow-lg hover:brightness-105 sm:w-auto"
            >
              <Link to="/crm/clientes/novo">
                <Plus className="size-4" /> Novo cliente
              </Link>
            </Button>
          )}
        </div>
      </div>

      <FiltroBase uso={filtroBase} />

      {!alvo.agilliza && alvo.grupo === "assinantes" && alvo.licenca ? (
        // Um assinante: a mesma lista da base própria, com o documento completo para quem pode (auditado).
        <ClientesDaContaNativos
          conta={{
            id: alvo.licenca,
            nome: filtroBase.conta?.nome ?? "Assinante",
            tipo: filtroBase.conta?.tipo ?? "corretor",
          }}
        />
      ) : !alvo.agilliza && alvo.grupo ? (
        // Todos os assinantes, todos os vinculados ou uma vinculada: carteiras paginadas no servidor.
        <div className="space-y-3">
          <BuscaDoGrupo q={q} setQ={setQ} />
          <ClientesDoGrupo grupo={alvo.grupo} licenca={alvo.licenca} termo={busca} />
        </div>
      ) : (
        <>
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

          {isError && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {mensagemDeErro(error, "Não foi possível carregar os clientes.")}
            </p>
          )}

          <ListaMobile
            isLoading={isLoading}
            itens={itens}
            navigateToFicha={navigateToFicha}
            handleExcluir={handleExcluir}
            podeCadastrar={podeCriar}
            filtrando={filtrando}
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
            podeCadastrar={podeCriar}
            filtrando={filtrando}
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

          {/* "Sua base" inclui os corretores e parceiros vinculados ao Agilliza (C07). */}
          {alvo.grupo === "vinculados" &&
            filtroBase.totalVinculadas > 0 &&
            responsavel === "todos" &&
            etapa === "todas" &&
            portal === "todos" &&
            statusF === "todos" && <ClientesDoGrupo grupo="vinculados" termo={busca} secao />}
        </>
      )}
    </div>
  );
}

/** Busca da carteira de um grupo (mesmo campo da base própria). */
function BuscaDoGrupo({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  return (
    <div className="relative">
      <label htmlFor="busca-clientes-grupo" className="sr-only">
        Buscar cliente
      </label>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="busca-clientes-grupo"
        className="h-11 rounded-xl pl-9"
        placeholder="Buscar por nome, código, e-mail ou CPF completo"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </div>
  );
}

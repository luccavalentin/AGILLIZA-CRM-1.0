import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  ChevronRight,
  Smartphone,
  Loader2,
  FileCheck2,
  Filter,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToneBadge } from "@/components/crm/tone-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarClientes,
  excluirCliente,
  estatisticasClientes,
  listarEtapasPipeline,
} from "@/lib/crm/clientes.functions";
import { listarColegas } from "@/lib/operacional/shared.functions";
import { formatarDocumento, formatarCelular } from "@/lib/crm/documento";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";

export const Route = createFileRoute("/_authenticated/crm/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar clientes.</div>
  ),
});

type Portal = "todos" | "ativo" | "inativo";
type StatusF = "todos" | "ativo" | "inativo";

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

  // Busca ao vivo (debounced): reflete no filtro conforme o usuário digita.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusca(q.trim());
      setPagina(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const [pagina, setPagina] = useState(1);
  const [etapa, setEtapa] = useState<string>("todas");
  const [responsavel, setResponsavel] = useState<string>("todos");
  const [portal, setPortal] = useState<Portal>("todos");
  const [statusF, setStatusF] = useState<StatusF>("todos");
  const [escopo, setEscopo] = useState<"minhas" | "geral">(
    () =>
      (typeof window !== "undefined" &&
        (localStorage.getItem("clientes:escopo") as "minhas" | "geral")) ||
      "geral",
  );

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
  });

  const { data: kpis } = useQuery({
    queryKey: ["clientes-stats", escopo],
    queryFn: () => stats({ data: { escopo } }),
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
    } catch {
      toast.error("Não foi possível excluir o cliente.");
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

  const iniciais = (nome: string) => {
    const partes = nome.trim().split(/\s+/);
    const a = partes[0]?.[0] ?? "";
    const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
    return (a + b).toUpperCase() || "?";
  };

  const kpiCards: Array<{
    label: string;
    hint: string;
    valor: number | undefined;
    icon: React.ReactNode;
    onClick: () => void;
    active: boolean;
  }> = [
    {
      label: "Total de clientes",
      hint: "Ativos no sistema",
      valor: kpis?.total,
      icon: <Users className="size-5" />,
      onClick: () => {
        setPortal("todos");
        setStatusF("ativo");
        setEtapa("todas");
        setPagina(1);
      },
      active: statusF === "ativo" && portal === "todos" && etapa === "todas",
    },
    {
      label: "App ativo",
      hint: "Com acesso liberado",
      valor: kpis?.portal_ativo,
      icon: <Smartphone className="size-5" />,
      onClick: () => {
        setPortal("ativo");
        setPagina(1);
      },
      active: portal === "ativo",
    },
    {
      label: "Em andamento",
      hint: "Em etapas da esteira",
      valor: kpis?.em_andamento,
      icon: <Loader2 className="size-5" />,
      onClick: () => {
        // filtro visual: seleciona etapa "simulacao" como atalho comum
        setEtapa("simulacao");
        setPagina(1);
      },
      active: etapa !== "todas" && etapa !== "cadastro_basico" && etapa !== "contrato_emitido",
    },
    {
      label: "Cadastro completo",
      hint: "100% preenchido",
      valor: kpis?.cadastro_completo,
      icon: <FileCheck2 className="size-5" />,
      onClick: () => {
        setEtapa("cadastro_completo");
        setPagina(1);
      },
      active: etapa === "cadastro_completo",
    },
  ];

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                Clientes
              </h1>
              {(data?.total ?? 0) > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  {data?.total}
                </span>
              )}
            </div>
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

      {/* KPIs clicáveis */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={k.onClick}
            className={`group relative overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
              k.active
                ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20"
                : "border-border/60 bg-card"
            }`}
          >
            <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {k.valor ?? "—"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{k.hint}</p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                {k.icon}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Barra de busca + filtros */}
      <Card className="rounded-2xl border-border/60 p-3 shadow-sm sm:p-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPagina(1);
            setBusca(q);
          }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 rounded-xl bg-muted/40 pl-9"
              placeholder="Buscar por nome, documento ou e-mail..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto_auto_auto]">
            <FilterField label="Etapa">
              <Select value={etapa} onValueChange={(v) => { setEtapa(v); setPagina(1); }}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {(etapas ?? []).map((e) => (
                    <SelectItem key={e.codigo} value={e.codigo}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Responsável">
              <Select value={responsavel} onValueChange={(v) => { setResponsavel(v); setPagina(1); }}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(colegas ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome ?? c.email ?? "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Portal do cliente">
              <Select value={portal} onValueChange={(v) => { setPortal(v as Portal); setPagina(1); }}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">App ativo</SelectItem>
                  <SelectItem value="inativo">App inativo</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Status">
              <Select value={statusF} onValueChange={(v) => { setStatusF(v as StatusF); setPagina(1); }}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>

            <div className="flex items-end">
              <Tabs
                value={escopo}
                onValueChange={(v) => {
                  const val = v as "minhas" | "geral";
                  setEscopo(val);
                  setPagina(1);
                  if (typeof window !== "undefined") localStorage.setItem("clientes:escopo", val);
                }}
              >
                <TabsList className="h-10 rounded-xl">
                  <TabsTrigger value="minhas" className="rounded-lg">
                    <Filter className="mr-1 size-3.5" /> Minhas
                  </TabsTrigger>
                  <TabsTrigger value="geral" className="rounded-lg">Gerais</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={limpar} className="h-10 w-full rounded-xl gap-2">
                <RotateCcw className="size-4" /> Limpar
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="h-10 w-full rounded-xl gap-2">
                <Search className="size-4" /> Buscar
              </Button>
            </div>
          </div>
        </form>
      </Card>



      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-border/60 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Skeleton className="size-11 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Skeleton className="h-14 rounded-xl" />
                    <Skeleton className="h-14 rounded-xl" />
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (data?.itens.length ?? 0) === 0 ? (
          <Card className="rounded-2xl border-border/60 px-5 py-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Users className="size-7" />
            </div>
            <p className="text-sm font-semibold text-foreground">Nenhum cliente encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">Cadastre o primeiro cliente para começar.</p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/crm/clientes/novo">
                <Plus className="size-4" /> Novo cliente
              </Link>
            </Button>
          </Card>
        ) : (
          data!.itens.map((c, idx) => (
            <Card
              key={c.id}
              role="button"
              tabIndex={0}
              style={{ animationDelay: `${Math.min(idx, 8) * 55}ms` }}
              className="group relative animate-fade-in overflow-hidden rounded-2xl border-border/60 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_30px_-14px_hsl(var(--primary)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-0 active:shadow-sm"
              onClick={() => navigate({ to: "/crm/clientes/$id", params: { id: c.id } })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate({ to: "/crm/clientes/$id", params: { id: c.id } });
                }
              }}
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-primary/70 to-primary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="p-4">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-105 group-hover:ring-primary/40">
                    {iniciais(c.nome)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                      {c.nome}
                    </h2>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">{c.numero_cliente}</span>
                      <span className="max-w-full truncate font-mono tabular-nums">
                        {c.documento_masc ? c.documento : formatarDocumento(c.documento)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <ToneBadge tone={c.portal_acesso_ativo ? "success" : "muted"}>
                      {c.portal_acesso_ativo ? "App ativo" : "App inativo"}
                    </ToneBadge>
                    <ChevronRight className="size-4 text-primary/70 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  <div className="min-w-0 rounded-xl bg-muted/40 p-3 ring-1 ring-border/50 transition-colors duration-300 group-hover:bg-muted/60 group-hover:ring-border">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Etapa
                    </p>
                    {c.etapa_nome ? (
                      <ToneBadge tone="info" className="max-w-full gap-1.5">
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="truncate">{c.etapa_nome}</span>
                      </ToneBadge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="min-w-0 rounded-xl bg-muted/40 p-3 ring-1 ring-border/50 transition-colors duration-300 group-hover:bg-muted/60 group-hover:ring-border">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Responsável
                    </p>
                    {c.responsavel_nome ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-[9px] font-semibold text-muted-foreground ring-1 ring-border">
                          {iniciais(c.responsavel_nome)}
                        </span>
                        <span className="truncate text-sm text-foreground/80">{c.responsavel_nome}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                  {c.telefone_celular ? (
                    <a
                      href={`tel:${c.telefone_celular.replace(/\D/g, "")}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex min-w-0 items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-2 text-sm font-medium text-primary ring-1 ring-primary/10 transition-all duration-200 hover:bg-primary/15 hover:ring-primary/25 active:scale-[0.98]"
                    >
                      <Phone className="size-3.5 shrink-0" />
                      <span className="truncate tabular-nums">{formatarCelular(c.telefone_celular)}</span>
                    </a>
                  ) : null}
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex min-w-0 items-center gap-2 rounded-lg bg-muted px-2.5 py-2 text-xs text-muted-foreground ring-1 ring-border/50 transition-all duration-200 hover:bg-muted/80 hover:text-foreground hover:ring-border active:scale-[0.98]"
                    >
                      <Mail className="size-3.5 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </a>
                  ) : null}
                  {!c.telefone_celular && !c.email && (
                    <span className="text-sm text-muted-foreground">Sem contato cadastrado</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2.5 transition-colors duration-300 group-hover:bg-primary/[0.04]">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                  Abrir ficha do cliente
                  <ChevronRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
                <div onClick={(e) => e.stopPropagation()}>
                  <ConfirmDelete
                    titulo="Excluir cliente"
                    descricao={`O cliente "${c.nome}" e seus registros vinculados serão removidos permanentemente.`}
                    onConfirm={() => handleExcluir(c.id)}
                  />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="hidden overflow-hidden rounded-2xl border-border/60 shadow-sm md:block">
        <div className="w-full overflow-x-auto">
          <Table className="w-full min-w-[860px] table-fixed">
            <TableHeader>
              <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                {[
                  { h: "Cliente", w: "w-[24%]" },
                  { h: "Documento", w: "w-[13%]" },
                  { h: "Contato", w: "w-[21%]" },
                  { h: "Etapa", w: "w-[17%]" },
                  { h: "Responsável", w: "w-[16%]" },
                  { h: "Portal", w: "w-[9%]" },
                ].map(({ h, w }) => (
                  <TableHead
                    key={h}
                    className={`h-11 px-4 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/80 ${w}`}
                  >
                    {h}
                  </TableHead>
                ))}
                <TableHead className="h-11 w-14 px-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/80">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="border-border/40">
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 shrink-0 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-40" />
                          <Skeleton className="h-2.5 w-20" />
                        </div>
                      </div>
                    </TableCell>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j} className="px-4">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (data?.itens.length ?? 0) === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-20 text-center">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                      <Users className="size-7" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      Nenhum cliente encontrado
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cadastre o primeiro cliente para começar.
                    </p>
                    <Button asChild size="sm" className="mt-4">
                      <Link to="/crm/clientes/novo">
                        <Plus className="size-4" /> Novo cliente
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                data!.itens.map((c) => (
                  <TableRow
                    key={c.id}
                    className="group relative cursor-pointer border-border/40 transition-colors hover:bg-primary/[0.035]"
                    onClick={() => navigate({ to: "/crm/clientes/$id", params: { id: c.id } })}
                  >
                    {/* Cliente: avatar + nome + número */}
                    <TableCell className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 rounded-r-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-[11px] font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 transition-transform duration-200 group-hover:scale-105">
                          {iniciais(c.nome)}
                        </span>
                        <div className="min-w-0">
                          <span className="block truncate font-medium leading-tight text-foreground transition-colors group-hover:text-primary">
                            {c.nome}
                          </span>
                          <span className="mt-0.5 block font-mono text-[10.5px] leading-tight text-muted-foreground/70">
                            {c.numero_cliente}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Documento */}
                    <TableCell className="px-4">
                      <span className="block truncate font-mono text-[12px] tabular-nums text-foreground/80">
                        {c.documento_masc
                          ? c.documento
                          : formatarDocumento(c.documento)}
                      </span>
                    </TableCell>

                    {/* Contato: telefone + e-mail */}
                    <TableCell className="px-4">
                      <div className="flex flex-col gap-1.5 text-sm">
                        {c.telefone_celular ? (
                          <a
                            href={`tel:${c.telefone_celular.replace(/\D/g, "")}`}
                            onClick={(e) => e.stopPropagation()}
                            className="group/contato flex w-fit max-w-full items-center gap-2 rounded-md text-foreground transition-colors hover:text-primary"
                          >
                            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover/contato:bg-primary group-hover/contato:text-primary-foreground">
                              <Phone className="size-3" />
                            </span>
                            <span className="truncate font-medium tabular-nums">
                              {formatarCelular(c.telefone_celular)}
                            </span>
                          </a>
                        ) : null}
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="group/contato flex w-fit max-w-full items-center gap-2 rounded-md text-xs text-muted-foreground transition-colors hover:text-primary"
                          >
                            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground transition-colors group-hover/contato:bg-primary/10 group-hover/contato:text-primary">
                              <Mail className="size-3" />
                            </span>
                            <span className="truncate">{c.email}</span>
                          </a>
                        ) : null}
                        {!c.telefone_celular && !c.email && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>


                    {/* Etapa */}
                    <TableCell className="px-4">
                      {c.etapa_nome ? (
                        <ToneBadge tone="info" className="max-w-full gap-1.5">
                          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                          <span className="truncate">{c.etapa_nome}</span>
                        </ToneBadge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Responsável */}
                    <TableCell className="px-4">
                      {c.responsavel_nome ? (
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-1 ring-border">
                            {iniciais(c.responsavel_nome)}
                          </span>
                          <span className="truncate text-[13px] text-foreground/80">
                            {c.responsavel_nome}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Portal */}
                    <TableCell className="px-4">
                      <ToneBadge tone={c.portal_acesso_ativo ? "success" : "muted"}>
                        {c.portal_acesso_ativo ? "App ativo" : "App inativo"}
                      </ToneBadge>
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <ConfirmDelete
                          titulo="Excluir cliente"
                          descricao={`O cliente "${c.nome}" e seus registros vinculados serão removidos permanentemente.`}
                          onConfirm={() => handleExcluir(c.id)}
                        />
                        <ChevronRight className="size-4 -translate-x-1 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {(data?.total ?? 0) > 0 && (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <span>
              {data?.itens.length ?? 0} de {data?.total ?? 0} cliente
              {(data?.total ?? 0) === 1 ? "" : "s"}
            </span>
            {(data?.total ?? 0) > 20 && (
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
                  disabled={pagina * 20 >= (data?.total ?? 0) || isFetching}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {(data?.total ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm md:hidden">
          <span>
            {data?.itens.length ?? 0} de {data?.total ?? 0} cliente
            {(data?.total ?? 0) === 1 ? "" : "s"}
          </span>
          {(data?.total ?? 0) > 20 && (
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
                disabled={pagina * 20 >= (data?.total ?? 0) || isFetching}
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

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}


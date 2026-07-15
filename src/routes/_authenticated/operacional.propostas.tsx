import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Search,
  FileText,
  KanbanSquare,
  RotateCcw,
  Wallet,
  ChevronRight,
  User,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPropostas, excluirProposta, restaurarProposta } from "@/lib/propostas/propostas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { listarColegas } from "@/lib/operacional/shared.functions";
import { UsuarioCombobox } from "@/components/operacional/usuario-combobox";


import { BancosProposta } from "@/components/proposta/bancos-proposta";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { StatusBancosProposta } from "@/components/proposta/status-bancos-proposta";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { formatBRL } from "@/lib/simulacao/format";
import { corDoBanco } from "@/lib/bancos/cores";
import { numeroBancoParaExibir } from "@/lib/propostas/numero-banco-display";
import {
  GRUPOS_PROPOSTA,
  grupoDoStatus,
  type GrupoProposta,
} from "@/lib/propostas/status-grupos";

/** Primeiro e último dia do mês atual como intervalo ISO (para o filtro padrão). */
function intervaloMesAtual(): { inicio: string; fim: string } {
  const agora = new Date();
  const primeiro = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: iso(primeiro), fim: iso(ultimo) };
}

export const Route = createFileRoute("/_authenticated/operacional/propostas")({
  head: () => ({ meta: [{ title: "Propostas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar as propostas.</div>
  ),
});

function Pagina() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const excluir = useServerFn(excluirProposta);
  const restaurar = useServerFn(restaurarProposta);
  const padrao = useMemo(() => intervaloMesAtual(), []);
  const [escopo, setEscopo] = useState<"todas" | "minhas">("minhas");
  const [grupo, setGrupo] = useState<GrupoProposta | null>(null);
  const [verExcluidas, setVerExcluidas] = useState(false);
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [responsavel, setResponsavel] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState(padrao.inicio);
  const [dataFim, setDataFim] = useState(padrao.fim);

  const listarColegasFn = useServerFn(listarColegas);
  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegasFn(),
    staleTime: 5 * 60_000,
  });

  // Busca ao vivo: filtra conforme o usuário digita (com debounce).
  useEffect(() => {
    const t = setTimeout(() => setBusca(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Realtime: atualiza a lista quando o status/banco de qualquer proposta mudar
  // (ex.: após enviar ao banco, o status_banco passa de "aguardando" a "enviada"/"recusada").
  useEffect(() => {
    let raf: number | null = null;
    const invalidar = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        queryClient.invalidateQueries({ queryKey: ["propostas"] });
      });
    };
    let canalRef: any = null;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      canalRef = supabase
        .channel("propostas-lista")
        .on("postgres_changes", { event: "*", schema: "public", table: "propostas" }, invalidar)
        .on("postgres_changes", { event: "*", schema: "public", table: "proposta_bancos" }, invalidar)
        .subscribe();
    });
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      if (canalRef) {
        import("@/integrations/supabase/client").then(({ supabase }) => supabase.removeChannel(canalRef));
      }
    };
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ["propostas", escopo, busca, dataInicio, dataFim, responsavel, verExcluidas],
    queryFn: () =>
      listarPropostas({
        data: {
          escopo,
          q: busca || undefined,
          responsavel:
            escopo === "todas" && responsavel !== "todos" ? responsavel : undefined,
          data_inicio: dataInicio ? `${dataInicio}T00:00:00` : undefined,
          data_fim: dataFim ? `${dataFim}T23:59:59` : undefined,
          pagina: 1,
          porPagina: 100,
          apenas_excluidas: verExcluidas,
        },
      }),
  });

  const todosItens = data?.itens ?? [];

  // Contagem e volume por grupo de status (sobre todo o conjunto carregado).
  const estatisticasGrupo = useMemo(() => {
    const base: Record<GrupoProposta, { count: number; volume: number }> = {
      enviadas: { count: 0, volume: 0 },
      aprovadas: { count: 0, volume: 0 },
      recusadas: { count: 0, volume: 0 },
      canceladas: { count: 0, volume: 0 },
    };
    for (const p of todosItens) {
      const g = grupoDoStatus(p.status);
      if (!g) continue;
      base[g].count += 1;
      base[g].volume += p.valor_financiamento ?? 0;
    }
    return base;
  }, [todosItens]);

  const itens = useMemo(
    () => (grupo ? todosItens.filter((p) => grupoDoStatus(p.status) === grupo) : todosItens),
    [todosItens, grupo],
  );
  const totalItens = itens.length;
  const volumeTotal = useMemo(
    () => itens.reduce((acc, p) => acc + (p.valor_financiamento ?? 0), 0),
    [itens],
  );

  function limparFiltros() {
    setQ("");
    setBusca("");
    setResponsavel("todos");
    setDataInicio(padrao.inicio);
    setDataFim(padrao.fim);
    setEscopo("minhas");
    setGrupo(null);
  }

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Proposta excluída.");
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-painel"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch {
      toast.error("Não foi possível excluir a proposta.");
    }
  }

  async function handleRestaurar(id: string) {
    try {
      await restaurar({ data: { id } });
      toast.success("Proposta restaurada.");
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    } catch {
      toast.error("Não foi possível restaurar a proposta.");
    }
  }

  function formatDataHora(v?: string | null) {
    if (!v) return "—";
    try {
      return new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",   dateStyle: "short", timeStyle: "short" });
    } catch {
      return "—";
    }
  }


  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:space-y-6 sm:p-6">
      {/* Cabeçalho */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary ring-1 ring-inset ring-primary/12">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Propostas
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Oportunidades enviadas ao banco.
            </p>
          </div>
        </div>
        <div className="col-span-2 flex gap-2 sm:col-auto">
          <Button
            asChild
            variant="outline"
            className="group h-10 flex-1 rounded-lg border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 active:translate-y-0 sm:flex-none"
          >
            <Link to="/operacional/propostas/kanban" search={{ q: undefined }}>
              <KanbanSquare className="mr-1.5 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />{" "}
              Kanban
            </Link>
          </Button>
          <Button
            asChild
            className="group h-10 flex-1 rounded-lg font-medium shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 active:translate-y-0 sm:flex-none"
          >
            <Link to="/operacional/propostas/enviar">
              <Plus className="mr-1.5 h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />{" "}
              Nova proposta
            </Link>
          </Button>
        </div>

      </div>

      {/* Cards por status (clicáveis para filtrar) + volume financiado */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatusCard
          ativo={grupo === null}
          label="Todas"
          count={todosItens.length}
          volume={todosItens.reduce((a, p) => a + (p.valor_financiamento ?? 0), 0)}
          tone="info"
          loading={isLoading}
          onClick={() => setGrupo(null)}
        />
        {GRUPOS_PROPOSTA.map((g) => (
          <StatusCard
            key={g.id}
            ativo={grupo === g.id}
            label={g.label}
            count={estatisticasGrupo[g.id].count}
            volume={estatisticasGrupo[g.id].volume}
            tone={g.tone}
            loading={isLoading}
            onClick={() => setGrupo((cur) => (cur === g.id ? null : g.id))}
          />
        ))}
        <VolumeCard volume={volumeTotal} loading={isLoading} />
      </div>







      {/* Filtros */}
      <Card className="rounded-xl border-border/60 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
            <TabsList className="h-11 rounded-xl">
              <TabsTrigger value="todas" className="rounded-lg">
                Gerais
              </TabsTrigger>
              <TabsTrigger value="minhas" className="rounded-lg">
                Minhas
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 rounded-xl pl-9 shadow-sm"
              placeholder="Número, cliente ou documento"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {escopo === "todas" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Usuário</Label>
              <UsuarioCombobox
                value={responsavel}
                onValueChange={setResponsavel}
                usuarios={colegas ?? []}
                className="h-11 w-56 rounded-xl"
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-11 w-[9.5rem] rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-11 w-[9.5rem] rounded-xl"
            />
          </div>
          <Button
            variant="ghost"
            className="group h-11 rounded-xl transition-colors hover:bg-primary/5 hover:text-primary"
            onClick={limparFiltros}
          >
            <RotateCcw className="mr-1 h-4 w-4 transition-transform duration-300 group-hover:-rotate-180" />{" "}
            Limpar
          </Button>
          <Button
            variant={verExcluidas ? "default" : "outline"}
            className="h-11 rounded-xl"
            onClick={() => setVerExcluidas((v) => !v)}
            title="Ver propostas excluídas"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {verExcluidas ? "Ver ativas" : "Excluídas"}
          </Button>
        </div>
      </Card>


      {/* Lista mobile (cards) */}
      <div className="space-y-3 md:hidden">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-border/60 p-4 shadow-sm">
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-full rounded-xl" />
              </div>
            </Card>
          ))}
        {!isLoading && totalItens === 0 && (
          <Card className="rounded-2xl border-border/60 px-5 py-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <FileText className="h-6 w-6" />
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
            <Button asChild size="sm" className="rounded-xl">
              <Link to="/operacional/propostas/enviar">Nova proposta</Link>
            </Button>
          </Card>
        )}
        {!isLoading &&
          itens.map((p) => {
            const bancoPrincipal = p.bancos?.[0]?.nome_banco ?? null;
            const corBanco = corDoBanco(bancoPrincipal);
            return (
            <Card
              key={p.id}
              style={
                {
                  "--banco": corBanco,
                  "--banco-tint": `${corBanco}0f`,
                  "--banco-ring": `${corBanco}26`,
                } as React.CSSProperties
              }
              className="group relative cursor-pointer overflow-hidden rounded-2xl border-border/60 bg-card p-0 shadow-sm ring-1 ring-inset ring-[var(--banco-ring)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.99] active:shadow-md"
              onClick={() =>
                router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })
              }
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-[var(--banco)]" />

              {/* Faixa de identidade do banco */}
              <div className="flex items-center justify-between gap-2 bg-[var(--banco-tint)] px-4 py-2.5 pl-5">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <BancoLogo nome={bancoPrincipal} size="sm" />
                  <span
                    className="truncate text-xs font-semibold tracking-tight"
                    style={{ color: corBanco }}
                  >
                    {bancoPrincipal ?? "Sem banco"}
                  </span>
                </span>
                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                  {verExcluidas ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg"
                      onClick={() => handleRestaurar(p.id)}
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" /> Restaurar
                    </Button>
                  ) : (
                    <ConfirmDelete
                      titulo="Excluir proposta"
                      descricao={`A proposta ${p.numero_proposta} será movida para a aba "Excluídas". Você poderá restaurá-la a qualquer momento.`}
                      onConfirm={() => handleExcluir(p.id)}
                    />
                  )}
                </div>
              </div>

              <div className="px-4 py-3 pl-5">
                {(() => {
                  const nb = numeroBancoParaExibir(p.numero_proposta_banco);
                  return nb ? (
                    <>
                      <div className="text-lg font-bold tabular-nums leading-tight tracking-tight" style={{ color: corBanco }}>
                        Nº banco {nb}
                      </div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Interno <span className="tabular-nums">{p.numero_proposta}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-base font-semibold tabular-nums tracking-tight text-foreground">
                      {p.numero_proposta}
                    </div>
                  );
                })()}

                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {p.nome_cliente ?? "—"}
                </p>
                {escopo === "todas" && p.nome_responsavel && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{p.nome_responsavel}</span>
                  </p>
                )}
                {verExcluidas && (
                  <div className="mt-2 rounded-md border border-destructive/25 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
                    <div className="font-medium">Excluída por {p.nome_excluidor ?? "—"}</div>
                    <div className="text-destructive/80">em {formatDataHora(p.deleted_at)}</div>
                    {p.deleted_motivo && (
                      <div className="mt-0.5 truncate text-destructive/70">Motivo: {p.deleted_motivo}</div>
                    )}
                  </div>
                )}


                <div className="mt-3 flex items-end justify-between gap-3 border-t border-border/50 pt-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Financiamento
                    </p>
                    <p className="truncate text-lg font-semibold tabular-nums text-foreground">
                      {formatBRL(p.valor_financiamento)}
                    </p>
                  </div>
                  <ChevronRight className="mb-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>

                <div className="mt-3">
                  <StatusBancosProposta bancos={p.bancos} fallbackStatus={p.status} />
                </div>
              </div>
            </Card>
            );
          })}
      </div>


      {/* Tabela desktop */}
      <Card className="hidden overflow-x-auto rounded-xl border-border/60 shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Número
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Cliente
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bancos
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                R$ Financiamento
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="w-12 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && totalItens === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                      <FileText className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
                    <Button asChild size="sm" className="rounded-xl">
                      <Link to="/operacional/propostas/enviar">Nova proposta</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              itens.map((p) => {
                const corBanco = corDoBanco(p.bancos?.[0]?.nome_banco);
                return (
                <TableRow
                  key={p.id}
                  style={
                    {
                      "--banco": corBanco,
                      "--banco-tint": `${corBanco}12`,
                      "--banco-ring": `${corBanco}59`,
                    } as React.CSSProperties
                  }
                  className="group relative cursor-pointer transition-colors hover:bg-[var(--banco-tint)] hover:shadow-[inset_3px_0_0_0_var(--banco)]"
                  onClick={() =>
                    router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })
                  }
                >
                  <TableCell className="relative">
                    <span className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 rounded-r-full bg-[var(--banco)] transition-transform duration-200 group-hover:scale-y-100" />
                    {(() => {
                      const nb = numeroBancoParaExibir(p.numero_proposta_banco);
                      return nb ? (
                        <>
                          <div className="text-base font-bold tabular-nums leading-tight text-[var(--banco)]">
                            Nº banco {nb}
                          </div>
                          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Interno <span className="tabular-nums">{p.numero_proposta}</span>
                          </div>
                        </>
                      ) : (
                        <div className="font-medium tabular-nums text-foreground transition-colors group-hover:text-[var(--banco)]">
                          {p.numero_proposta}
                        </div>
                      );
                    })()}
                  </TableCell>

                  <TableCell className="font-medium text-foreground">
                    {p.nome_cliente ?? "—"}
                    {escopo === "todas" && p.nome_responsavel && (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.nome_responsavel}</span>
                      </span>
                    )}
                    {verExcluidas && (
                      <span className="mt-1 block text-[11px] font-normal text-destructive">
                        Excluída por {p.nome_excluidor ?? "—"} · {formatDataHora(p.deleted_at)}
                        {p.deleted_motivo ? ` · ${p.deleted_motivo}` : ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <BancosProposta bancos={p.bancos} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    {formatBRL(p.valor_financiamento)}
                  </TableCell>
                  <TableCell>
                    <StatusBancosProposta bancos={p.bancos} fallbackStatus={p.status} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {verExcluidas ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg"
                        onClick={() => handleRestaurar(p.id)}
                      >
                        <Undo2 className="mr-1 h-3.5 w-3.5" /> Restaurar
                      </Button>
                    ) : (
                      <ConfirmDelete
                        titulo="Excluir proposta"
                        descricao={`A proposta ${p.numero_proposta} será movida para a aba "Excluídas". Você poderá restaurá-la a qualquer momento.`}
                        onConfirm={() => handleExcluir(p.id)}
                      />
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

const CARD_TONE: Record<
  "muted" | "info" | "warning" | "success" | "danger",
  { dot: string; value: string }
> = {
  info: { dot: "bg-primary", value: "text-foreground" },
  muted: { dot: "bg-muted-foreground/50", value: "text-foreground" },
  warning: { dot: "bg-amber-500/80", value: "text-foreground" },
  success: { dot: "bg-emerald-600/80", value: "text-foreground" },
  danger: { dot: "bg-rose-600/70", value: "text-foreground" },
};

function StatusCard({
  ativo,
  label,
  count,
  volume,
  tone,
  loading,
  onClick,
}: {
  ativo: boolean;
  label: string;
  count: number;
  volume: number;
  tone: "muted" | "info" | "warning" | "success" | "danger";
  loading: boolean;
  onClick: () => void;
}) {
  const t = CARD_TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
        ativo
          ? "border-primary/40 bg-primary/[0.03] ring-1 ring-primary/20 shadow-sm"
          : "border-border/60 hover:border-primary/25 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`inline-block size-1.5 shrink-0 rounded-full ${t.dot}`} />
        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-10" />
      ) : (
        <p className={`mt-2 text-2xl font-semibold tabular-nums leading-none ${t.value}`}>
          {count}
        </p>
      )}
      {loading ? (
        <Skeleton className="mt-2.5 h-3 w-16" />
      ) : (
        <p className="mt-2 truncate text-[11px] tabular-nums text-muted-foreground" title={formatBRL(volume)}>
          {formatBRL(volume)}
        </p>

      )}
    </button>
  );
}

function VolumeCard({ volume, loading }: { volume: number; loading: boolean }) {
  return (
    <div className="group relative col-span-2 overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary to-primary/85 p-4 text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 sm:col-span-1 lg:col-span-1 xl:col-span-2">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary-foreground/10 blur-2xl transition-opacity duration-300 group-hover:opacity-80" />
      <div className="flex items-center gap-2">
        <Wallet className="h-3.5 w-3.5 shrink-0 text-primary-foreground/80" />
        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-primary-foreground/80">
          Volume financiado
        </p>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-6 w-24 bg-primary-foreground/20" />
      ) : (
        <p className="mt-2 text-lg font-semibold tabular-nums leading-tight break-words sm:text-xl">
          {formatBRL(volume)}
        </p>
      )}
    </div>
  );
}


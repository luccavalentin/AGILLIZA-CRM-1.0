import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Users, Phone, Mail, ChevronRight } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToneBadge } from "@/components/crm/tone-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarClientes, excluirCliente } from "@/lib/crm/clientes.functions";
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

function Pagina() {
  usePipelineRealtime();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listar = useServerFn(listarClientes);
  const excluir = useServerFn(excluirCliente);
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["clientes", busca, pagina],
    queryFn: () => listar({ data: { q: busca, pagina, porPagina: 20 } }),
    placeholderData: keepPreviousData,
  });

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Cliente excluído.");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch {
      toast.error("Não foi possível excluir o cliente.");
    }
  }

  const iniciais = (nome: string) => {
    const partes = nome.trim().split(/\s+/);
    const a = partes[0]?.[0] ?? "";
    const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
    return (a + b).toUpperCase() || "?";
  };

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/20">
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

      <form
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPagina(1);
          setBusca(q);
        }}
      >
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-xl pl-9 shadow-sm"
            placeholder="Nome, documento ou e-mail"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 shrink-0 rounded-xl px-4">
          Buscar
        </Button>
      </form>

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

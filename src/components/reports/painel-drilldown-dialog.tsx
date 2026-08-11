import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Loader2,
  ExternalLink,
  ChevronRight,
  Pencil,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { getPanelDrilldown, type PanelDrilldown } from "@/lib/relatorios/paineis.functions";
import { excluirDemanda } from "@/lib/operacional/demandas.functions";
import { excluirTarefa } from "@/lib/operacional/tarefas.functions";
import { excluirSimulacao } from "@/lib/simulacao/simulacoes.functions";
import { EditarDemandaDialog } from "@/components/operacional/editar-demanda-dialog";
// Nota: Se houver um EditarTarefaDialog, ele deve ser importado aqui.
// Por enquanto, usaremos a navegação para edição se for complexo.
import type { ReportFiltros } from "@/lib/relatorios/shared";
import agillizaSymbol from "@/assets/brand/agilliza-symbol-oficial.png";

export interface DrilldownContext {
  metrica: string;
  valorAtual?: string;
  filtros: ReportFiltros & { modulo: "visao-geral" | "operacional" };
}

export function PainelDrilldownDialog({
  open,
  onOpenChange,
  contexto,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contexto: DrilldownContext | null;
}) {
  const queryClient = useQueryClient();
  const drillFn = useServerFn(getPanelDrilldown);
  const deleteDemandaFn = useServerFn(excluirDemanda);
  const deleteTarefaFn = useServerFn(excluirTarefa);
  const deleteSimulacaoFn = useServerFn(excluirSimulacao);

  const [itemParaExcluir, setItemParaExcluir] = React.useState<{
    id: string;
    tipo: "demanda" | "tarefa" | "simulacao";
  } | null>(null);
  const [demandaParaEditar, setDemandaParaEditar] = React.useState<any | null>(null);

  const { data, isLoading, error } = useQuery<PanelDrilldown>({
    queryKey: ["panel-drilldown", contexto?.metrica, contexto?.filtros],
    queryFn: () =>
      drillFn({
        data: { ...(contexto!.filtros as any), metrica: contexto!.metrica },
      }),
    enabled: open && !!contexto,
    staleTime: 30_000,
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 border-border/60 p-0 shadow-2xl sm:max-h-[80vh] overflow-hidden">
          <img
            src={agillizaSymbol}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-auto -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.035] dark:opacity-[0.06]"
          />
          <DialogHeader className="relative shrink-0 space-y-1 border-b border-border/60 bg-gradient-to-br from-primary/[0.06] via-background to-background px-4 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <DialogTitle className="pr-8 text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
              {data?.titulo ?? contexto?.metrica ?? "Detalhamento"}
            </DialogTitle>
            {(() => {
              const ehCalculo = (t?: string) =>
                !!t &&
                /[÷×]|\bdividid|\bmultiplic|\bfórmula|\bformula|\bsobre o total de\b/i.test(t);
              const subtitulo = ehCalculo(data?.subtitulo) ? undefined : data?.subtitulo;
              const descricao = ehCalculo(data?.descricao) ? undefined : data?.descricao;
              if (!subtitulo && !descricao) return null;
              return (
                <DialogDescription className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                  {subtitulo}
                  {subtitulo && descricao ? " · " : ""}
                  {descricao}
                </DialogDescription>
              );
            })()}
            {data?.formula && data.formula.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-stretch gap-2">
                {data.formula.map((f, i) => {
                  const tone =
                    f.tone === "success"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : f.tone === "warning"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : f.tone === "danger"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : f.tone === "brand"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border/60 bg-muted/50 text-foreground";
                  return (
                    <div
                      key={`${f.label}-${i}`}
                      className={`min-w-0 flex-1 basis-[130px] rounded-xl border px-3 py-2 ${tone}`}
                    >
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        {f.label}
                      </p>
                      <p className="font-mono text-xl font-semibold leading-tight tabular-nums sm:text-2xl">
                        {f.valor}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              (data?.valor || contexto?.valorAtual) && (
                <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
                  <span className="font-mono text-[26px] font-semibold leading-none tabular-nums text-foreground sm:text-[34px]">
                    {data?.valor ?? contexto?.valorAtual}
                  </span>
                  {data?.total && data.total !== data.valor && (
                    <span className="text-xs text-muted-foreground">
                      Volume total{" "}
                      <span className="font-mono font-medium text-foreground/80">{data.total}</span>
                    </span>
                  )}
                </div>
              )
            )}
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-3 py-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando detalhamento…
                </div>
              ) : error ? (
                <p className="py-10 text-center text-sm text-destructive">
                  Não foi possível carregar o detalhamento.
                </p>
              ) : !data || data.itens.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {data?.descricao ??
                    "Não há registros específicos para exibir neste indicador dentro do filtro selecionado."}
                </p>
              ) : (
                <ul className="space-y-1 py-1">
                  {data.itens.map((it, idx) => {
                    const conteudo = (
                      <div className="group relative isolate overflow-hidden rounded-xl border border-transparent px-3 py-3 transition-all duration-300 hover:border-border/60 hover:bg-gradient-to-r hover:from-muted/50 hover:to-transparent hover:shadow-sm sm:px-4">
                        {it.banco && (
                          <div
                            aria-hidden
                            className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 opacity-[0.06] transition-opacity duration-300 group-hover:opacity-[0.11] sm:block"
                          >
                            <BancoLogo nome={it.banco} size="xl" className="scale-[2.2] ring-0" />
                          </div>
                        )}
                        <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-3.5">
                          <BancoLogo nome={it.banco ?? null} size="lg" className="shrink-0" />

                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-semibold leading-tight tracking-tight text-foreground">
                              {it.label}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground/90">
                              {it.sub && <span className="truncate font-medium">{it.sub}</span>}
                              {it.sub && it.banco && <span className="opacity-30">•</span>}
                              {it.banco && (
                                <span className="font-semibold text-foreground/75">{it.banco}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            {it.valor && (
                              <span className="font-mono text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                                {it.valor}
                              </span>
                            )}
                            {it.data && (
                              <span className="text-[10px] font-medium uppercase tracking-wider tabular-nums text-muted-foreground/80 sm:text-[10.5px]">
                                {it.data}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {(it as any).id && (it as any).tipo && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground/40 hover:text-foreground"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if ((it as any).tipo === "demanda") {
                                        setDemandaParaEditar((it as any).raw);
                                      } else if (it.to) {
                                        window.location.href = it.to;
                                      }
                                    }}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setItemParaExcluir({
                                        id: (it as any).id,
                                        tipo: (it as any).tipo,
                                      });
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}

                            {it.to ? (
                              <ChevronRight className="hidden h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary sm:block" />
                            ) : (
                              <span className="hidden w-4 sm:block" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                    return (
                      <li key={idx}>
                        {it.to ? (
                          <Link
                            to={it.to}
                            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                            onClick={() => onOpenChange(false)}
                          >
                            {conteudo}
                          </Link>
                        ) : (
                          <div>{conteudo}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </ScrollArea>

          {data?.linkAbrir && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-6 py-3">
              <Button asChild size="sm" variant="outline" className="h-8 rounded-lg">
                <Link to={data.linkAbrir} onClick={() => onOpenChange(false)}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {data.linkAbrirLabel ?? "Abrir lista completa"}
                  <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Edição de Demanda */}
      {demandaParaEditar && (
        <EditarDemandaDialog
          demanda={demandaParaEditar}
          onSalva={() => {
            setDemandaParaEditar(null);
            queryClient.invalidateQueries({ queryKey: ["panel-drilldown"] });
            queryClient.invalidateQueries({ queryKey: ["panel"] });
            queryClient.invalidateQueries({ queryKey: ["demandas"] });
            queryClient.invalidateQueries({ queryKey: ["tarefas"] });
          }}
          abertoOverride={!!demandaParaEditar}
          onOpenChangeOverride={(o: boolean) => {
            if (!o) setDemandaParaEditar(null);
          }}
        />
      )}

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={!!itemParaExcluir} onOpenChange={(o) => !o && setItemParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro? Os alertas vinculados também serão
              removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!itemParaExcluir) return;
                try {
                  if (itemParaExcluir.tipo === "demanda") {
                    await deleteDemandaFn({ data: { id: itemParaExcluir.id } });
                  } else if (itemParaExcluir.tipo === "tarefa") {
                    await deleteTarefaFn({ data: { id: itemParaExcluir.id } });
                  } else {
                    await deleteSimulacaoFn({ data: { id: itemParaExcluir.id } });
                  }
                  toast.success("Registro e alertas vinculados excluídos com sucesso!");
                  queryClient.invalidateQueries({ queryKey: ["panel-drilldown"] });
                  queryClient.invalidateQueries({ queryKey: ["panel"] });
                  queryClient.invalidateQueries({ queryKey: ["demandas"] });
                  queryClient.invalidateQueries({ queryKey: ["tarefas"] });
                  queryClient.invalidateQueries({ queryKey: ["simulacoes"] });
                } catch (err) {
                  toast.error("Erro ao excluir registro.");
                } finally {
                  setItemParaExcluir(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

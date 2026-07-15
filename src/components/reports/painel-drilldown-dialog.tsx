import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Loader2, ExternalLink, ChevronRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { cn } from "@/lib/utils";
import { getPanelDrilldown } from "@/lib/relatorios/paineis.functions";
import type { ReportFiltros } from "@/lib/relatorios/shared";
import agillizaSymbol from "@/assets/brand/agilliza-symbol-oficial.png";

const toneClasses: Record<string, string> = {
  brand: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

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
  const drillFn = useServerFn(getPanelDrilldown);
  const { data, isLoading, error } = useQuery({
    queryKey: ["panel-drilldown", contexto?.metrica, contexto?.filtros],
    queryFn: () =>
      drillFn({
        data: { ...(contexto!.filtros as any), metrica: contexto!.metrica },
      }),
    enabled: open && !!contexto,
    staleTime: 30_000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden border-border/60 p-0 shadow-2xl">
        <img
          src={agillizaSymbol}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-auto -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.035] dark:opacity-[0.06]"
        />
        <DialogHeader className="relative space-y-1 border-b border-border/60 bg-gradient-to-br from-primary/[0.06] via-background to-background px-7 pt-6 pb-5">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <DialogTitle className="text-[15px] font-semibold tracking-tight text-foreground">
            {data?.titulo ?? contexto?.metrica ?? "Detalhamento"}
          </DialogTitle>
          {(data?.subtitulo || data?.descricao) && (
            <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
              {data?.subtitulo}
              {data?.subtitulo && data?.descricao ? " · " : ""}
              {data?.descricao}
            </DialogDescription>
          )}
          {(data?.valor || contexto?.valorAtual) && (
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="font-mono text-[34px] font-semibold leading-none tabular-nums text-foreground">
                {data?.valor ?? contexto?.valorAtual}
              </span>
              {data?.total && data.total !== data.valor && (
                <span className="text-xs text-muted-foreground">
                  Volume total <span className="font-mono font-medium text-foreground/80">{data.total}</span>
                </span>
              )}
            </div>
          )}
          {data?.formula && data.formula.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {data.formula.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  {i > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {i === data.formula!.length - 1 ? "=" : "÷"}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1.5 rounded-md border-transparent px-2 py-1 font-mono text-xs tabular-nums",
                      toneClasses[f.tone ?? "neutral"],
                    )}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                      {f.label}
                    </span>
                    <span className="font-semibold">{f.valor}</span>
                  </Badge>
                </span>
              ))}
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[62vh]">
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
                    <div className="group relative isolate overflow-hidden rounded-xl border border-transparent px-4 py-3 transition-all duration-300 hover:border-border/60 hover:bg-gradient-to-r hover:from-muted/50 hover:to-transparent hover:shadow-sm">
                      {it.banco && (
                        <div
                          aria-hidden
                          className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 opacity-[0.06] transition-opacity duration-300 group-hover:opacity-[0.11]"
                        >
                          <BancoLogo nome={it.banco} size="xl" className="scale-[2.2] ring-0" />
                        </div>
                      )}
                      <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3.5">
                        <BancoLogo nome={it.banco ?? null} size="lg" />
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
                            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                              {it.valor}
                            </span>
                          )}
                          {it.data && (
                            <span className="text-[10.5px] font-medium uppercase tracking-wider tabular-nums text-muted-foreground/80">
                              {it.data}
                            </span>
                          )}
                        </div>
                        {it.to ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                        ) : (
                          <span className="w-4" />
                        )}
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
          <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-6 py-3">
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
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Loader2, ExternalLink, ChevronRight, type LucideIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import agillizaSymbol from "@/assets/brand/agilliza-symbol-oficial.png";

export interface KpiDrillItem {
  label: string;
  sub?: string;
  valor?: string;
  data?: string;
  to?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
}

const toneRing: Record<NonNullable<KpiDrillItem["tone"]>, string> = {
  brand: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

/**
 * Diálogo genérico de detalhamento de KPI para painéis (Financeiro, RH etc).
 * Segue o mesmo padrão visual do PainelDrilldownDialog.
 */
export function KpiDrilldownDialog({
  open,
  onOpenChange,
  titulo,
  subtitulo,
  valor,
  descricao,
  icon: Icon,
  tone = "brand",
  itens,
  isLoading,
  linkAbrir,
  linkAbrirLabel = "Abrir lista completa",
  empty = "Nenhum registro encontrado para este indicador.",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titulo: string;
  subtitulo?: string;
  valor?: string;
  descricao?: string;
  icon?: LucideIcon;
  tone?: NonNullable<KpiDrillItem["tone"]>;
  itens: KpiDrillItem[];
  isLoading?: boolean;
  linkAbrir?: string;
  linkAbrirLabel?: string;
  empty?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 border-border/60 p-0 shadow-2xl sm:max-h-[85vh] overflow-hidden">
        <img
          src={agillizaSymbol}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-auto -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.035] dark:opacity-[0.06]"
        />
        <DialogHeader className="relative shrink-0 space-y-1 border-b border-border/60 bg-gradient-to-br from-primary/[0.06] via-background to-background px-4 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="flex items-center gap-3 pr-8">
            {Icon && (
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset ring-border/50",
                  toneRing[tone],
                )}
              >
                <Icon className="size-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
                {titulo}
              </DialogTitle>
              {(subtitulo || descricao) && (
                <DialogDescription className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                  {subtitulo}
                  {subtitulo && descricao ? " · " : ""}
                  {descricao}
                </DialogDescription>
              )}
            </div>
          </div>
          {valor && (
            <div className="mt-3">
              <span className="font-mono text-[26px] font-semibold leading-none tabular-nums text-foreground sm:text-[34px]">
                {valor}
              </span>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-3 py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando detalhamento…
              </div>
            ) : itens.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
            ) : (
              <ul className="space-y-1 py-1">
                {itens.map((it, idx) => {
                  const conteudo = (
                    <div className="group relative overflow-hidden rounded-xl border border-transparent px-4 py-3 transition-all duration-300 hover:border-border/60 hover:bg-gradient-to-r hover:from-muted/50 hover:to-transparent hover:shadow-sm">
                      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold leading-tight tracking-tight text-foreground">
                            {it.label}
                          </p>
                          {it.sub && (
                            <p className="mt-1 truncate text-[11px] uppercase tracking-[0.06em] text-muted-foreground/90">
                              {it.sub}
                            </p>
                          )}
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
                          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        {linkAbrir && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-6 py-3">
            <Button asChild size="sm" variant="outline" className="h-8 rounded-lg">
              <Link to={linkAbrir} onClick={() => onOpenChange(false)}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {linkAbrirLabel}
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

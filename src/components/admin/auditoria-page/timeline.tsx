import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AuditoriaLinha } from "@/lib/admin/auditoria.functions";
import { classificar, fmtHora, rotuloEntidade, TOM_CLASSES } from "./helpers";

export function VazioAuditoria({ temFiltro }: { temFiltro: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <ShieldCheck className="size-6" />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">Nenhum registro encontrado</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {temFiltro
            ? "Ajuste os filtros para ver outros eventos."
            : "As ações realizadas no sistema aparecerão aqui."}
        </p>
      </div>
    </div>
  );
}

export function TimelineAuditoria({
  grupos,
  onSelecionar,
}: {
  grupos: [string, AuditoriaLinha[]][];
  onSelecionar: (r: AuditoriaLinha) => void;
}) {
  return (
    <div className="space-y-6">
      {grupos.map(([dia, itens]) => (
        <section key={dia}>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {dia}
            </h2>
            <span className="h-px flex-1 bg-border" />
            <Badge variant="secondary" className="text-[10px]">
              {itens.length} evento{itens.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="relative space-y-2 pl-3">
            <span className="absolute bottom-2 left-[7px] top-2 w-px bg-border" aria-hidden />
            {itens.map((r) => {
              const { tom, Icone } = classificar(r.acao);
              const c = TOM_CLASSES[tom];
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => onSelecionar(r)}
                  className="relative flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "z-10 grid size-8 shrink-0 place-items-center rounded-lg ring-1",
                      c.chip,
                      c.ring,
                    )}
                  >
                    <Icone className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-foreground">{r.mensagem}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className={cn("inline-flex items-center gap-1.5 font-medium")}>
                        <span className={cn("size-1.5 rounded-full", c.dot)} />
                        {r.acao_label}
                      </span>
                      {r.entidade && <span>{rotuloEntidade(r.entidade)}</span>}
                      {r.ip && <span className="tabular-nums">IP {r.ip}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground">
                    {fmtHora(r.created_at)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

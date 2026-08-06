import { AlertOctagon, Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MACRO_STAGES } from "./painel-utils";

export function Stepper({
  atualIdx,
  encerradaMotivo,
}: {
  atualIdx: number;
  encerradaMotivo: "recusado" | "cancelada" | null;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Status e etapa
      </p>
      {encerradaMotivo ? (
        <Badge
          variant="secondary"
          className="mb-3 inline-flex items-center gap-1 rounded-full border-destructive/25 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive"
        >
          <AlertOctagon className="size-3" />
          {encerradaMotivo === "recusado" ? "Crédito recusado — encerrada" : "Proposta cancelada"}
        </Badge>
      ) : (
        <Badge
          variant="secondary"
          className="mb-3 rounded-full border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary"
        >
          {MACRO_STAGES[atualIdx]?.label ?? "Em análise"}
        </Badge>
      )}

      <div className="flex items-start justify-between gap-1">
        {MACRO_STAGES.map((s, i) => {
          const feito = i < atualIdx;
          const atual = i === atualIdx;
          return (
            <div key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === 0 ? "opacity-0" : feito || atual ? "bg-primary" : "bg-border",
                  )}
                />
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    feito
                      ? "border-primary bg-primary text-primary-foreground"
                      : atual
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {feito ? (
                    <Check className="size-3" />
                  ) : (
                    <Circle className={cn("size-2 fill-current", atual ? "" : "opacity-50")} />
                  )}
                </div>
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === MACRO_STAGES.length - 1 ? "opacity-0" : feito ? "bg-primary" : "bg-border",
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-center text-[10px] font-medium leading-tight",
                  atual ? "text-foreground" : feito ? "text-primary" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

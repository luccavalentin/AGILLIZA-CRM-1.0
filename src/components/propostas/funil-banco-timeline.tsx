import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type EtapaBanco = {
  id: number | null;
  nome: string | null;
  ordem: number;
  ativa: boolean;
  concluida: boolean;
  atualizada_em: string | null;
};

/**
 * Funil COMPLETO da oportunidade retornado pela integração bancária.
 * Exibe TODAS as etapas reais informadas pelo banco (pós-aprovação inclusive),
 * na ordem oficial, sem colapsar ou cortar nenhuma. Rótulos neutros —
 * nenhum provedor de integração é citado.
 */
export function FunilBancoTimeline({ etapas }: { etapas?: EtapaBanco[] | null }) {
  const lista = Array.isArray(etapas)
    ? [...etapas].filter((e) => e?.nome).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    : [];

  if (lista.length === 0) return null;

  const totalConcluidas = lista.filter((e) => e.concluida).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Andamento no banco</h3>
          <p className="text-xs text-muted-foreground">
            Etapas oficiais informadas pela integração bancária
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
          {totalConcluidas}/{lista.length} concluídas
        </span>
      </div>

      <ol className="relative space-y-0">
        {lista.map((e, i) => {
          const last = i === lista.length - 1;
          const emAndamento = e.ativa && !e.concluida;
          return (
            <li key={`${e.id ?? e.ordem}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && (
                <span
                  className={cn(
                    "absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-0.5 rounded-full",
                    e.concluida ? "bg-primary" : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-1",
                  e.concluida &&
                    "bg-primary text-primary-foreground ring-primary/20 shadow-sm",
                  emAndamento &&
                    "bg-primary/10 text-primary ring-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_10%,transparent)]",
                  !e.concluida && !emAndamento && "bg-muted text-muted-foreground ring-border",
                )}
              >
                {e.concluida ? (
                  <Check className="h-3.5 w-3.5" />
                ) : emAndamento ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Circle className="h-2 w-2 fill-current" />
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-sm leading-tight",
                    emAndamento
                      ? "font-semibold text-primary"
                      : e.concluida
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {e.nome}
                </p>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {emAndamento ? "Em andamento" : e.concluida ? "Concluída" : "Pendente"}
                  {e.atualizada_em && (e.concluida || emAndamento) && (
                    <span className="ml-1.5 font-normal normal-case tracking-normal">
                      · {formatarData(e.atualizada_em)}
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function formatarData(v: string): string {
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

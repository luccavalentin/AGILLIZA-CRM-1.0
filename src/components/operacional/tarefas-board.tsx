import { useState } from "react";
import { Check, ChevronDown, Clock, Loader2, User2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { OpAvatar, PriorityChip } from "@/components/operacional/ui";
import { STATUS_TAREFA, type Prioridade } from "@/components/operacional/status";
import { cn } from "@/lib/utils";

/** Item mínimo consumido pelo board (evita acoplar ao tipo completo do server fn). */
export interface TarefaBoardItem {
  id: string;
  numero: string | null;
  titulo: string;
  status: string;
  prioridade: string;
  prazo: string | null;
  nome_cliente?: string | null;
  nome_responsavel?: string | null;
}

export interface GrupoBoard {
  id: string;
  titulo: string;
  accent: string;
  tarefas: TarefaBoardItem[];
}

/** Cor sólida de cada status, no espírito das "status columns" de boards profissionais. */
const STATUS_COR: Record<string, string> = {
  aberta: "var(--primary)",
  em_andamento: "var(--warning)",
  concluida: "var(--success)",
  cancelada: "var(--muted-foreground)",
};

const STATUS_OPCOES = ["aberta", "em_andamento", "concluida", "cancelada"] as const;

const COLS =
  "grid-cols-[26px_minmax(0,1fr)] md:grid-cols-[26px_minmax(0,1fr)_140px_128px_138px_168px_36px]";

function fmtData(iso: string | null): string {
  if (!iso) return "Sem prazo";
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function vencida(prazo: string | null, status: string): boolean {
  if (!prazo || status === "concluida" || status === "cancelada") return false;
  return new Date(prazo).getTime() < Date.now();
}

/** Pílula de status sólida com troca rápida. */
function StatusPill({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const cfg = STATUS_TAREFA[status] ?? { label: status };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group/st flex h-[30px] w-full items-center justify-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold uppercase tracking-wide text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.14)] transition-[filter,transform] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ background: STATUS_COR[status] ?? "var(--muted-foreground)" }}
        >
          <span className="truncate">{cfg.label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/st:opacity-90" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {STATUS_OPCOES.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onChange(s)} className="gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: STATUS_COR[s] }}
              aria-hidden
            />
            {STATUS_TAREFA[s].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Board de tarefas em grupos colapsáveis com colunas — visual editorial e denso. */
export function TarefasBoard({
  grupos,
  alternando,
  onSelecionar,
  onToggle,
  onStatus,
  onExcluir,
}: {
  grupos: GrupoBoard[];
  alternando: string | null;
  onSelecionar: (id: string) => void;
  onToggle: (t: TarefaBoardItem) => void;
  onStatus: (t: TarefaBoardItem, status: string) => void;
  onExcluir: (id: string) => void | Promise<void>;
}) {
  const [fechados, setFechados] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      {grupos.map((g) => {
        if (g.tarefas.length === 0) return null;
        const aberto = !fechados[g.id];
        const feitas = g.tarefas.filter(
          (t) => t.status === "concluida" || t.status === "cancelada",
        ).length;
        const atrasadas = g.tarefas.filter((t) => vencida(t.prazo, t.status)).length;
        const pct = Math.round((feitas / g.tarefas.length) * 100);

        return (
          <section
            key={g.id}
            className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card"
            style={{ ["--op-accent" as string]: g.accent }}
          >
            {/* Cabeçalho do grupo */}
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--op-accent)_9%,var(--card)),var(--card))] px-3 py-3 sm:flex sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setFechados((f) => ({ ...f, [g.id]: aberto }))}
                  aria-label={aberto ? "Recolher grupo" : "Expandir grupo"}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-[color:var(--op-accent)] transition-colors hover:bg-accent"
                >
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", !aberto && "-rotate-90")}
                  />
                </button>
                <span
                  className="h-5 w-1 shrink-0 rounded-full"
                  style={{ background: "var(--op-accent)" }}
                  aria-hidden
                />
                <h2
                  className="truncate text-[13.5px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--op-accent)" }}
                >
                  {g.titulo}
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {g.tarefas.length}
                </span>
                {atrasadas > 0 ? (
                  <span className="hidden items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10.5px] font-semibold text-destructive sm:inline-flex">
                    <Clock className="size-3" /> {atrasadas} vencida{atrasadas > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {pct}%
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${pct}%`, background: "var(--op-accent)" }}
                  />
                </div>
              </div>
            </header>

            {aberto && (
              <>
                {/* Cabeçalho de colunas */}
                <div
                  className={cn(
                    "hidden gap-3 border-b border-border/60 bg-muted/35 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid",
                    COLS,
                  )}
                >
                  <span />
                  <span>Tarefa</span>
                  <span className="text-center">Status</span>
                  <span className="text-center">Prioridade</span>
                  <span className="text-center">Prazo</span>
                  <span className="text-center">Responsável</span>
                  <span />
                </div>

                <ul className="divide-y divide-border/50">
                  {g.tarefas.map((t) => {
                    const late = vencida(t.prazo, t.status);
                    const done = t.status === "concluida" || t.status === "cancelada";
                    return (
                      <li
                        key={t.id}
                        className={cn(
                          "group relative grid items-center gap-3 px-3 py-3 transition-colors hover:bg-[color-mix(in_oklab,var(--op-accent)_4%,transparent)]",
                          COLS,
                        )}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-[3px] scale-y-0 transition-transform group-hover:scale-y-100"
                          style={{ background: "var(--op-accent)" }}
                        />

                        <button
                          type="button"
                          aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                          onClick={() => onToggle(t)}
                          disabled={alternando === t.id}
                          className={cn(
                            "grid size-[22px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                            done
                              ? "border-success bg-success text-success-foreground"
                              : "border-muted-foreground/35 text-transparent hover:border-primary hover:text-primary/40",
                          )}
                        >
                          {alternando === t.id ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          ) : (
                            <Check className="h-3 w-3" strokeWidth={3} />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelecionar(t.id)}
                          className="flex min-w-0 flex-col gap-1 text-left"
                        >
                          <span
                            className={cn(
                              "line-clamp-1 text-[13.5px] font-semibold tracking-tight",
                              done ? "text-muted-foreground line-through" : "text-foreground",
                            )}
                          >
                            {t.titulo}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="rounded-md border border-border/70 bg-muted/50 px-1.5 py-px font-medium tabular-nums">
                              {t.numero ?? "—"}
                            </span>
                            {t.nome_cliente && (
                              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                <User2 className="h-3 w-3 shrink-0" />
                                <span className="truncate">{t.nome_cliente}</span>
                              </span>
                            )}
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 tabular-nums md:hidden",
                                late && "font-semibold text-destructive",
                              )}
                            >
                              <Clock className="h-3 w-3" />
                              {fmtData(t.prazo)}
                            </span>
                            <span className="md:hidden">
                              <PriorityChip prioridade={t.prioridade as Prioridade} />
                            </span>
                          </span>
                        </button>

                        <div className="hidden md:block">
                          <StatusPill status={t.status} onChange={(s) => onStatus(t, s)} />
                        </div>

                        <div className="hidden justify-center md:flex">
                          <PriorityChip prioridade={t.prioridade as Prioridade} />
                        </div>

                        <div
                          className={cn("hidden justify-center md:flex", late && "font-semibold")}
                        >
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[11px] tabular-nums text-muted-foreground",
                              late && "border-destructive/30 bg-destructive/10 text-destructive",
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {fmtData(t.prazo)}
                          </span>
                        </div>

                        <div className="hidden min-w-0 items-center justify-center gap-2 md:flex">
                          {t.nome_responsavel ? (
                            <>
                              <OpAvatar nome={t.nome_responsavel} className="size-6 text-[10px]" />
                              <span className="truncate text-[12px] text-muted-foreground">
                                {t.nome_responsavel}
                              </span>
                            </>
                          ) : (
                            <span className="text-[12px] text-muted-foreground/60">—</span>
                          )}
                        </div>

                        <div className="hidden justify-end opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:flex">
                          <ConfirmDelete
                            titulo="Excluir tarefa"
                            descricao={`A tarefa ${t.numero ?? "—"} será removida permanentemente.`}
                            onConfirm={async () => {
                              await onExcluir(t.id);
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

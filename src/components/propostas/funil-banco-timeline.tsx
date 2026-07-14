import { Check, Loader2, Lock, X } from "lucide-react";
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
 *
 * Entre "Simulação" e a próxima etapa, exibimos uma bifurcação visual
 * (Aprovado / Reprovado). O estado é derivado do status da proposta:
 * - Reprovado → status === "credito_recusado" (fluxo morre aqui)
 * - Aprovado  → há qualquer etapa posterior ativa/concluída OU status já
 *   avançou além da análise de crédito.
 */
export function FunilBancoTimeline({
  etapas,
  statusProposta,
}: {
  etapas?: EtapaBanco[] | null;
  statusProposta?: string | null;
}) {
  const lista = Array.isArray(etapas)
    ? [...etapas].filter((e) => e?.nome).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    : [];

  if (lista.length === 0) return null;

  const totalConcluidas = lista.filter((e) => e.concluida).length;

  const reprovado = statusProposta === "credito_recusado";
  // Índice da etapa "Simulação" (se existir) para posicionar a bifurcação.
  const idxSimulacao = lista.findIndex((e) =>
    (e.nome ?? "").toLowerCase().includes("simula"),
  );
  const temPosSimulacao = idxSimulacao >= 0 && idxSimulacao < lista.length - 1;
  const posSimulacaoAlcancada = temPosSimulacao
    ? lista.slice(idxSimulacao + 1).some((e) => e.ativa || e.concluida)
    : false;
  const aprovado = !reprovado && posSimulacaoAlcancada;
  const decisaoPendente = !reprovado && !aprovado;

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
          // Etapas posteriores à Simulação ficam "mortas" se reprovado.
          const morta = reprovado && temPosSimulacao && i > idxSimulacao;
          const isSimulacao = i === idxSimulacao;
          const mostrarBifurcacao = isSimulacao && temPosSimulacao;
          return (
            <li key={`${e.id ?? e.ordem}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && (
                <span
                  className={cn(
                    "absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-0.5 rounded-full",
                    morta
                      ? "bg-border/60"
                      : e.concluida
                        ? "bg-primary"
                        : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-1",
                  morta && "bg-muted text-muted-foreground/60 ring-border",
                  !morta && e.concluida &&
                    "bg-primary text-primary-foreground ring-primary/20 shadow-sm",
                  !morta && emAndamento &&
                    "bg-primary/10 text-primary ring-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_10%,transparent)]",
                  !morta && !e.concluida && !emAndamento && "bg-muted/60 text-muted-foreground/70 ring-dashed ring-border",
                )}
              >
                {e.concluida && !morta ? (
                  <Check className="h-3.5 w-3.5" />
                ) : emAndamento && !morta ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={cn(
                    "text-sm leading-tight",
                    morta
                      ? "text-muted-foreground/60 line-through"
                      : emAndamento
                        ? "font-semibold text-primary"
                        : e.concluida
                          ? "font-medium text-foreground"
                          : "text-muted-foreground/70",
                  )}
                >
                  {e.nome}
                </p>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {morta
                    ? "Não se aplica"
                    : emAndamento
                      ? "Em andamento"
                      : e.concluida
                        ? "Concluída"
                        : "Bloqueada"}
                  {e.atualizada_em && !morta && (e.concluida || emAndamento) && (
                    <span className="ml-1.5 font-normal normal-case tracking-normal">
                      · {formatarData(e.atualizada_em)}
                    </span>
                  )}
                </p>

                {mostrarBifurcacao && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <BranchChip
                      tone="success"
                      label="Aprovado"
                      state={aprovado ? "ativo" : decisaoPendente ? "aguardando" : "descartado"}
                      caption="segue para Crédito"
                    />
                    <BranchChip
                      tone="danger"
                      label="Reprovado"
                      state={reprovado ? "ativo" : decisaoPendente ? "aguardando" : "descartado"}
                      caption="fluxo encerrado"
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function BranchChip({
  tone,
  label,
  state,
  caption,
}: {
  tone: "success" | "danger";
  label: string;
  state: "ativo" | "aguardando" | "descartado";
  caption: string;
}) {
  const ativo = state === "ativo";
  const descartado = state === "descartado";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tone === "success" && ativo && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "danger" && ativo && "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        !ativo && !descartado && "border-border bg-muted/60 text-muted-foreground",
        descartado && "border-dashed border-border bg-transparent text-muted-foreground/60",
      )}
    >
      <span
        className={cn(
          "grid size-4 place-items-center rounded-full",
          tone === "success" && ativo && "bg-emerald-500 text-white",
          tone === "danger" && ativo && "bg-rose-500 text-white",
          !ativo && "bg-muted text-muted-foreground",
        )}
      >
        {tone === "success" ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      </span>
      <span className={cn(descartado && "line-through")}>{label}</span>
      <span className="font-normal normal-case tracking-normal text-muted-foreground">
        · {caption}
      </span>
    </div>
  );
}

function formatarData(v: string): string {
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}


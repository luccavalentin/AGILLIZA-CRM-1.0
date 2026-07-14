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
 *
 * Fluxo:
 *   Simulação → Análise de Crédito → (Aprovado | Reprovado)
 *     └─ Aprovado  → segue para Engenharia, Jurídica, etc.
 *     └─ Reprovado → encerra o fluxo (etapas seguintes ficam "não se aplica").
 *
 * A bifurcação (Aprovado/Reprovado) é ancorada na etapa de **Crédito**.
 * Se o banco não expõe uma etapa explícita de Crédito, usamos a etapa
 * imediatamente posterior à Simulação como âncora (compatível com o
 * comportamento anterior).
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

  // Localiza a etapa de Crédito (bifurcação). Fallback: a etapa
  // imediatamente após "Simulação".
  const idxSimulacao = lista.findIndex((e) =>
    (e.nome ?? "").toLowerCase().includes("simula"),
  );
  const idxCreditoNativo = lista.findIndex((e) => {
    const n = (e.nome ?? "").toLowerCase();
    return n.includes("crédit") || n.includes("credit") || n.includes("análise de");
  });
  const idxBifurcacao =
    idxCreditoNativo >= 0
      ? idxCreditoNativo
      : idxSimulacao >= 0 && idxSimulacao < lista.length - 1
        ? idxSimulacao + 1
        : -1;

  const temPosBifurcacao = idxBifurcacao >= 0 && idxBifurcacao < lista.length - 1;

  // "Aprovado" quando qualquer etapa posterior à bifurcação já foi
  // ativada/concluída, OU quando a própria etapa de Crédito está concluída
  // sem reprovação.
  const etapaBifurcacao = idxBifurcacao >= 0 ? lista[idxBifurcacao] : null;
  const posBifurcacaoAlcancada = temPosBifurcacao
    ? lista.slice(idxBifurcacao + 1).some((e) => e.ativa || e.concluida)
    : false;
  const aprovado =
    !reprovado && (posBifurcacaoAlcancada || (etapaBifurcacao?.concluida ?? false));
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
          // Etapas posteriores à bifurcação ficam "mortas" se reprovado.
          const morta = reprovado && idxBifurcacao >= 0 && i > idxBifurcacao;
          const mostrarBifurcacao = i === idxBifurcacao && temPosBifurcacao;
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
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <DecisionCard
                      tone="success"
                      label="Aprovado"
                      state={aprovado ? "ativo" : decisaoPendente ? "aguardando" : "descartado"}
                      caption="Segue para Engenharia, Jurídica e demais etapas"
                    />
                    <DecisionCard
                      tone="danger"
                      label="Reprovado"
                      state={reprovado ? "ativo" : decisaoPendente ? "aguardando" : "descartado"}
                      caption="Fluxo encerrado — sem próximas etapas"
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

function DecisionCard({
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
  const aguardando = state === "aguardando";

  const statusLabel = ativo ? "Decisão registrada" : aguardando ? "Aguardando decisão" : "Não ocorreu";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-3 transition-colors",
        // ativo — cor forte por tom
        tone === "success" && ativo &&
          "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_0_1px_color-mix(in_oklab,theme(colors.emerald.500)_20%,transparent)]",
        tone === "danger" && ativo &&
          "border-rose-500/50 bg-rose-500/10 shadow-[0_0_0_1px_color-mix(in_oklab,theme(colors.rose.500)_20%,transparent)]",
        // aguardando — neutro com hint do tom
        aguardando && tone === "success" && "border-emerald-500/25 bg-emerald-500/[0.04]",
        aguardando && tone === "danger" && "border-rose-500/25 bg-rose-500/[0.04]",
        // descartado — apagado
        descartado && "border-dashed border-border bg-transparent",
      )}
    >
      {/* barra lateral tonal */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          tone === "success" && (ativo ? "bg-emerald-500" : aguardando ? "bg-emerald-500/40" : "bg-border"),
          tone === "danger" && (ativo ? "bg-rose-500" : aguardando ? "bg-rose-500/40" : "bg-border"),
        )}
      />
      <div className="flex items-start gap-2.5 pl-2">
        <span
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ring-1",
            tone === "success" && ativo && "bg-emerald-500 text-white ring-emerald-500/30",
            tone === "danger" && ativo && "bg-rose-500 text-white ring-rose-500/30",
            !ativo && "bg-muted text-muted-foreground ring-border",
          )}
        >
          {tone === "success" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-semibold leading-none",
                tone === "success" && ativo && "text-emerald-700 dark:text-emerald-300",
                tone === "danger" && ativo && "text-rose-700 dark:text-rose-300",
                !ativo && "text-foreground/80",
                descartado && "text-muted-foreground line-through",
              )}
            >
              {label}
            </span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                ativo && tone === "success" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                ativo && tone === "danger" && "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                !ativo && "bg-muted text-muted-foreground",
              )}
            >
              {statusLabel}
            </span>
          </div>
          <p
            className={cn(
              "mt-1 text-[11px] leading-snug text-muted-foreground",
              descartado && "text-muted-foreground/60",
            )}
          >
            {caption}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatarData(v: string): string {
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}



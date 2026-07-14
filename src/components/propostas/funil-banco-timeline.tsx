import { Check, Loader2, Lock, X, Radio } from "lucide-react";
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
 * Painel "Andamento no banco" em estilo telemetria/dashboard em execução.
 *
 * Fluxo:
 *   Simulação → Análise de Crédito → (Aprovado | Reprovado)
 *     └─ Aprovado  → Engenharia, Jurídica, Formalização, Contrato…
 *     └─ Reprovado → encerra o fluxo (etapas seguintes viram "não se aplica").
 *
 * Todas as métricas exibidas usam dados reais do payload (atualizada_em,
 * concluida, ativa, statusProposta). Nada é hardcoded/fake.
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
  const total = lista.length;
  const pctConcluidas = total > 0 ? Math.round((totalConcluidas / total) * 100) : 0;

  const reprovado = statusProposta === "credito_recusado";

  // Localiza a etapa de decisão (Crédito). Fallback: primeira etapa após Simulação.
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
  const etapaBifurcacao = idxBifurcacao >= 0 ? lista[idxBifurcacao] : null;
  const posBifurcacaoAlcancada = temPosBifurcacao
    ? lista.slice(idxBifurcacao + 1).some((e) => e.ativa || e.concluida)
    : false;
  const aprovado =
    !reprovado && (posBifurcacaoAlcancada || (etapaBifurcacao?.concluida ?? false));
  const decisaoPendente = !reprovado && !aprovado;

  // Última sincronização = maior atualizada_em de qualquer etapa.
  const ultimaSync = lista
    .map((e) => e.atualizada_em)
    .filter((v): v is string => !!v)
    .sort()
    .pop();

  // Etapa em andamento (para "Tempo em etapa").
  const emAndamentoEtapa = lista.find((e) => e.ativa && !e.concluida);
  const tempoEmEtapa = emAndamentoEtapa?.atualizada_em
    ? formatarDuracao(emAndamentoEtapa.atualizada_em)
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header — status geral + progresso */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/30 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-foreground">
            Andamento no banco
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Monitoramento em tempo real via integração bancária
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-primary tabular-nums">
              {totalConcluidas}/{total} concluídas
            </span>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
              {pctConcluidas}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-700 ease-out"
              style={{ width: `${pctConcluidas}%` }}
            />
          </div>
        </div>
      </div>

      {/* Trilha vertical */}
      <div className="relative px-5 py-5">
        {/* Linha vertical de fundo */}
        <div
          className="pointer-events-none absolute left-[calc(1.25rem+11px)] top-6 w-[2px] rounded-full bg-border/70"
          style={{ height: "calc(100% - 3rem)" }}
          aria-hidden
        />

        <ol className="relative space-y-4">
          {lista.map((e, i) => {
            const emAndamento = e.ativa && !e.concluida;
            const morta = reprovado && idxBifurcacao >= 0 && i > idxBifurcacao;
            const mostrarBifurcacao = i === idxBifurcacao && temPosBifurcacao;
            const pendente = !e.concluida && !emAndamento && !morta;

            return (
              <li
                key={`${e.id ?? e.ordem}-${i}`}
                className={cn(
                  "relative flex gap-3 transition-opacity duration-300",
                  pendente && !mostrarBifurcacao && "opacity-70",
                )}
              >
                {/* Nó */}
                <span
                  className={cn(
                    "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-[3px] border-card shadow-sm",
                    morta && "bg-muted text-muted-foreground/60",
                    !morta && e.concluida && "bg-emerald-500 text-white",
                    !morta && emAndamento &&
                      "bg-primary text-primary-foreground ring-4 ring-primary/15",
                    !morta && pendente && "bg-muted text-muted-foreground/70",
                  )}
                >
                  {morta ? (
                    <X className="h-3 w-3" strokeWidth={3} />
                  ) : e.concluida ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : emAndamento ? (
                    <span
                      className="size-1.5 rounded-full bg-primary-foreground animate-pulse"
                      aria-hidden
                    />
                  ) : (
                    <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
                  )}
                </span>

                <div className="min-w-0 flex-1 pb-1">
                  {/* Título + badge de estado (na mesma linha, alinhado à direita) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-sm leading-tight",
                        morta
                          ? "text-muted-foreground/60 line-through"
                          : emAndamento
                            ? "font-bold text-primary"
                            : e.concluida
                              ? "font-semibold text-foreground"
                              : "font-medium text-muted-foreground/80",
                      )}
                    >
                      {e.nome}
                    </span>
                    {emAndamento && !morta && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
                        Em processamento
                      </span>
                    )}
                    {e.concluida && !morta && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Concluída
                      </span>
                    )}
                    {morta && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Não se aplica
                      </span>
                    )}
                    {pendente && !mostrarBifurcacao && (
                      <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                        Bloqueada
                      </span>
                    )}
                  </div>

                  {/* Linha de metadados (timestamp) */}
                  {e.atualizada_em && !morta && (e.concluida || emAndamento) && (
                    <p className="mt-1 text-[10px] font-mono tabular-nums text-muted-foreground">
                      · {formatarDataHora(e.atualizada_em)}
                    </p>
                  )}

                  {/* Painel tonal na etapa em andamento */}
                  {emAndamento && !morta && !mostrarBifurcacao && (
                    <div className="mt-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2">
                      <p className="text-[11px] leading-snug text-foreground/80">
                        A integração bancária está processando esta etapa. O sistema atualiza
                        automaticamente quando houver retorno.
                      </p>
                    </div>
                  )}

                  {/* Bifurcação (Análise de Crédito) */}
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

      {/* Rodapé — telemetria com dados reais */}
      {(tempoEmEtapa || ultimaSync) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-4">
            {tempoEmEtapa && (
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tempo em etapa
                </span>
                <span className="text-[11px] font-mono tabular-nums text-foreground">
                  {tempoEmEtapa}
                </span>
              </div>
            )}
            {tempoEmEtapa && ultimaSync && <span className="h-6 w-px bg-border" aria-hidden />}
            {ultimaSync && (
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Última sincronização
                </span>
                <span className="text-[11px] font-mono tabular-nums text-foreground">
                  {formatarDataHora(ultimaSync)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Radio className="h-3 w-3 animate-pulse text-emerald-500" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wider">Canal operacional</span>
          </div>
        </div>
      )}
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
        "relative overflow-hidden rounded-xl border-2 p-3 transition-all",
        tone === "success" && ativo &&
          "border-emerald-500 bg-emerald-500/[0.06] shadow-[0_0_0_4px_color-mix(in_oklab,theme(colors.emerald.500)_10%,transparent)]",
        tone === "danger" && ativo &&
          "border-rose-500 bg-rose-500/[0.06] shadow-[0_0_0_4px_color-mix(in_oklab,theme(colors.rose.500)_10%,transparent)]",
        aguardando && tone === "success" && "border-emerald-500/25 bg-emerald-500/[0.03]",
        aguardando && tone === "danger" && "border-rose-500/25 bg-rose-500/[0.03]",
        descartado && "border-dashed border-border bg-transparent",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
            tone === "success" && ativo && "bg-emerald-500 text-white shadow-sm",
            tone === "danger" && ativo && "bg-rose-500 text-white shadow-sm",
            !ativo && tone === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            !ativo && tone === "danger" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
            descartado && "bg-muted text-muted-foreground",
          )}
        >
          {tone === "success" ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ) : (
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "text-sm font-bold leading-none",
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
                "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                ativo && tone === "success" && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
                ativo && tone === "danger" && "bg-rose-500/20 text-rose-700 dark:text-rose-300",
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

function parseDate(v: string): Date | null {
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function formatarDataHora(v: string): string {
  const d = parseDate(v);
  if (!d) return v;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarDuracao(desde: string): string | null {
  const d = parseDate(desde);
  if (!d) return null;
  const ms = Date.now() - d.getTime();
  if (ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const mRes = min % 60;
  if (h < 24) return mRes > 0 ? `${h}h ${mRes}min` : `${h}h`;
  const dias = Math.floor(h / 24);
  const hRes = h % 24;
  return hRes > 0 ? `${dias}d ${hRes}h` : `${dias}d`;
}

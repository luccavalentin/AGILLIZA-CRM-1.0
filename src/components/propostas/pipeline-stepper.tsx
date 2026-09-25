import { useEffect, useRef } from "react";
import { Check, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SituacaoDocumentacao } from "@/lib/propostas/documentacao-status";
import { DocumentacaoProposta } from "./documentacao-proposta";
import { etapasDoBanco, indiceEtapa } from "./pipeline-map";

/**
 * Stepper horizontal do ciclo da oportunidade — a régua do banco da proposta
 * (Itaú e Santander com a etapa de formulários, no nome de cada portal).
 * Etapas `auto` avançam pela integração bancária; as demais são concluídas
 * manualmente.
 * O trilho rola horizontalmente dentro do card em telas estreitas, com
 * padding vertical para nunca cortar o anel da etapa atual.
 */
export function PipelineStepper({
  status,
  detalheStatus,
  banco,
  propostaId,
  documentacao,
}: {
  status: string;
  detalheStatus?: string | null;
  /** Banco da proposta: decide as etapas e os nomes da régua. */
  banco?: string | null;
  /** Com os dois, o selo da documentação aparece abaixo de "Documentos". */
  propostaId?: string;
  documentacao?: SituacaoDocumentacao | null;
}) {
  const etapas = etapasDoBanco(banco, status);
  const trilhoRef = useRef<HTMLDivElement>(null);

  // Régua maior que a tela (celular): abre com a etapa atual no centro, em
  // vez de mostrar sempre o começo e esconder onde a proposta está.
  useEffect(() => {
    const trilho = trilhoRef.current;
    const alvo = trilho?.querySelector<HTMLElement>("[data-atual]");
    if (!trilho || !alvo || trilho.scrollWidth <= trilho.clientWidth) return;
    trilho.scrollLeft = alvo.offsetLeft - (trilho.clientWidth - alvo.offsetWidth) / 2;
  }, [status, banco]);
  const recusado = status === "credito_recusado";
  const temSeloDocs = Boolean(propostaId && documentacao);
  const seloDocs = (centralizado: boolean) =>
    temSeloDocs ? (
      <DocumentacaoProposta
        propostaId={propostaId!}
        situacao={documentacao}
        centralizado={centralizado}
      />
    ) : null;

  if (status === "cancelada") {
    return (
      <div className="flex w-full items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
          <Ban className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-destructive">
            Proposta cancelada — fluxo interrompido
          </p>
          {detalheStatus && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Detalhe: {detalheStatus}
            </p>
          )}
        </div>
      </div>
    );
  }

  const atual = indiceEtapa(status, banco);
  const total = etapas.length;
  const progresso = Math.round(((atual + 1) / total) * 100);
  const etapaAtual = etapas[atual];

  return (
    <div className="w-full">
      {/* Cabeçalho do progresso */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Etapa {atual + 1} de {total}
          </span>
          {etapaAtual && (
            <span
              className={cn(
                "truncate text-sm font-semibold",
                recusado ? "text-destructive" : "text-foreground",
              )}
            >
              · {etapaAtual.label}
            </span>
          )}
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {progresso}% concluído
        </span>
      </div>

      {/* Barra de progresso fina */}
      <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            recusado
              ? "bg-gradient-to-r from-destructive/70 to-destructive"
              : "bg-gradient-to-r from-primary/70 to-primary",
          )}
          style={{ width: `${progresso}%` }}
        />
      </div>

      {/* Trilho de etapas — padding vertical evita corte do anel. Quando não
          cabe (celular, régua de 8 etapas), rola na horizontal dentro do card
          e abre centralizado na etapa atual. */}
      <div
        ref={trilhoRef}
        className="relative w-full overflow-x-auto overscroll-x-contain px-1 pb-2 pt-3 [scrollbar-width:thin]"
      >
        <ol className="flex w-max min-w-full items-start justify-between">
          {etapas.map((etapa, i) => {
            const concluida = i < atual;
            const isAtual = i === atual;
            const first = i === 0;
            const recusadaAtual = isAtual && recusado;
            return (
              <li
                key={etapa.codigo}
                data-atual={isAtual || undefined}
                aria-current={isAtual ? "step" : undefined}
                className={cn("flex items-start", !first && "flex-1")}
              >
                {!first && (
                  <div className="mt-[15px] h-0.5 min-w-4 flex-1 overflow-hidden rounded-full bg-border sm:min-w-6">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        i <= atual
                          ? recusado && i >= atual
                            ? "bg-destructive"
                            : "bg-primary"
                          : "bg-transparent",
                      )}
                      style={{ width: i <= atual ? "100%" : "0%" }}
                    />
                  </div>
                )}
                <div className="flex w-16 flex-col items-center gap-2 px-1 sm:w-20 lg:w-24">
                  <span
                    className={cn(
                      "relative grid size-8 place-items-center rounded-full text-xs font-bold transition-all",
                      concluida &&
                        "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20",
                      isAtual &&
                        !recusadaAtual &&
                        "bg-primary/10 text-primary ring-2 ring-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_10%,transparent)]",
                      recusadaAtual &&
                        "bg-destructive/10 text-destructive ring-2 ring-destructive shadow-[0_0_0_4px_color-mix(in_oklab,var(--destructive)_12%,transparent)]",
                      !concluida && !isAtual && "bg-muted text-muted-foreground ring-1 ring-border",
                    )}
                  >
                    {concluida ? <Check className="h-4 w-4" /> : etapa.numero}
                  </span>
                  <span
                    className={cn(
                      "line-clamp-2 text-center text-[11px] font-medium leading-tight",
                      recusadaAtual
                        ? "text-destructive"
                        : isAtual
                          ? "font-semibold text-primary"
                          : concluida
                            ? "text-foreground/70"
                            : "text-muted-foreground",
                    )}
                  >
                    {etapa.label}
                  </span>
                  {/* Selo da documentação embaixo de "Documentos". Tem largura
                      própria (mais que a coluna), centralizada: ocupa o vão
                      abaixo dos conectores — ali não há nada — e fica em duas
                      linhas legíveis. No fluxo, empurra o que vem abaixo em vez
                      de sobrepor. No celular vai numa linha própria. */}
                  {etapa.codigo === "documentos" && temSeloDocs && (
                    <div className="hidden w-40 justify-center self-center sm:flex">
                      {seloDocs(true)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {temSeloDocs && (
        <div className="mt-1 flex flex-wrap items-center gap-2 sm:hidden">
          <span className="text-[11px] font-semibold text-muted-foreground">Documentos</span>
          {seloDocs(false)}
        </div>
      )}

      {detalheStatus && (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Detalhe Status: <span className="font-medium text-foreground/80">{detalheStatus}</span>
        </p>
      )}
    </div>
  );
}

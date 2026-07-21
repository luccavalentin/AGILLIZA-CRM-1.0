import { FolderClosed, Lock, Plus, Users } from "lucide-react";
import type { PainelStage } from "@/lib/crm/clientes.functions";
import { ICONES_ETAPA, type PainelClienteItem } from "./utils";

interface Props {
  stage: PainelStage;
  ordem: number;
  ehAlvoArrasto: boolean;
  arrastando: boolean;
  /** Coluna sincronizada pela proposta — sem arrasto/drop. */
  readOnly?: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onAbrirEtapa: () => void;
  onAdicionarCliente: () => void;
  renderCard: (cliente: PainelClienteItem) => React.ReactNode;
}

/**
 * Coluna individual (etapa) da esteira do CRM.
 *
 * Regra de rolagem: a coluna NÃO tem `overflow-y-auto` — ela cresce com o
 * conteúdo e a página inteira rola naturalmente. Isso evita o "trava do
 * wheel" quando o cursor está sobre uma coluna com muitos cards.
 */
export function ColunaEsteira({
  stage,
  ordem,
  ehAlvoArrasto,
  readOnly = false,
  onDragOver,
  onDragLeave,
  onDrop,
  onAbrirEtapa,
  onAdicionarCliente,
  renderCard,
}: Props) {
  const temClientes = stage.clientes.length > 0;
  const Icone = ICONES_ETAPA[stage.codigo] ?? Users;
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group relative flex min-h-[22rem] min-w-0 flex-col overflow-hidden rounded-2xl border bg-card/95 shadow-sm backdrop-blur-sm transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        ehAlvoArrasto
          ? "border-primary ring-2 ring-primary/40"
          : "border-border/70 hover:border-primary/40"
      }`}
    >
      {/* Faixa colorida superior — dá identidade visual à etapa */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary/20"
      />

      <div className="relative flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-br from-primary/[0.04] via-card to-card px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
            <Icone className="size-3.5" strokeWidth={2.25} />
            <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold leading-none text-primary-foreground shadow-sm">
              {ordem}
            </span>
          </span>
          <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">
            {stage.nome}
          </span>
        </div>
        <button
          type="button"
          onClick={() => temClientes && onAbrirEtapa()}
          disabled={!temClientes}
          title={temClientes ? "Ver clientes desta etapa" : undefined}
          className={`min-w-7 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums transition-colors ${
            temClientes
              ? "cursor-pointer bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
              : "cursor-default text-muted-foreground"
          }`}
        >
          {stage.clientes.length}
        </button>
      </div>

      {readOnly && (
        <div
          className="flex items-center gap-1.5 border-b border-border/60 bg-muted/30 px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          title="Esta etapa é atualizada automaticamente pela proposta."
        >
          <Lock className="size-3" strokeWidth={2.25} />
          <span className="truncate">Sincronizado com a proposta</span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3">
        {!temClientes ? (
          <div
            className={`flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-center transition-colors ${
              ehAlvoArrasto
                ? "border-primary/60 bg-primary/5 text-primary"
                : "border-border/50 text-muted-foreground"
            }`}
          >
            <Icone className="size-6 opacity-40" />
            <span className="text-xs">
              {ehAlvoArrasto ? "Solte aqui" : "Nenhum cliente nesta etapa"}
            </span>
          </div>
        ) : (
          stage.clientes.map((c) => renderCard(c))
        )}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={onAdicionarCliente}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 bg-muted/20 px-3 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <Plus className="size-3.5" />
          Adicionar cliente
        </button>
      )}
    </div>
  );
}

/** Card em destaque no final da esteira que abre o arquivo de contratos emitidos. */
export function PastaArquivados({
  total,
  onAbrir,
}: {
  total: number;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      title="Abrir arquivo de contratos emitidos"
      className="group/arq relative flex min-h-[22rem] min-w-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-primary/10 p-5 text-center shadow-sm ring-1 ring-inset ring-primary/5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
    >
      <span className="relative grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary shadow-inner transition-colors duration-200 group-hover/arq:bg-primary group-hover/arq:text-primary-foreground">
        <FolderClosed className="size-6" />
        {total > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-md ring-2 ring-card">
            {total}
          </span>
        )}
      </span>
      <span className="relative flex flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">Contratos emitidos</span>
        <span className="text-[11px] leading-snug text-muted-foreground">
          {total > 0
            ? `${total} contrato${total > 1 ? "s" : ""} arquivado${total > 1 ? "s" : ""}`
            : "Arquivo dos contratos já emitidos"}
        </span>
      </span>
      <span className="relative mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors group-hover/arq:bg-primary group-hover/arq:text-primary-foreground">
        Abrir arquivo
      </span>
    </button>
  );
}

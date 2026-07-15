import { FolderClosed, Users } from "lucide-react";
import { Plus } from "lucide-react";
import type { PainelStage } from "@/lib/crm/clientes.functions";
import { ICONES_ETAPA, type PainelClienteItem } from "./utils";
import { CardCliente } from "./card-cliente";

interface Props {
  stage: PainelStage;
  ordem: number;
  ehAlvoArrasto: boolean;
  arrastando: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onAbrirEtapa: () => void;
  onAdicionarCliente: () => void;
  renderCard: (cliente: PainelClienteItem) => React.ReactNode;
}

/** Coluna individual (etapa) da esteira do CRM. */
export function ColunaEsteira({
  stage,
  ordem,
  ehAlvoArrasto,
  onDragOver,
  onDragLeave,
  onDrop,
  onAbrirEtapa,
  onAdicionarCliente,
  renderCard,
}: Props) {
  const temClientes = stage.clientes.length > 0;
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group relative flex min-h-[24rem] min-w-0 flex-col rounded-2xl border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md sm:max-h-[calc(100dvh-18rem)] ${
        ehAlvoArrasto ? "border-primary ring-2 ring-primary/40" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-bold tabular-nums text-primary-foreground">
            {ordem}
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
          className={`min-w-6 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums transition-colors ${
            temClientes
              ? "cursor-pointer bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
              : "cursor-default text-muted-foreground"
          }`}
        >
          {stage.clientes.length}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-3">
        {!temClientes ? (
          <div
            className={`flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center transition-colors ${
              ehAlvoArrasto
                ? "border-primary/60 bg-primary/5 text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {(() => {
              const Icone = ICONES_ETAPA[stage.codigo] ?? Users;
              return <Icone className="size-6 opacity-40" />;
            })()}
            <span className="text-xs">
              {ehAlvoArrasto ? "Solte aqui" : "Nenhum cliente nesta etapa"}
            </span>
          </div>
        ) : (
          stage.clientes.map((c) => renderCard(c))
        )}
      </div>
      <button
        type="button"
        onClick={onAdicionarCliente}
        className="flex w-full items-center justify-center gap-1.5 border-t border-border px-3 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Plus className="size-3.5" />
        Adicionar cliente
      </button>
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
      className="group/arq relative flex min-h-[18rem] min-w-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-primary/10 p-5 text-center shadow-sm ring-1 ring-inset ring-primary/5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
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

import { Workflow, MoreHorizontal, FolderClosed, Users, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type EscopoPainel = "minhas" | "geral";

interface Props {
  escopo: EscopoPainel;
  totalClientes: number;
  totalArquivados: number;
  onEscopoChange: (v: EscopoPainel) => void;
  onAbrirArquivo: () => void;
  onVerTodos: () => void;
  onLimparFiltros: () => void;
}

/** Cabeçalho do painel da esteira: título, toggle de escopo e ações rápidas. */
export function HeaderPainel({
  escopo,
  totalClientes,
  totalArquivados,
  onEscopoChange,
  onAbrirArquivo,
  onVerTodos,
  onLimparFiltros,
}: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:rounded-2xl sm:p-6">
      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Workflow className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Painel da Esteira
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Acompanhe o fluxo dos clientes em cada etapa do processo.
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 md:shrink-0 md:justify-end">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground md:inline-flex">
            <span className="size-2 animate-pulse rounded-full bg-success" />
            Atualizado agora
          </span>
          <div className="inline-flex min-w-0 flex-1 items-center rounded-full border border-border bg-background p-1 sm:flex-none">
            {(["minhas", "geral"] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => onEscopoChange(op)}
                className={`min-w-0 flex-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all sm:flex-none sm:px-3.5 ${
                  escopo === op
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {op === "minhas" ? "Minhas esteiras" : "Geral"}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0 rounded-full"
                title="Mais ações"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onAbrirArquivo}>
                <FolderClosed className="mr-2 size-4" /> Contratos emitidos
                {totalArquivados > 0 && (
                  <span className="ml-auto rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                    {totalArquivados}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onVerTodos} disabled={totalClientes === 0}>
                <Users className="mr-2 size-4" /> Ver todos os clientes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLimparFiltros}>
                <Filter className="mr-2 size-4" /> Limpar filtros
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

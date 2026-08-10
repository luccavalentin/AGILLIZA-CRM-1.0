import { Clock, Wallet } from "lucide-react";
import { ContaStatusBadge } from "@/components/financeiro/status-badge";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import type { ContaTipo } from "@/lib/financeiro/financeiro.functions";
import { AcoesMenu } from "./acoes-menu";
import type { ContaItem, ContasAcoes } from "./contas-tabela";

/**
 * Lista de cartões mobile das contas (variante < md). Complementa a
 * `ContasTabela` compartilhando o mesmo shape de item e ações.
 */
export function ContasCardsMobile({
  tipo,
  itens,
  isLoading,
  acoes,
}: {
  tipo: ContaTipo;
  itens: ContaItem[];
  isLoading: boolean;
  acoes: ContasAcoes;
}) {
  return (
    <div className="space-y-3 md:hidden">
      {isLoading &&
        Array.from({ length: 3 }).map((_, i) => (
          <div key={`mk-${i}`} className="h-24 animate-pulse rounded-xl border border-border bg-muted/50" />
        ))}
      {!isLoading && itens.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma conta encontrada</p>
        </div>
      )}
      {itens.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-border bg-card p-4 shadow-sm active:bg-primary/[0.04]"
          onClick={() => acoes.onDetalhe(c.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{c.descricao}</p>
              <p className="mt-0.5 text-xs tabular-nums text-primary">{c.numero}</p>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <AcoesMenu
                conta={c}
                tipo={tipo}
                onDetalhe={() => acoes.onDetalhe(c.id)}
                    onEditar={() => acoes.onEditar(c.id)}
                onBaixar={() => acoes.onBaixar(c)}
                onEstornar={() => acoes.onEstornar(c.id)}
                onCancelar={() => acoes.onCancelar(c.id)}
                onExcluir={() => acoes.onExcluir(c)}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <ContaStatusBadge status={c.status_efetivo} />
            <span className="text-base font-semibold tabular-nums text-foreground">
              {formatBRL(c.valor)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatData(c.vencimento)}
            </span>
            {c.contraparte && <span className="truncate">{c.contraparte}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

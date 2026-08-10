import { Wallet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ContaStatusBadge } from "@/components/financeiro/status-badge";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import type { ContaTipo } from "@/lib/financeiro/financeiro.functions";
import { AcoesMenu } from "./acoes-menu";

export interface ContaItem {
  id: string;
  numero: string | null;
  descricao: string;
  contraparte: string | null;
  categoria_nome: string | null;
  vencimento: string;
  valor: number;
  status: string;
  valor_pago: number;
  status_efetivo: string;
}

export interface ContasAcoes {
  onDetalhe: (id: string) => void;
  onEditar: (id: string) => void;
  onBaixar: (conta: ContaItem) => void;
  onEstornar: (id: string) => void;
  onCancelar: (id: string) => void;
  onExcluir: (conta: ContaItem) => void;
}

/**
 * Tabela desktop das contas. A responsividade continua sendo controlada
 * pela página (que também renderiza a lista mobile), mantendo o mesmo
 * comportamento anterior.
 */
export function ContasTabela({
  tipo,
  itens,
  isLoading,
  acoes,
  selecionados,
  onToggle,
  onToggleTodos,
}: {
  tipo: ContaTipo;
  itens: ContaItem[];
  isLoading: boolean;
  acoes: ContasAcoes;
  selecionados?: string[];
  onToggle?: (id: string) => void;
  onToggleTodos?: (marcar: boolean) => void;
}) {
  const selecionavel = !!onToggle;
  const marcados = new Set(selecionados ?? []);
  const todosMarcados = itens.length > 0 && itens.every((i) => marcados.has(i.id));

  return (
    <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/60 hover:bg-muted/60">
              {selecionavel && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={todosMarcados}
                    aria-label="Selecionar todas as contas"
                    onCheckedChange={(v) => onToggleTodos?.(!!v)}
                  />
                </TableHead>
              )}
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Número
              </TableHead>

              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Descrição
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tipo === "pagar" ? "Fornecedor" : "Pagador"}
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Categoria
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vencimento
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Valor
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell colSpan={selecionavel ? 9 : 8} className="py-3">
                    <div className="h-6 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && itens.length === 0 && (
              <TableRow>
                <TableCell colSpan={selecionavel ? 9 : 8}>
                  <div className="flex flex-col items-center gap-3 py-14 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                      <Wallet className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Nenhuma conta encontrada</p>
                    <p className="text-xs text-muted-foreground">
                      Ajuste os filtros ou cadastre uma nova conta.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {itens.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                onClick={() => acoes.onDetalhe(c.id)}
              >
                {selecionavel && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={marcados.has(c.id)}
                      aria-label={`Selecionar conta ${c.numero ?? ""}`}
                      onCheckedChange={() => onToggle?.(c.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium tabular-nums text-primary">{c.numero}</TableCell>
                <TableCell className="max-w-[220px] truncate">{c.descricao}</TableCell>
                <TableCell>{c.contraparte ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.categoria_nome ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{formatData(c.vencimento)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatBRL(c.valor)}
                </TableCell>
                <TableCell>
                  <ContaStatusBadge status={c.status_efetivo} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

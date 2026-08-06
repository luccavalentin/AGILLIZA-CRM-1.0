import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContaStatusBadge } from "@/components/financeiro/status-badge";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { listarContas, type ContaTipo } from "@/lib/financeiro/financeiro.functions";

export interface KpiDetalheFiltro {
  titulo: string;
  /** status enviado ao servidor: "" (todos), "aberta", "paga" ou "atrasada" */
  status: string;
  categoria_id?: string;
  contraparte?: string;
  de?: string;
  ate?: string;
}

/**
 * Detalhamento de um card de KPI das telas de contas a pagar/receber:
 * abre a relação completa das contas que compõem aquele número.
 */
export function ContasKpiDialog({
  tipo,
  filtro,
  onOpenChange,
  onAbrirConta,
}: {
  tipo: ContaTipo;
  filtro: KpiDetalheFiltro | null;
  onOpenChange: (aberto: boolean) => void;
  onAbrirConta?: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    enabled: !!filtro,
    queryKey: ["fin-contas-kpi-detalhe", tipo, filtro],
    queryFn: () =>
      listarContas({
        data: {
          tipo,
          status: filtro?.status || undefined,
          categoria_id: filtro?.categoria_id || undefined,
          contraparte: filtro?.contraparte || undefined,
          de: filtro?.de || undefined,
          ate: filtro?.ate || undefined,
          pagina: 1,
          porPagina: 100,
        },
      }),
  });

  const itens = data?.itens ?? [];
  const total = itens.reduce((a, c) => a + Number(c.valor ?? 0), 0);

  return (
    <Dialog open={!!filtro} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base">{filtro?.titulo}</DialogTitle>
          <DialogDescription>
            {itens.length} {itens.length === 1 ? "conta" : "contas"} · total {formatBRL(total)}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-auto px-2 pb-4 sm:px-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </div>
          ) : itens.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma conta neste grupo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {tipo === "pagar" ? "Fornecedor" : "Pagador"}
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => onAbrirConta?.(c.id)}
                  >
                    <TableCell className="font-medium text-primary">{c.numero}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{c.descricao}</TableCell>
                    <TableCell className="hidden sm:table-cell">{c.contraparte ?? "—"}</TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">
                      {formatData(c.vencimento)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatBRL(c.valor)}
                    </TableCell>
                    <TableCell>
                      <ContaStatusBadge status={c.status_efetivo} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

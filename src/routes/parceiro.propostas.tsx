import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ParceiroPage, formatData, formatBRL } from "@/components/parceiro/parceiro-page";
import { listarMinhasPropostas } from "@/lib/parceiro/portal.functions";

export const Route = createFileRoute("/parceiro/propostas")({
  head: () => ({ meta: [{ title: "Propostas — Portal do Parceiro" }] }),
  component: MinhasPropostas,
});

function MinhasPropostas() {
  const q = useQuery({
    queryKey: ["parceiro-propostas"],
    queryFn: () => listarMinhasPropostas(),
  });

  return (
    <ParceiroPage
      titulo="Propostas"
      descricao="Acompanhe as propostas dos seus clientes."
    >
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Financiamento</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : (q.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhuma proposta encontrada.
                </TableCell>
              </TableRow>
            ) : (
              (q.data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium tabular-nums">
                    {p.numero_proposta ?? "—"}
                  </TableCell>
                  <TableCell>{p.cliente_nome ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {p.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(p.valor_financiamento)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatData(p.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </ParceiroPage>
  );
}

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
import { ParceiroPage, formatData } from "@/components/parceiro/parceiro-page";
import { listarMinhasSimulacoes } from "@/lib/parceiro/portal.functions";

export const Route = createFileRoute("/parceiro/simulacoes")({
  head: () => ({ meta: [{ title: "Simulações — Portal do Parceiro" }] }),
  component: MinhasSimulacoes,
});

function MinhasSimulacoes() {
  const q = useQuery({
    queryKey: ["parceiro-simulacoes"],
    queryFn: () => listarMinhasSimulacoes(),
  });

  return (
    <ParceiroPage titulo="Simulações" descricao="Simulações dos seus clientes vinculados.">
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : (q.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Nenhuma simulação encontrada.
                </TableCell>
              </TableRow>
            ) : (
              (q.data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium tabular-nums">
                    {s.numero_simulacao ?? "—"}
                  </TableCell>
                  <TableCell>{s.cliente_nome ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {s.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatData(s.created_at)}
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

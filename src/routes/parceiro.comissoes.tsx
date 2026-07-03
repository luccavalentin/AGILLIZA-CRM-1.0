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
import { listarMinhasComissoes } from "@/lib/parceiro/portal.functions";

export const Route = createFileRoute("/parceiro/comissoes")({
  head: () => ({ meta: [{ title: "Comissões — Portal do Parceiro" }] }),
  component: MinhasComissoes,
});

const STATUS_TONE: Record<string, "default" | "secondary" | "outline"> = {
  paga_parceiro: "default",
  encerrada: "default",
  a_receber: "secondary",
  recebida: "outline",
};

function MinhasComissoes() {
  const q = useQuery({
    queryKey: ["parceiro-comissoes"],
    queryFn: () => listarMinhasComissoes(),
  });

  const total = (q.data ?? []).reduce(
    (acc, c) => acc + Number(c.split_parceiro ?? 0),
    0,
  );

  return (
    <ParceiroPage
      titulo="Comissões"
      descricao="Sua parte (split) nas operações fechadas."
    >
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banco</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Valor bruto</TableHead>
              <TableHead className="text-right">Meu split</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : (q.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Você ainda não tem comissões registradas.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {(q.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.banco_nome ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.produto ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(c.valor_bruto)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatBRL(c.split_parceiro)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[c.status] ?? "secondary"} className="capitalize">
                        {c.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatData(c.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    Total do meu split
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatBRL(total)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </ParceiroPage>
  );
}

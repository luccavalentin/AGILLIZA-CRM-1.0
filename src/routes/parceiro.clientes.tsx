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
import { listarMeusClientes } from "@/lib/parceiro/portal.functions";

export const Route = createFileRoute("/parceiro/clientes")({
  head: () => ({ meta: [{ title: "Meus clientes — Portal do Parceiro" }] }),
  component: MeusClientes,
});

function MeusClientes() {
  const q = useQuery({
    queryKey: ["parceiro-clientes"],
    queryFn: () => listarMeusClientes(),
  });

  return (
    <ParceiroPage
      titulo="Meus clientes"
      descricao="Clientes que você trouxe e estão vinculados a você."
    >
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Cadastrado</TableHead>
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
                  Você ainda não tem clientes vinculados.
                </TableCell>
              </TableRow>
            ) : (
              (q.data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {c.numero_cliente ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ?? c.telefone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.ativo ? "default" : "secondary"}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatData(c.created_at)}
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

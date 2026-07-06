import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Paperclip } from "lucide-react";
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
import { listarDocumentosParceiro } from "@/lib/parceiro/portal.functions";

export const Route = createFileRoute("/parceiro/documentos")({
  head: () => ({ meta: [{ title: "Documentos — Portal do Parceiro" }] }),
  component: DocumentosParceiro,
});

function DocumentosParceiro() {
  const q = useQuery({
    queryKey: ["parceiro-documentos"],
    queryFn: () => listarDocumentosParceiro(),
  });

  return (
    <ParceiroPage
      titulo="Documentos"
      descricao="Documentos enviados para os seus clientes vinculados."
    >
      <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Paperclip className="mr-2 inline h-4 w-4 text-muted-foreground" />O envio de documentos é
        feito dentro da ficha de cada cliente. Aqui você acompanha o que já foi enviado e o status
        de aprovação.
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado</TableHead>
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
                  Nenhum documento enviado ainda.
                </TableCell>
              </TableRow>
            ) : (
              (q.data ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nome_arquivo}</TableCell>
                  <TableCell>{d.cliente_nome ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.categoria ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {d.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatData(d.created_at)}
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

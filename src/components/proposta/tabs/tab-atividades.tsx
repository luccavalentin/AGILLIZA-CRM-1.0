import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { statusProposta } from "@/components/propostas/status";

export function TabAtividades({ historico }: { historico: any[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evento</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {historico.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                Sem atividades.
              </TableCell>
            </TableRow>
          )}
          {historico.map((h) => (
            <TableRow key={h.id}>
              <TableCell className="font-medium">{h.tipo_evento}</TableCell>
              <TableCell className="text-muted-foreground">
                {h.descricao ?? (h.status_novo ? statusProposta(h.status_novo).label : "—")}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(h.created_at).toLocaleString("pt-BR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

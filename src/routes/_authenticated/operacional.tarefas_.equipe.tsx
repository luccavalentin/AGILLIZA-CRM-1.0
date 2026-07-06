import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarEquipeTarefas } from "@/lib/operacional/tarefas.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/operacional/tarefas_/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Tarefas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.tarefas"),
  component: Pagina,
});

function Pagina() {
  const { data, isLoading } = useQuery({
    queryKey: ["tarefas", "equipe"],
    queryFn: () => listarEquipeTarefas(),
  });

  const membros = data ?? [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Equipe — Tarefas</h1>
            <p className="text-sm text-muted-foreground">Carga de trabalho por responsável.</p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/operacional/tarefas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Lista
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : membros.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum membro na equipe.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Abertas</TableHead>
                <TableHead className="text-right">Em andamento</TableHead>
                <TableHead className="text-right">Concluídas</TableHead>
                <TableHead className="text-right">Total ativas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membros.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-foreground">{m.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.abertas}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.em_andamento}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {m.concluidas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {m.abertas + m.em_andamento}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

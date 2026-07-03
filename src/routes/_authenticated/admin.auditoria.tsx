import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarAuditoria } from "@/lib/admin/auditoria.functions";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.auditoria"),
  component: Pagina,
});

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function Pagina() {
  const q = useQuery({
    queryKey: ["admin-auditoria"],
    queryFn: () => listarAuditoria({ data: {} }),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <ShieldCheck className="size-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Auditoria</h1>
          <p className="text-sm text-muted-foreground">
            Registro de ações administrativas do seu ecossistema.
          </p>
        </div>
      </header>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Ator</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (q.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhum registro de auditoria ainda.
                </TableCell>
              </TableRow>
            ) : (
              (q.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {fmtData(r.created_at)}
                  </TableCell>
                  <TableCell>{r.ator_nome ?? "—"}</TableCell>
                  <TableCell className="font-medium text-foreground">{r.acao}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.entidade ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.ip ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

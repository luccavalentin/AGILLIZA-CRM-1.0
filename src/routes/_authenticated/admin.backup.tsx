import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DatabaseBackup, Play, RefreshCw, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarBackups, criarBackup } from "@/lib/admin/backup.functions";

export const Route = createFileRoute("/_authenticated/admin/backup")({
  head: () => ({ meta: [{ title: "Backup — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.backup"),
  component: Pagina,
});

const TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  processando: "outline",
  concluido: "default",
  erro: "destructive",
};

function formatBytes(n: number | null): string {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}

function Pagina() {
  const qc = useQueryClient();
  const backups = useQuery({ queryKey: ["admin-backups"], queryFn: () => listarBackups() });

  const criar = useMutation({
    mutationFn: () => criarBackup(),
    onSuccess: (r) => {
      if (r.status === "concluido") toast.success("Backup gerado.");
      else toast.error("Backup finalizou com erro.");
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar backup."),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Backup</h1>
            <p className="text-sm text-muted-foreground">
              Snapshots lógicos com contagem de registros por tabela.
            </p>
          </div>
        </div>
        <Button disabled={criar.isPending} onClick={() => criar.mutate()}>
          <Play className="mr-2 h-4 w-4" />
          {criar.isPending ? "Gerando…" : "Gerar backup"}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold">Histórico</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin-backups"] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>

        {backups.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (backups.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <HardDrive className="h-8 w-8" />
            <p className="text-sm">Nenhum backup gerado ainda.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Tabelas</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Concluído em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.data!.map((b) => {
                const totalRegistros = b.manifesto
                  ? Object.values(b.manifesto).reduce((a, n) => a + (n ?? 0), 0)
                  : 0;
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Badge variant={TONE[b.status] ?? "secondary"}>{b.status}</Badge>
                      {b.status === "erro" && b.erro ? (
                        <p className="mt-1 text-xs text-destructive">{b.erro}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.manifesto
                        ? `${Object.keys(b.manifesto).length} tabelas · ${totalRegistros} registros`
                        : "—"}
                    </TableCell>
                    <TableCell>{formatBytes(b.tamanho_bytes)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.concluido_em ? new Date(b.concluido_em).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

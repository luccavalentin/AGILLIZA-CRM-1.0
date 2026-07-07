import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DatabaseBackup,
  Play,
  RefreshCw,
  HardDrive,
  FileSpreadsheet,
  FolderArchive,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarBackups,
  criarBackup,
  excluirBackup,
  exportarBackupCompleto,
} from "@/lib/admin/backup.functions";
import { exportarBackupXLSX } from "@/lib/admin/backup-xlsx";
import { montarInventarioDocumentos } from "@/lib/admin/backup-documentos.functions";
import { baixarDocumentosZip, type ProgressoBackup } from "@/lib/admin/backup-documentos-zip";


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
  const [baixando, setBaixando] = useState(false);
  const [baixandoDocs, setBaixandoDocs] = useState(false);
  const [progresso, setProgresso] = useState<ProgressoBackup | null>(null);

  const criar = useMutation({
    mutationFn: () => criarBackup(),
    onSuccess: (r) => {
      if (r.status === "concluido") toast.success("Backup gerado.");
      else toast.error("Backup finalizou com erro.");
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar backup."),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirBackup({ data: { id } }),
    onSuccess: () => {
      toast.success("Backup excluído.");
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir."),
  });

  async function baixarExcel() {
    setBaixando(true);
    try {
      const dados = await exportarBackupCompleto();
      exportarBackupXLSX(dados);
      toast.success("Backup completo exportado em Excel.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar backup.");
    } finally {
      setBaixando(false);
    }
  }

  async function baixarDocumentos() {
    setBaixandoDocs(true);
    setProgresso({ total: 0, baixados: 0, falhas: 0 });
    try {
      const { itens, falhas: falhasLink } = await montarInventarioDocumentos();
      if (itens.length === 0) {
        toast.info("Nenhum documento encontrado para backup.");
        return;
      }
      setProgresso({ total: itens.length, baixados: 0, falhas: 0 });
      const { falhas } = await baixarDocumentosZip(itens, setProgresso);
      const totalFalhas = falhas + falhasLink;
      if (totalFalhas > 0) {
        toast.warning(
          `Backup de documentos gerado com ${totalFalhas} arquivo(s) não incluído(s).`,
        );
      } else {
        toast.success("Backup de documentos gerado (ZIP).");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar backup de documentos.");
    } finally {
      setBaixandoDocs(false);
      setProgresso(null);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Backup</h1>
            <p className="text-sm text-muted-foreground">
              Baixe todos os dados do sistema em Excel ou registre snapshots lógicos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={baixando} onClick={baixarExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {baixando ? "Gerando Excel…" : "Baixar backup completo (Excel)"}
          </Button>
          <Button variant="outline" disabled={criar.isPending} onClick={() => criar.mutate()}>
            <Play className="mr-2 h-4 w-4" />
            {criar.isPending ? "Gerando…" : "Gerar snapshot"}
          </Button>
        </div>
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
                <TableHead className="w-12"></TableHead>
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
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir backup?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Este registro de backup será removido do histórico. Esta ação não
                              pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => excluir.mutate(b.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

import { AdminHero } from "@/components/admin/admin-hero";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DatabaseBackup,
  Database,
  RefreshCw,
  HardDrive,
  FileSpreadsheet,
  FolderArchive,
  Trash2,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarBackups,
  excluirBackup,
  exportarBackupCompleto,
  obterConfigBackup,
  salvarConfigBackup,
} from "@/lib/admin/backup.functions";
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
  const config = useQuery({ queryKey: ["admin-backup-config"], queryFn: () => obterConfigBackup() });
  const [baixando, setBaixando] = useState(false);
  const [baixandoSql, setBaixandoSql] = useState(false);
  const [baixandoDocs, setBaixandoDocs] = useState(false);
  const [progresso, setProgresso] = useState<ProgressoBackup | null>(null);
  const [configAberta, setConfigAberta] = useState(false);
  const [diasInput, setDiasInput] = useState<number>(2);

  const retencaoDias = config.data?.retencaoDias ?? 2;
  const podeConfigurar = config.data?.podeConfigurar ?? false;

  useEffect(() => {
    if (config.data) setDiasInput(config.data.retencaoDias);
  }, [config.data]);

  const salvarConfig = useMutation({
    mutationFn: (dias: number) => salvarConfigBackup({ data: { retencaoDias: dias } }),
    onSuccess: () => {
      toast.success("Configuração de retenção salva.");
      setConfigAberta(false);
      qc.invalidateQueries({ queryKey: ["admin-backup-config"] });
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar configuração."),
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
      const [{ exportarBackupXLSX }, { humanizarBackup }] = await Promise.all([
        import("@/lib/admin/backup-xlsx"),
        import("@/lib/admin/backup-labels"),
      ]);
      // Humaniza: esconde códigos/IDs e traduz colunas e valores para leigos.
      exportarBackupXLSX(humanizarBackup(dados));
      toast.success("Backup completo exportado em Excel.");
      qc.invalidateQueries({ queryKey: ["admin-backups"] });

    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar backup.");
    } finally {
      setBaixando(false);
    }
  }

  async function baixarSQL() {
    setBaixandoSql(true);
    try {
      const dados = await exportarBackupCompleto();
      const { exportarBackupSQL } = await import("@/lib/admin/backup-sql");
      // SQL preserva códigos/IDs reais para restauração do banco de dados.
      exportarBackupSQL(dados);
      toast.success("Backup completo exportado em SQL.");
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar backup SQL.");
    } finally {
      setBaixandoSql(false);
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
      <AdminHero
        icon={<DatabaseBackup className="h-5 w-5" />}
        titulo="Backup"
        descricao="Baixe todo o sistema em uma planilha Excel simples e legível (sem códigos técnicos) ou em arquivo SQL para restauração do banco de dados. Também é possível baixar todos os documentos em ZIP."
        acoes={
          <>
          <Button disabled={baixando} onClick={baixarExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {baixando ? "Gerando Excel…" : "Baixar em Excel (planilha)"}
          </Button>
          <Button variant="secondary" disabled={baixandoSql} onClick={baixarSQL}>
            <Database className="mr-2 h-4 w-4" />
            {baixandoSql ? "Gerando SQL…" : "Baixar em SQL (banco de dados)"}
          </Button>
          <Button variant="secondary" disabled={baixandoDocs} onClick={baixarDocumentos}>
            <FolderArchive className="mr-2 h-4 w-4" />
            {baixandoDocs ? "Gerando ZIP…" : "Baixar documentos (ZIP)"}
          </Button>
          {podeConfigurar ? (
            <Button
              variant="outline"
              size="icon"
              aria-label="Configurar retenção de backup"
              title="Configurar retenção"
              onClick={() => setConfigAberta(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          ) : null}
          </>
        }
      />


      {baixandoDocs && progresso ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {progresso.total === 0
                ? "Preparando documentos…"
                : `Compactando documentos (${progresso.baixados}/${progresso.total})`}
            </span>
            {progresso.falhas > 0 ? (
              <span className="text-xs text-destructive">{progresso.falhas} falha(s)</span>
            ) : null}
          </div>
          <Progress
            value={progresso.total > 0 ? (progresso.baixados / progresso.total) * 100 : 5}
          />
        </div>
      ) : null}



      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Histórico</h2>
            <p className="text-xs text-muted-foreground">
              Os registros são mantidos por {retencaoDias} dia{retencaoDias === 1 ? "" : "s"} após
              gerados e removidos automaticamente.
            </p>
          </div>
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
          <div className="overflow-x-auto">
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
                      {b.concluido_em ? new Date(b.concluido_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
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
          </div>
        )}
      </div>

      <Dialog open={configAberta} onOpenChange={setConfigAberta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar retenção de backup</DialogTitle>
            <DialogDescription>
              Defina por quantos dias os registros de backup ficam armazenados no sistema antes de
              serem removidos automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="retencao-dias">Dias de retenção</Label>
            <Input
              id="retencao-dias"
              type="number"
              min={1}
              max={365}
              value={diasInput}
              onChange={(e) => setDiasInput(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Entre 1 e 365 dias. Padrão do sistema: 2 dias.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigAberta(false)}>
              Cancelar
            </Button>
            <Button
              disabled={salvarConfig.isPending || !diasInput || diasInput < 1}
              onClick={() => salvarConfig.mutate(Math.round(diasInput))}
            >
              {salvarConfig.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}

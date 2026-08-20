import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScanLine, UploadCloud, FileText, RefreshCw, ChevronRight, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { assertModuloPermitido } from "@/lib/route-guards";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { TIPOS_DOCUMENTO, TIPO_DOCUMENTO_LABEL, rotuloTipo } from "@/lib/crm/scan-ia-tipos";
import {
  contextoScanIa,
  listarLeituras,
  criarLeitura,
  processarLeitura,
  excluirLeitura,
} from "@/lib/crm/scan-ia.functions";

export const Route = createFileRoute("/_authenticated/crm/scan-ia")({
  head: () => ({ meta: [{ title: "Scan IA — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
});

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  processando: "outline",
  concluida: "default",
  revisada: "default",
  aplicada: "default",
  erro: "destructive",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_TONE[status] ?? "secondary"}>{status}</Badge>;
}

function Pagina() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState("");
  const [dragging, setDragging] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const leituras = useQuery({ queryKey: ["scan-ia-leituras"], queryFn: () => listarLeituras() });

  const processar = useMutation({
    mutationFn: (id: string) => processarLeitura({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success("Documento processado.");
      else toast.error(r.erro ?? "Falha ao processar.");
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao processar."),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirLeitura({ data: { id } }),
    onSuccess: () => {
      toast.success("Leitura excluída (registrada em auditoria).");
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir."),
  });

  async function enviarArquivo(file: File) {
    if (!file) return;
    setEnviando(true);
    try {
      const { correspondenteId } = await contextoScanIa();
      if (!correspondenteId) throw new Error("Sem correspondente.");
      const safe = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${correspondenteId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("scan-ia").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { id } = await criarLeitura({
        data: { arquivo_url: path, tipo_documento: tipo.trim() || null },
      });
      toast.success("Arquivo enviado. Processando com IA…");
      setTipo("");
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
      processar.mutate(id);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no envio.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:flex sm:justify-between">
        <ScanLine className="h-6 w-6 shrink-0 text-primary" />
        <div className="min-w-0 sm:flex-1">
          <h1 className="truncate text-xl font-semibold">Scan IA</h1>
          <p className="text-sm text-muted-foreground">
            Leitura automática de documentos com extração de campos por IA.
          </p>
        </div>
        <Button asChild variant="outline" className="col-span-2 w-full sm:w-auto">
          <Link to="/crm/consultor-ia">
            <Bot className="mr-2 h-4 w-4" />
            Consultor IA
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-2 sm:max-w-sm">
          <Label htmlFor="tipo-doc">Tipo de documento (opcional)</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger id="tipo-doc">
              <SelectValue placeholder="Deixe em branco para a IA detectar" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DOCUMENTO.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_DOCUMENTO_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            A IA classifica o documento sozinha; o tipo final é sempre confirmado por você na tela
            de revisão.
          </p>
        </div>

        <button
          type="button"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) enviarArquivo(f);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors ${
            dragging ? "border-primary bg-accent" : "border-border hover:border-primary"
          } ${enviando ? "opacity-60" : ""}`}
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">
            {enviando ? "Enviando…" : "Arraste um arquivo ou clique para selecionar"}
          </span>
          <span className="text-xs text-muted-foreground">PDF, JPG ou PNG</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviarArquivo(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold">Leituras recentes</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>

        {leituras.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (leituras.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <FileText className="h-8 w-8" />
            <p className="text-sm">Nenhuma leitura ainda. Envie um documento para começar.</p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="divide-y md:hidden">
              {leituras.data!.map((l) => (
                <li key={l.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {rotuloTipo(l.tipo_documento ?? l.tipo_documento_sugerido)}
                        {!l.tipo_confirmado ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (sugerido pela IA)
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.cliente_nome ?? "Sem cliente vinculado"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                  {l.status === "erro" && l.erro ? (
                    <p className="text-xs text-destructive">{l.erro}</p>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{l.criador_nome ?? "—"}</span>
                    <span className="shrink-0">{l.total_campos} campos</span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    {(l.status === "erro" || l.status === "pendente") && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={processar.isPending}
                        onClick={() => processar.mutate(l.id)}
                      >
                        Reprocessar
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/crm/scan-ia/$id" params={{ id: l.id }}>
                        Revisar <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                    <ConfirmDelete
                      titulo="Excluir leitura"
                      descricao="A leitura e seus campos serão removidos. A exclusão fica registrada nos logs de auditoria."
                      onConfirm={() => excluir.mutateAsync(l.id).then(() => undefined)}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {/* md+: table */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Campos</TableHead>
                    <TableHead>Enviado por</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leituras.data!.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        {rotuloTipo(l.tipo_documento ?? l.tipo_documento_sugerido)}
                        {!l.tipo_confirmado ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (sugerido)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.cliente_nome ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={l.status} />
                        {l.status === "erro" && l.erro ? (
                          <p className="mt-1 text-xs text-destructive">{l.erro}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-center">{l.total_campos}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.criador_nome ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(l.status === "erro" || l.status === "pendente") && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={processar.isPending}
                              onClick={() => processar.mutate(l.id)}
                            >
                              Reprocessar
                            </Button>
                          )}
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/crm/scan-ia/$id" params={{ id: l.id }}>
                              Revisar <ChevronRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                          <ConfirmDelete
                            titulo="Excluir leitura"
                            descricao="A leitura e seus campos serão removidos. A exclusão fica registrada nos logs de auditoria."
                            onConfirm={() => excluir.mutateAsync(l.id).then(() => undefined)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ScanLine,
  UploadCloud,
  FileText,
  RefreshCw,
  ChevronRight,
  Bot,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Layers,
  ShieldCheck,
} from "lucide-react";
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
import {
  TIPOS_DOCUMENTO,
  TIPO_DOCUMENTO_LABEL,
  rotuloStatusLeitura,
  rotuloTipo,
} from "@/lib/crm/scan-ia-tipos";
import { usePermissao } from "@/hooks/use-permissao";
import {
  criarLoteScan,
  listarLeituras,
  criarLeitura,
  processarLeitura,
  excluirLeitura,
} from "@/lib/crm/scan-ia.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { problemaNoDocumento } from "@/lib/storage/tipos-documento";

export const Route = createFileRoute("/_authenticated/crm/scan-ia")({
  head: () => ({ meta: [{ title: "Scan IA — Agilliza" }] }),
  // Módulo próprio (crm.scan_ia); quem já usava pela permissão de Clientes continua entrando.
  beforeLoad: () => assertModuloPermitido("crm.scan_ia", ["crm.clientes"]),
  component: Pagina,
});

/** Documentos por envio (um cliente raramente tem mais que isso; protege a cota da IA). */
const MAX_ARQUIVOS_LOTE = 12;

type ItemFila = {
  chave: string;
  nome: string;
  situacao: "enviando" | "lendo" | "pronto" | "erro";
  erro?: string;
  leituraId?: string;
};

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  processando: "outline",
  concluida: "default",
  revisada: "default",
  aplicada: "default",
  erro: "destructive",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_TONE[status] ?? "secondary"}>{rotuloStatusLeitura(status)}</Badge>;
}

function Pagina() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState("");
  const [dragging, setDragging] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [loteAtual, setLoteAtual] = useState<string | null>(null);

  // Enviar, reprocessar e excluir: "Processar" no Scan IA (ou criar/editar clientes), como no servidor.
  const podeProcessarScan = usePermissao("crm.scan_ia", "create");
  const podeCriarCliente = usePermissao("crm.clientes", "create");
  const podeEditarCliente = usePermissao("crm.clientes", "edit");
  const podeProcessar = podeProcessarScan || podeCriarCliente || podeEditarCliente;
  const podeVerClientes = usePermissao("crm.clientes", "view");

  const leituras = useQuery({ queryKey: ["scan-ia-leituras"], queryFn: () => listarLeituras() });

  const processar = useMutation({
    mutationFn: (id: string) => processarLeitura({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success("Documento processado.");
      else toast.error(r.erro ?? "Falha ao processar.");
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, "Falha ao processar.")),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirLeitura({ data: { id } }),
    onSuccess: () => {
      toast.success("Leitura excluída.");
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, "Falha ao excluir.")),
  });

  /**
   * Vários documentos de uma vez (RG, renda, residência, certidão, matrícula…): abre um
   * lote, envia cada arquivo, a IA lê dois por vez e, no fim, a conferência junta tudo
   * num cadastro só (criar cliente ou completar um existente).
   */
  async function enviarArquivos(lista: File[]) {
    const arquivos = lista.slice(0, MAX_ARQUIVOS_LOTE);
    if (!arquivos.length) return;
    if (lista.length > MAX_ARQUIVOS_LOTE) {
      toast.warning(
        `Até ${MAX_ARQUIVOS_LOTE} documentos por vez. Os primeiros ${MAX_ARQUIVOS_LOTE} foram enviados.`,
      );
    }
    // Mesma regra do Storage: só PDF, JPG ou PNG de até 10 MB (antes aceitava .exe).
    const validos: File[] = [];
    for (const f of arquivos) {
      const recusa = problemaNoDocumento(f);
      if (recusa) toast.error(`${recusa} Envie PDF, JPG ou PNG de até 10 MB.`);
      else validos.push(f);
    }
    if (!validos.length) return;
    setEnviando(true);
    const itens: ItemFila[] = validos.map((f) => ({
      chave: crypto.randomUUID(),
      nome: f.name,
      situacao: "enviando",
    }));
    setFila(itens);
    const atualizar = (chave: string, p: Partial<ItemFila>) =>
      setFila((atual) => atual.map((i) => (i.chave === chave ? { ...i, ...p } : i)));
    try {
      const { id: loteId, correspondenteId } = await criarLoteScan();
      setLoteAtual(loteId);
      const enviados: Array<{ chave: string; leituraId: string }> = [];
      for (let k = 0; k < validos.length; k++) {
        const file = validos[k]!;
        const item = itens[k]!;
        try {
          const safe = file.name.replace(/[^\w.\-]/g, "_").slice(-80);
          const path = `${correspondenteId}/${crypto.randomUUID()}-${safe}`;
          const { error: upErr } = await supabase.storage.from("scan-ia").upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
          if (upErr) throw upErr;
          const { id } = await criarLeitura({
            data: { arquivo_url: path, tipo_documento: tipo.trim() || null, lote_id: loteId },
          });
          enviados.push({ chave: item.chave, leituraId: id });
          atualizar(item.chave, { situacao: "lendo", leituraId: id });
        } catch (e) {
          atualizar(item.chave, { situacao: "erro", erro: mensagemDeErro(e, "Falha no envio.") });
        }
      }
      setTipo("");
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
      // A IA lê dois por vez: rápido sem estourar o limite por minuto do provedor.
      let proximo = 0;
      const trabalhador = async () => {
        while (proximo < enviados.length) {
          const atual = enviados[proximo++]!;
          try {
            const r = await processarLeitura({ data: { id: atual.leituraId } });
            atualizar(
              atual.chave,
              r.ok
                ? { situacao: "pronto" }
                : { situacao: "erro", erro: r.erro ?? "Falha na leitura." },
            );
          } catch (e) {
            atualizar(atual.chave, {
              situacao: "erro",
              erro: mensagemDeErro(e, "Falha na leitura."),
            });
          }
        }
      };
      await Promise.all([trabalhador(), trabalhador()]);
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
      toast.success("Leitura concluída. Confira os dados e crie ou complete o cadastro.");
    } catch (e: any) {
      toast.error(mensagemDeErro(e, "Falha no envio."));
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
            Envie os documentos do cliente: a IA lê, o sistema confere (CPF, datas, UF, órgão
            emissor) e você cria ou completa o cadastro.
          </p>
        </div>
        {/* O Consultor IA exige "Ver" em Clientes; sem ela o link só voltava ao início. */}
        {podeVerClientes && (
          <Button asChild variant="outline" className="col-span-2 w-full sm:w-auto">
            <Link to="/crm/consultor-ia">
              <Bot className="mr-2 h-4 w-4" />
              Consultor IA
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>

      {podeProcessar && (
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
              Em branco, a IA identifica o tipo. Você confirma o tipo na revisão.
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
              const fs = Array.from(e.dataTransfer.files ?? []);
              if (fs.length) void enviarArquivos(fs);
            }}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors ${
              dragging ? "border-primary bg-accent" : "border-border hover:border-primary"
            } ${enviando ? "opacity-60" : ""}`}
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15">
              <UploadCloud className="h-6 w-6" />
            </span>
            <span className="text-sm font-semibold">
              {enviando
                ? "Enviando e lendo…"
                : "Arraste os documentos do cliente ou clique para selecionar"}
            </span>
            <span className="max-w-md text-xs text-muted-foreground">
              RG/CNH, CPF, comprovante de renda e de residência, certidão de casamento, matrícula…
              vários de uma vez (até {MAX_ARQUIVOS_LOTE}). PDF, JPG ou PNG de até 10 MB cada.
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length) void enviarArquivos(fs);
              e.target.value = "";
            }}
          />

          {fila.length > 0 && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Layers className="h-4 w-4 text-primary" />
                  {fila.length} documento(s) deste envio
                </p>
                <span className="text-xs text-muted-foreground">
                  {fila.filter((i) => i.situacao === "pronto").length} lido(s) ·{" "}
                  {fila.filter((i) => i.situacao === "erro").length} com erro
                </span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {fila.map((i) => (
                  <li
                    key={i.chave}
                    className="flex min-w-0 items-start gap-2 rounded-lg border border-border bg-card p-2.5"
                  >
                    {i.situacao === "pronto" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : i.situacao === "erro" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    ) : (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{i.nome}</p>
                      <p
                        className={
                          i.situacao === "erro"
                            ? "text-xs text-destructive"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {i.situacao === "enviando"
                          ? "Enviando…"
                          : i.situacao === "lendo"
                            ? "A IA está lendo…"
                            : i.situacao === "pronto"
                              ? "Lido e validado"
                              : i.erro}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {loteAtual && !enviando && fila.some((i) => i.situacao === "pronto") && (
                <Button asChild className="w-full sm:w-auto">
                  <Link to="/crm/scan-ia/lote/$id" params={{ id: loteAtual }}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Conferir e cadastrar o cliente
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

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
        ) : leituras.isError ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-destructive">
              {mensagemDeErro(leituras.error, "Não foi possível carregar as leituras.")}
            </p>
            <Button size="sm" variant="outline" onClick={() => leituras.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (leituras.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <FileText className="h-8 w-8" />
            <p className="text-sm">Nenhuma leitura ainda.</p>
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
                        {/* Sem tipo nenhum aparecia "— (sugerido)". */}
                        {!l.tipo_confirmado && (l.tipo_documento ?? l.tipo_documento_sugerido) ? (
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
                    {podeProcessar && (l.status === "erro" || l.status === "pendente") && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={processar.isPending}
                        onClick={() => processar.mutate(l.id)}
                      >
                        Reprocessar
                      </Button>
                    )}
                    {l.lote_id && (
                      <Button asChild variant="outline" size="sm">
                        <Link to="/crm/scan-ia/lote/$id" params={{ id: l.lote_id }}>
                          <Layers className="mr-1 h-4 w-4" /> Lote
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/crm/scan-ia/$id" params={{ id: l.id }}>
                        Revisar <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                    {podeProcessar && (
                      <ConfirmDelete
                        titulo="Excluir leitura"
                        descricao="A leitura, os campos e o arquivo enviado serão apagados. A cópia já arquivada nos documentos do cliente continua lá."
                        onConfirm={() => excluir.mutateAsync(l.id).then(() => undefined)}
                      />
                    )}
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
                        {/* Sem tipo nenhum aparecia "— (sugerido)". */}
                        {!l.tipo_confirmado && (l.tipo_documento ?? l.tipo_documento_sugerido) ? (
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
                          {podeProcessar && (l.status === "erro" || l.status === "pendente") && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={processar.isPending}
                              onClick={() => processar.mutate(l.id)}
                            >
                              Reprocessar
                            </Button>
                          )}
                          {l.lote_id && (
                            <Button asChild variant="outline" size="sm">
                              <Link to="/crm/scan-ia/lote/$id" params={{ id: l.lote_id }}>
                                <Layers className="mr-1 h-4 w-4" /> Lote
                              </Link>
                            </Button>
                          )}
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/crm/scan-ia/$id" params={{ id: l.id }}>
                              Revisar <ChevronRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                          {podeProcessar && (
                            <ConfirmDelete
                              titulo="Excluir leitura"
                              descricao="A leitura, os campos e o arquivo enviado serão apagados. A cópia já arquivada nos documentos do cliente continua lá."
                              onConfirm={() => excluir.mutateAsync(l.id).then(() => undefined)}
                            />
                          )}
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

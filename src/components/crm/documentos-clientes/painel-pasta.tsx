import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  Eye,
  FileImage,
  FileText,
  FolderInput,
  GripVertical,
  Loader2,
  MoreVertical,
  Search,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { urlDocumento } from "@/lib/crm/clientes.functions";
import {
  anexarDocumentoNaPasta,
  moverDocumentoDePasta,
  type DocumentoDoCliente,
} from "@/lib/crm/documentos-clientes.functions";
import {
  MAX_ARQUIVOS_LOTE,
  PASTAS,
  PASTAS_DESTINO,
  contemTermo,
  ehPastaDestino,
  validarLote,
  type PastaDestino,
  type PastaPadrao,
} from "@/lib/crm/documentos-clientes/pastas";
import { nomeArquivoSeguro } from "@/lib/storage/nome-arquivo";
import { EXTENSOES_DOCUMENTO } from "@/lib/storage/tipos-documento";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import { IconePasta } from "./icone-pasta";
import { tipoDePrevia } from "./previa-dialog";

/** Tipo arrastado entre a lista de arquivos e as pastas da árvore. */
export const TIPO_ARRASTO = "application/x-agilliza-documento";

const STATUS_ROTULO: Record<string, { rotulo: string; classe: string }> = {
  recebido: { rotulo: "Recebido", classe: "bg-primary/10 text-primary" },
  aprovado: { rotulo: "Aprovado", classe: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  pendente: { rotulo: "Correção", classe: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  reprovado: { rotulo: "Reprovado", classe: "bg-destructive/10 text-destructive" },
  expirado: { rotulo: "Expirado", classe: "bg-destructive/10 text-destructive" },
};

export function tamanhoLegivel(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Arquivos de uma pasta do cliente: envio em lote por arrastar, prévia, baixar e mover. */
export function PainelPasta({
  clienteId,
  pasta,
  docs,
  carregando,
  erro,
  podeEditar,
  onPrevia,
  onTentarDeNovo,
}: {
  clienteId: string;
  pasta: PastaPadrao;
  docs: DocumentoDoCliente[];
  carregando: boolean;
  erro: string | null;
  podeEditar: boolean;
  onPrevia: (d: DocumentoDoCliente) => void;
  onTentarDeNovo: () => void;
}) {
  const qc = useQueryClient();
  const anexar = useServerFn(anexarDocumentoNaPasta);
  const gerarUrl = useServerFn(urlDocumento);
  const mover = useMoverDocumento(clienteId);
  const entrada = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const info = PASTAS[pasta];
  const recebeEnvio = podeEditar && ehPastaDestino(pasta);

  const daPasta = useMemo(
    () =>
      docs.filter(
        (d) =>
          d.pasta === pasta &&
          (contemTermo(d.nome_arquivo, busca) || contemTermo(d.tipo_documento, busca)),
      ),
    [docs, pasta, busca],
  );

  async function enviar(arquivos: File[]) {
    if (!recebeEnvio || arquivos.length === 0 || progresso) return;
    const destino = pasta as PastaDestino;
    const { aceitos, recusados } = validarLote(arquivos);
    if (recusados.length) {
      toast.error(
        recusados.length === 1
          ? `${recusados[0].motivo} Envie PDF, JPG ou PNG de até 10 MB.`
          : `${recusados.length} arquivo(s) recusado(s). Envie PDF, JPG ou PNG de até 10 MB, no máximo ${MAX_ARQUIVOS_LOTE} por vez.`,
      );
    }
    if (aceitos.length === 0) return;
    setProgresso({ feitos: 0, total: aceitos.length });
    let ok = 0;
    let falhas = 0;
    for (const arquivo of aceitos) {
      const caminho = `${clienteId}/${crypto.randomUUID()}-${nomeArquivoSeguro(arquivo.name)}`;
      try {
        const { error } = await supabase.storage.from("cliente-documentos").upload(caminho, arquivo);
        if (error) throw error;
        try {
          await anexar({
            data: {
              cliente_id: clienteId,
              pasta: destino,
              nome_arquivo: arquivo.name,
              storage_path: caminho,
              mime_type: arquivo.type || null,
              tamanho_bytes: arquivo.size,
            },
          });
        } catch (e) {
          // Registro recusado: o arquivo não fica órfão no storage.
          await supabase.storage.from("cliente-documentos").remove([caminho]).catch(() => {});
          throw e;
        }
        ok++;
      } catch (e) {
        falhas++;
        console.warn("[documentos-clientes] envio", mensagemDeErro(e, ""));
      }
      setProgresso((p) => (p ? { ...p, feitos: p.feitos + 1 } : p));
    }
    setProgresso(null);
    qc.invalidateQueries({ queryKey: ["docs-cliente-pastas", clienteId] });
    qc.invalidateQueries({ queryKey: ["docs-clientes-arvore"] });
    qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
    if (falhas) toast.warning(`${ok} enviado(s), ${falhas} com falha.`);
    else toast.success(`${ok} arquivo(s) em ${info.rotulo}.`);
  }

  async function baixar(d: DocumentoDoCliente) {
    try {
      const { url } = await gerarUrl({ data: { storage_path: d.storage_path } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível baixar o arquivo."));
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <IconePasta pasta={pasta} ativa className="size-10" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{info.rotulo}</h2>
            <p className="truncate text-xs text-muted-foreground">{info.descricao}</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nesta pasta"
            aria-label="Buscar arquivo nesta pasta"
            className="h-11 pl-9 text-base sm:h-9 sm:text-sm"
          />
        </div>
      </div>

      {recebeEnvio && (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Enviar arquivos para ${info.rotulo}`}
          onClick={() => entrada.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              entrada.current?.click();
            }
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setArrastando(false);
            void enviar(Array.from(e.dataTransfer.files));
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
            arrastando
              ? "border-primary bg-primary/8"
              : "border-primary/25 bg-primary/[0.03] hover:border-primary/50 hover:bg-primary/5",
          )}
        >
          {progresso ? (
            <>
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">
                Enviando {progresso.feitos} de {progresso.total}…
              </p>
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(progresso.feitos / progresso.total) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <UploadCloud className="size-6 text-primary" strokeWidth={1.75} />
              <p className="text-sm font-medium text-foreground">
                Arraste arquivos aqui <span className="text-muted-foreground">ou toque para escolher</span>
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, JPG ou PNG até 10 MB · até {MAX_ARQUIVOS_LOTE} por vez
              </p>
            </>
          )}
          <input
            ref={entrada}
            type="file"
            multiple
            accept={EXTENSOES_DOCUMENTO}
            className="hidden"
            onChange={(e) => {
              const lista = Array.from(e.target.files ?? []);
              e.target.value = "";
              void enviar(lista);
            }}
          />
        </div>
      )}

      {carregando ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : erro ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {erro}
          <Button size="sm" variant="outline" onClick={onTentarDeNovo}>
            Tentar de novo
          </Button>
        </div>
      ) : daPasta.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-10 text-center">
          <IconePasta pasta={pasta} className="size-12 rounded-2xl" />
          <p className="text-sm font-medium text-foreground">
            {busca ? "Nenhum arquivo encontrado nesta pasta." : "Pasta vazia."}
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {busca
              ? "Tente outro nome ou limpe a busca."
              : recebeEnvio
                ? "Arraste os arquivos para cá ou mova arquivos de outra pasta."
                : "Os arquivos deste cliente aparecem aqui quando forem enviados."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
          {daPasta.map((d) => {
            const status = STATUS_ROTULO[d.status] ?? { rotulo: d.status, classe: "bg-muted text-muted-foreground" };
            const ehImagem = tipoDePrevia(d) === "imagem";
            return (
              <li
                key={d.id}
                draggable={podeEditar}
                onDragStart={(e) => {
                  e.dataTransfer.setData(TIPO_ARRASTO, d.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="group flex min-w-0 items-center gap-3 px-3 py-3 transition-colors hover:bg-primary/[0.03] sm:px-4"
              >
                {podeEditar && (
                  <GripVertical
                    aria-hidden
                    className="hidden size-4 shrink-0 cursor-grab text-muted-foreground/50 md:block"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onPrevia(d)}
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary ring-1 ring-inset ring-primary/15"
                  aria-label={`Ver ${d.nome_arquivo}`}
                >
                  {ehImagem ? (
                    <FileImage className="size-5" strokeWidth={1.75} />
                  ) : (
                    <FileText className="size-5" strokeWidth={1.75} />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onPrevia(d)}
                    className="block max-w-full truncate text-left text-sm font-medium text-foreground hover:text-primary"
                  >
                    {d.nome_arquivo}
                  </button>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.tipo_documento}
                    {" · "}
                    {formatData(d.created_at)}
                    {tamanhoLegivel(d.tamanho_bytes) ? ` · ${tamanhoLegivel(d.tamanho_bytes)}` : ""}
                    {d.enviado_por_nome ? ` · ${d.enviado_por_nome}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex",
                    status.classe,
                  )}
                >
                  {status.rotulo}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 sm:size-9"
                      aria-label={`Ações de ${d.nome_arquivo}`}
                      disabled={mover.isPending}
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuItem onSelect={() => onPrevia(d)}>
                      <Eye className="mr-2 size-4" /> Ver prévia
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void baixar(d)}>
                      <Download className="mr-2 size-4" /> Baixar
                    </DropdownMenuItem>
                    {podeEditar && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <FolderInput className="size-3.5" /> Mover para
                        </DropdownMenuLabel>
                        {PASTAS_DESTINO.filter((p) => p !== d.pasta).map((p) => (
                          <DropdownMenuItem
                            key={p}
                            onSelect={() => mover.mutate({ documento: d, pasta: p })}
                          >
                            <IconePasta pasta={p} className="mr-2 size-6 rounded-md" />
                            {PASTAS[p].rotulo}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Mover arquivo de pasta, com atualização otimista da lista do cliente. */
export function useMoverDocumento(clienteId: string) {
  const qc = useQueryClient();
  const moverFn = useServerFn(moverDocumentoDePasta);
  return useMutation({
    mutationFn: ({ documento, pasta }: { documento: DocumentoDoCliente; pasta: PastaDestino }) =>
      moverFn({ data: { documento_id: documento.id, cliente_id: clienteId, pasta } }),
    onMutate: async ({ documento, pasta }) => {
      const chave = ["docs-cliente-pastas", clienteId];
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<DocumentoDoCliente[]>(chave);
      qc.setQueryData<DocumentoDoCliente[]>(chave, (l) =>
        (l ?? []).map((d) => (d.id === documento.id ? { ...d, pasta, pasta_manual: true } : d)),
      );
      return { antes };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(["docs-cliente-pastas", clienteId], ctx.antes);
      toast.error(mensagemDeErro(e, "Não foi possível mover o arquivo."));
    },
    onSuccess: (_r, { documento, pasta }) =>
      toast.success(`"${documento.nome_arquivo}" movido para ${PASTAS[pasta].rotulo}.`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["docs-cliente-pastas", clienteId] });
      qc.invalidateQueries({ queryKey: ["docs-clientes-arvore"] });
    },
  });
}

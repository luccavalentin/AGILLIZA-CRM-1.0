import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileQuestion, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { urlDocumento } from "@/lib/crm/clientes.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import type { DocumentoDoCliente } from "@/lib/crm/documentos-clientes.functions";

export function tipoDePrevia(doc: Pick<DocumentoDoCliente, "mime_type" | "nome_arquivo">) {
  const mime = (doc.mime_type ?? "").toLowerCase();
  const nome = doc.nome_arquivo.toLowerCase();
  if (mime === "application/pdf" || nome.endsWith(".pdf")) return "pdf" as const;
  if (mime.startsWith("image/") || /\.(png|jpe?g)$/.test(nome)) return "imagem" as const;
  return "outro" as const;
}

/** Prévia do arquivo (imagem ou PDF) por link assinado de 5 minutos. */
export function PreviaDialog({
  doc,
  onOpenChange,
}: {
  doc: DocumentoDoCliente | null;
  onOpenChange: (aberto: boolean) => void;
}) {
  const gerarUrl = useServerFn(urlDocumento);
  const link = useQuery({
    queryKey: ["doc-cliente-previa", doc?.storage_path],
    queryFn: () => gerarUrl({ data: { storage_path: doc!.storage_path } }),
    enabled: !!doc,
    staleTime: 4 * 60_000,
    gcTime: 4 * 60_000,
    retry: false,
  });
  const tipo = doc ? tipoDePrevia(doc) : "outro";

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-3 p-4 sm:p-5">
        <DialogHeader className="min-w-0 pr-8 text-left">
          <DialogTitle className="truncate text-base">{doc?.nome_arquivo}</DialogTitle>
          <DialogDescription className="truncate">{doc?.tipo_documento}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-[50vh] flex-1 place-items-center overflow-hidden rounded-xl border border-border/60 bg-muted/30">
          {link.isLoading ? (
            <Loader2 className="size-6 animate-spin text-primary" aria-label="Carregando prévia" />
          ) : link.isError ? (
            <p className="px-4 text-center text-sm text-destructive">
              {mensagemDeErro(link.error, "Não foi possível abrir o arquivo.")}
            </p>
          ) : link.data && tipo === "imagem" ? (
            <img
              src={link.data.url}
              alt={doc?.nome_arquivo ?? "Documento"}
              className="max-h-[70vh] max-w-full object-contain"
            />
          ) : link.data && tipo === "pdf" ? (
            <iframe
              src={link.data.url}
              title={doc?.nome_arquivo ?? "Documento"}
              className="h-[70vh] w-full bg-background"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
              <FileQuestion className="size-8 text-primary/60" strokeWidth={1.5} />
              Este tipo de arquivo não tem prévia. Baixe para abrir.
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="h-11 gap-2 sm:h-9"
            disabled={!link.data}
            onClick={() => link.data && window.open(link.data.url, "_blank", "noopener")}
          >
            <Download className="size-4" /> Baixar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

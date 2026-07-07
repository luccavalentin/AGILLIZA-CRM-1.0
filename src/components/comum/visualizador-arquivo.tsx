import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText } from "lucide-react";

export type ArquivoVisualizavel = {
  /** URL assinada/pública para exibir o arquivo (inline). */
  url: string;
  /** Nome do arquivo (usado para inferir o tipo e o download). */
  nome: string;
  /** URL alternativa que força o download (opcional). */
  urlDownload?: string;
};

function extensao(nome: string): string {
  const m = nome.toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/);
  return m ? m[1] : "";
}

const EXT_IMAGEM = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];
const EXT_PDF = ["pdf"];

/**
 * Diálogo reutilizável para visualizar qualquer arquivo enviado dentro do
 * próprio sistema. Imagens e PDFs são exibidos inline; demais tipos oferecem
 * abrir em nova guia ou baixar.
 */
export function VisualizadorArquivo({
  arquivo,
  open,
  onOpenChange,
}: {
  arquivo: ArquivoVisualizavel | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const tipo = useMemo(() => {
    if (!arquivo) return "outro";
    const ext = extensao(arquivo.nome) || extensao(arquivo.url);
    if (EXT_IMAGEM.includes(ext)) return "imagem";
    if (EXT_PDF.includes(ext)) return "pdf";
    return "outro";
  }, [arquivo]);

  function abrirNovaGuia() {
    if (arquivo) window.open(arquivo.url, "_blank", "noopener");
  }

  function baixar() {
    if (arquivo) window.open(arquivo.urlDownload ?? arquivo.url, "_blank", "noopener");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{arquivo?.nome ?? "Arquivo"}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[50vh] items-center justify-center overflow-auto rounded-md border bg-muted/30">
          {arquivo && tipo === "imagem" && (
            <img
              src={arquivo.url}
              alt={arquivo.nome}
              className="max-h-[70vh] w-auto object-contain"
            />
          )}
          {arquivo && tipo === "pdf" && (
            <iframe
              src={arquivo.url}
              title={arquivo.nome}
              className="h-[70vh] w-full"
            />
          )}
          {arquivo && tipo === "outro" && (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12" />
              <p className="text-sm">
                Pré-visualização não disponível para este tipo de arquivo.
                <br />
                Abra em nova guia ou baixe para visualizar.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={abrirNovaGuia}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir em nova guia
          </Button>
          <Button onClick={baixar}>
            <Download className="mr-2 h-4 w-4" />
            Baixar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

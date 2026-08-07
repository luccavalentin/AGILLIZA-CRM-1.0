import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Loader2, AlertTriangle } from "lucide-react";

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
 *
 * Para PDFs, buscamos o arquivo como blob e usamos uma URL `blob:` local. Isso
 * garante a pré-visualização inline mesmo quando o storage responde com
 * `Content-Disposition: attachment` ou quando restrições de origem cruzada
 * impediriam o `<iframe>` de renderizar a URL assinada diretamente.
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

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  // Busca o PDF como blob para exibição inline confiável.
  useEffect(() => {
    if (!open || !arquivo || tipo !== "pdf") return;
    let ativo = true;
    let criada: string | null = null;
    setCarregando(true);
    setErro(false);
    setBlobUrl(null);

    fetch(arquivo.url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then((b) => {
        if (!ativo) return;
        criada = URL.createObjectURL(new Blob([b], { type: "application/pdf" }));
        setBlobUrl(criada);
      })
      .catch(() => {
        if (ativo) setErro(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [open, arquivo, tipo]);

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
            <>
              {carregando && (
                <div className="flex flex-col items-center gap-3 p-8 text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Carregando pré-visualização…</p>
                </div>
              )}
              {!carregando && erro && (
                <div className="flex flex-col items-center gap-3 p-8 text-center text-muted-foreground">
                  <AlertTriangle className="h-10 w-10 text-amber-500" />
                  <p className="text-sm">
                    Não foi possível carregar a pré-visualização.
                    <br />
                    Abra em nova guia ou baixe para visualizar.
                  </p>
                </div>
              )}
              {!carregando && !erro && blobUrl && (
                <iframe src={blobUrl} title={arquivo.nome} className="h-[70vh] w-full" />
              )}
            </>
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

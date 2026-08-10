import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen,
  Download,
  FileText,
  Library,
  ListChecks,
  Loader2,
  Quote,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { gerarFaqEbook, publicarFaqNaBase } from "@/lib/consultor-ia/ebook.functions";
import type { EbookFaq } from "@/lib/consultor-ia/ebook.server";
import { gerarEbookFaqPDF } from "@/lib/consultor-ia/pdf-lazy";

interface Props {
  pergunta: string;
  resposta: string;
}

/**
 * Transforma a resposta do chat em um verbete de FAQ no formato e-book:
 * título editorial, seções, tabelas, exemplos, gráficos e fontes.
 */
export function EbookFaqButton({ pergunta, resposta }: Props) {
  const [aberto, setAberto] = useState(false);
  const [ebook, setEbook] = useState<EbookFaq | null>(null);

  const gerar = useMutation({
    mutationFn: () => gerarFaqEbook({ data: { pergunta, resposta } }),
    onSuccess: (e) => {
      setEbook(e);
      setAberto(true);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao montar o e-book."),
  });

  const publicar = useMutation({
    mutationFn: () => publicarFaqNaBase({ data: { ebook } }),
    onSuccess: () => toast.success("Verbete publicado na base de conhecimento."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao publicar."),
  });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="ml-1 h-7 gap-1.5 rounded-lg border-primary/30 bg-primary/[0.06] text-[11px] text-primary hover:bg-primary/15"
        disabled={gerar.isPending}
        onClick={() => (ebook ? setAberto(true) : gerar.mutate())}
      >
        {gerar.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <BookOpen className="size-3.5" />
        )}
        {gerar.isPending ? "Elaborando e-book…" : "Gerar FAQ / e-book"}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" />
              {ebook?.titulo ?? "Verbete da base"}
            </DialogTitle>
            <DialogDescription>{ebook?.subtitulo}</DialogDescription>
          </DialogHeader>

          {ebook ? (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="rounded-full text-[11px]">
                    {ebook.categoria.replace(/_/g, " ")}
                  </Badge>
                  {ebook.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="rounded-full text-[11px] font-normal"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>

                {ebook.resumo_executivo ? (
                  <p className="rounded-xl border border-border/60 bg-muted/40 p-3 leading-relaxed">
                    {ebook.resumo_executivo}
                  </p>
                ) : null}

                <Bloco icone={ListChecks} titulo="Pontos-chave" itens={ebook.pontos_chave} />

                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Library className="size-3.5" /> Estrutura ({ebook.secoes.length} seções)
                  </h4>
                  <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                    {ebook.secoes.map((s) => (
                      <li key={s.titulo}>
                        {s.titulo}
                        {s.tabela ? (
                          <span className="ml-1 text-[11px] text-primary">· tabela</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <Metrica icone={BarChart3} valor={ebook.graficos.length} rotulo="gráficos" />
                  <Metrica icone={FileText} valor={ebook.exemplos.length} rotulo="exemplos" />
                  <Metrica icone={Quote} valor={ebook.fontes_pesquisa.length} rotulo="fontes" />
                </div>

                <Bloco
                  icone={Quote}
                  titulo="Fontes de pesquisa"
                  itens={ebook.fontes_pesquisa.map((f) =>
                    f.referencia ? `${f.titulo} — ${f.referencia}` : f.titulo,
                  )}
                />
              </div>
            </ScrollArea>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              disabled={!ebook || publicar.isPending}
              onClick={() => publicar.mutate()}
            >
              {publicar.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Publicar na base
            </Button>
            <Button disabled={!ebook} onClick={() => void (ebook && gerarEbookFaqPDF(ebook))}>
              <Download className="mr-2 size-4" />
              Baixar e-book (PDF)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Bloco({
  icone: Icone,
  titulo,
  itens,
}: {
  icone: typeof ListChecks;
  titulo: string;
  itens: string[];
}) {
  if (!itens.length) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icone className="size-3.5" /> {titulo}
      </h4>
      <ul className="list-disc space-y-1 pl-5 leading-relaxed">
        {itens.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function Metrica({
  icone: Icone,
  valor,
  rotulo,
}: {
  icone: typeof BarChart3;
  valor: number;
  rotulo: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5">
      <Icone className="size-4 text-primary" />
      <span className="text-lg font-semibold tabular-nums">{valor}</span>
      <span className="text-xs text-muted-foreground">{rotulo}</span>
    </div>
  );
}

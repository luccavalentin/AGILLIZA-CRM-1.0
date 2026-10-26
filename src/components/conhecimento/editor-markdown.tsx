import { useRef, useState, type ReactNode } from "react";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Paperclip,
  Quote,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { minutosDeLeitura } from "@/lib/conhecimento/markdown";
import { ArtigoMarkdown } from "./artigo-markdown";

/**
 * Editor rico dos artigos (Base de conhecimento e Agilliza News) — C19/C60.
 *
 * O texto é markdown (portável, versionável, seguro: sem HTML), editado com barra de
 * ferramentas — títulos, negrito, itálico, listas, citação, aviso, tabela, link, imagem,
 * anexo e separador — e prévia ao vivo com a tipografia de leitura (lado a lado no
 * computador, em abas no celular). Imagem e anexo sobem pelo `onEnviarImagem`/
 * `onEnviarAnexo` de quem usa o editor e entram no texto como link.
 */
export function EditorMarkdown({
  valor,
  onChange,
  onEnviarImagem,
  onEnviarAnexo,
  placeholder,
  minLinhas = 16,
  id,
}: {
  valor: string;
  onChange: (v: string) => void;
  onEnviarImagem?: (arquivo: File) => Promise<string>;
  onEnviarAnexo?: (arquivo: File) => Promise<{ nome: string; url: string }>;
  placeholder?: string;
  minLinhas?: number;
  id?: string;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const seletorImagem = useRef<HTMLInputElement>(null);
  const seletorAnexo = useRef<HTMLInputElement>(null);
  const [aba, setAba] = useState<"escrever" | "previa">("escrever");
  const [enviando, setEnviando] = useState(false);

  /** Envolve a seleção (ou insere o exemplo) e devolve o foco no lugar certo. */
  const envolver = (antes: string, depois = "", exemplo = "") => {
    const el = area.current;
    if (!el) return;
    const ini = el.selectionStart;
    const fim = el.selectionEnd;
    const sel = valor.slice(ini, fim) || exemplo;
    const novo = valor.slice(0, ini) + antes + sel + depois + valor.slice(fim);
    onChange(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + antes.length, ini + antes.length + sel.length);
    });
  };

  /** Prefixo em cada linha da seleção (títulos, listas, citação). */
  const prefixar = (gerar: (i: number) => string, exemplo: string) => {
    const el = area.current;
    if (!el) return;
    const iniLinha = valor.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const fimSel = el.selectionEnd;
    const fimLinha =
      valor.indexOf("\n", fimSel) === -1 ? valor.length : valor.indexOf("\n", fimSel);
    const trecho = valor.slice(iniLinha, fimLinha) || exemplo;
    const linhas = trecho
      .split("\n")
      .map((l, i) => gerar(i) + l.replace(/^(#{1,4}\s+|[-*]\s+|\d+\.\s+|>\s?)/, ""));
    const bloco = linhas.join("\n");
    onChange(valor.slice(0, iniLinha) + bloco + valor.slice(fimLinha));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(iniLinha, iniLinha + bloco.length);
    });
  };

  const inserirBloco = (bloco: string) => {
    const el = area.current;
    const pos = el ? el.selectionEnd : valor.length;
    const antes = valor.slice(0, pos);
    const sep = antes && !antes.endsWith("\n\n") ? (antes.endsWith("\n") ? "\n" : "\n\n") : "";
    const novo = `${antes}${sep}${bloco}\n\n${valor.slice(pos)}`;
    onChange(novo);
    requestAnimationFrame(() => {
      el?.focus();
      const p = antes.length + sep.length + bloco.length;
      el?.setSelectionRange(p, p);
    });
  };

  const link = () => {
    const url = window.prompt("Endereço do link (https://…)");
    if (!url) return;
    if (!/^(https?:\/\/|mailto:|\/)/i.test(url.trim())) {
      toast.error("Use um endereço começando com https://");
      return;
    }
    envolver("[", `](${url.trim()})`, "texto do link");
  };

  const enviar = async (arquivo: File | undefined, tipo: "imagem" | "anexo") => {
    if (!arquivo) return;
    setEnviando(true);
    try {
      if (tipo === "imagem" && onEnviarImagem) {
        const url = await onEnviarImagem(arquivo);
        const alt = arquivo.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
        inserirBloco(`![${alt}](${url})`);
      } else if (tipo === "anexo" && onEnviarAnexo) {
        const a = await onEnviarAnexo(arquivo);
        envolver(`[📎 ${a.nome}](${a.url})`, "", "");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    } finally {
      setEnviando(false);
      if (seletorImagem.current) seletorImagem.current.value = "";
      if (seletorAnexo.current) seletorAnexo.current.value = "";
    }
  };

  const palavras = valor.trim() ? valor.trim().split(/\s+/).length : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
        <Ferramenta rotulo="Título" onClick={() => prefixar(() => "## ", "Título da seção")}>
          <Heading2 className="size-4" />
        </Ferramenta>
        <Ferramenta rotulo="Subtítulo" onClick={() => prefixar(() => "### ", "Subtítulo")}>
          <Heading3 className="size-4" />
        </Ferramenta>
        <Separador />
        <Ferramenta rotulo="Negrito" onClick={() => envolver("**", "**", "texto em negrito")}>
          <Bold className="size-4" />
        </Ferramenta>
        <Ferramenta rotulo="Itálico" onClick={() => envolver("*", "*", "texto em itálico")}>
          <Italic className="size-4" />
        </Ferramenta>
        <Ferramenta rotulo="Link" onClick={link}>
          <Link2 className="size-4" />
        </Ferramenta>
        <Separador />
        <Ferramenta rotulo="Lista" onClick={() => prefixar(() => "- ", "item")}>
          <List className="size-4" />
        </Ferramenta>
        <Ferramenta rotulo="Lista numerada" onClick={() => prefixar((i) => `${i + 1}. `, "passo")}>
          <ListOrdered className="size-4" />
        </Ferramenta>
        <Ferramenta rotulo="Citação" onClick={() => prefixar(() => "> ", "citação")}>
          <Quote className="size-4" />
        </Ferramenta>
        <Ferramenta
          rotulo="Aviso (destaque)"
          onClick={() => inserirBloco("> [!INFO] Escreva aqui a informação em destaque.")}
        >
          <Info className="size-4" />
        </Ferramenta>
        <Ferramenta
          rotulo="Tabela"
          onClick={() =>
            inserirBloco(
              "| Coluna 1 | Coluna 2 | Coluna 3 |\n|:--|:--|--:|\n| texto | texto | 0,00 |\n| texto | texto | 0,00 |",
            )
          }
        >
          <Table2 className="size-4" />
        </Ferramenta>
        <Ferramenta rotulo="Separador" onClick={() => inserirBloco("---")}>
          <Minus className="size-4" />
        </Ferramenta>
        {(onEnviarImagem || onEnviarAnexo) && <Separador />}
        {onEnviarImagem && (
          <Ferramenta
            rotulo="Imagem"
            onClick={() => seletorImagem.current?.click()}
            desativada={enviando}
          >
            {enviando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </Ferramenta>
        )}
        {onEnviarAnexo && (
          <Ferramenta
            rotulo="Anexo (PDF, planilha…)"
            onClick={() => seletorAnexo.current?.click()}
            desativada={enviando}
          >
            <Paperclip className="size-4" />
          </Ferramenta>
        )}
        <div className="ml-auto flex items-center gap-1 lg:hidden">
          {(["escrever", "previa"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAba(a)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium",
                aba === a ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {a === "escrever" ? "Escrever" : "Prévia"}
            </button>
          ))}
        </div>
        <input
          ref={seletorImagem}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => void enviar(e.target.files?.[0], "imagem")}
        />
        <input
          ref={seletorAnexo}
          type="file"
          accept=".pdf,.docx,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg"
          className="sr-only"
          onChange={(e) => void enviar(e.target.files?.[0], "anexo")}
        />
      </div>
      <div className="grid lg:grid-cols-2">
        <Textarea
          id={id}
          ref={area}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={minLinhas}
          placeholder={
            placeholder ??
            "Escreva o artigo. Use a barra acima para títulos, listas, tabelas, imagens e links."
          }
          className={cn(
            "min-h-[320px] resize-y rounded-none border-0 font-mono text-[13px] leading-relaxed shadow-none focus-visible:ring-0 lg:border-r lg:border-border",
            aba === "previa" && "hidden lg:block",
          )}
        />
        <div
          className={cn(
            "max-h-[640px] min-h-[320px] overflow-y-auto bg-background/60 p-4",
            aba === "escrever" && "hidden lg:block",
          )}
        >
          {valor.trim() ? (
            <ArtigoMarkdown conteudo={valor} />
          ) : (
            <p className="text-sm text-muted-foreground">
              A prévia aparece aqui, com a tipografia de leitura.
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>
          {palavras} palavra(s) · {minutosDeLeitura(valor)} min de leitura
        </span>
        <span className="hidden sm:inline">Markdown seguro: sem HTML, links só https</span>
      </div>
    </div>
  );
}

function Ferramenta({
  rotulo,
  onClick,
  children,
  desativada,
}: {
  rotulo: string;
  onClick: () => void;
  children: ReactNode;
  desativada?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={onClick}
          disabled={desativada}
          aria-label={rotulo}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{rotulo}</TooltipContent>
    </Tooltip>
  );
}

function Separador() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}

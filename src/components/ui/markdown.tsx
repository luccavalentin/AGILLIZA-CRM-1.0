/**
 * Renderizador markdown mínimo (sem dependência externa) usado nas respostas
 * do Consultor IA e no preview da base de conhecimento.
 * Suporta: títulos (#..###), negrito, itálico, código inline, listas, separador
 * e parágrafos.
 */
import { Fragment } from "react";

function inline(texto: string, key: string) {
  const partes = texto.split(/(!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean);
  return partes.map((p, i) => {
    const k = `${key}-${i}`;
    
    // Suporte a Imagens Markdown ![alt](url)
    const imgMatch = p.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      return (
        <div key={k} className="my-4 overflow-hidden rounded-2xl border border-primary/10 shadow-lg">
          <img 
            src={imgMatch[2]} 
            alt={imgMatch[1] || "Imagem gerada pela IA"} 
            className="h-auto w-full object-cover transition-transform hover:scale-[1.02]"
            loading="lazy"
          />
        </div>
      );
    }

    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={k} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code key={k} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
      return <em key={k}>{p.slice(1, -1)}</em>;
    }
    return <Fragment key={k}>{p}</Fragment>;
  });
}

export function Markdown({ conteudo, className }: { conteudo: string; className?: string }) {
  const linhas = conteudo.split("\n");
  const blocos: React.ReactNode[] = [];
  let lista: string[] = [];

  const fecharLista = (idx: number) => {
    if (lista.length === 0) return;
    blocos.push(
      <ul key={`ul-${idx}`} className="my-2 list-disc space-y-1 pl-5">
        {lista.map((li, i) => (
          <li key={i}>{inline(li, `li-${idx}-${i}`)}</li>
        ))}
      </ul>,
    );
    lista = [];
  };

  linhas.forEach((linha, idx) => {
    const l = linha.trim();
    if (/^[-*]\s+/.test(l)) {
      lista.push(l.replace(/^[-*]\s+/, ""));
      return;
    }
    fecharLista(idx);
    if (!l) return;
    if (/^---+$/.test(l)) {
      blocos.push(<hr key={`hr-${idx}`} className="my-3 border-border/60" />);
      return;
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const nivel = h[1].length;
      const cls =
        nivel === 1
          ? "text-base font-semibold"
          : nivel === 2
            ? "text-sm font-semibold"
            : "text-sm font-medium";
      blocos.push(
        <p key={`h-${idx}`} className={`mt-3 first:mt-0 ${cls}`}>
          {inline(h[2], `h-${idx}`)}
        </p>,
      );
      return;
    }
    blocos.push(
      <p key={`p-${idx}`} className="my-1.5 leading-relaxed">
        {inline(l, `p-${idx}`)}
      </p>,
    );
  });
  fecharLista(linhas.length);

  return <div className={className}>{blocos}</div>;
}

import { Fragment, type ReactNode } from "react";
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { analisarMarkdown, type Alinhamento, type Bloco, type Inline } from "@/lib/conhecimento/markdown";

/**
 * Desenha markdown de artigo (Base de conhecimento, Agilliza News, Consultor IA) com
 * tipografia de leitura. Sem HTML cru: cada nó é um elemento React (texto escapado pelo
 * React), links só http(s)/mailto/internos e imagens só https — ver `markdown.ts`.
 *
 * `variante`: "artigo" (leitura longa, tipografia maior) ou "compacto" (chat, prévias).
 */
export function ArtigoMarkdown({
  conteudo,
  className,
  variante = "artigo",
}: {
  conteudo: string;
  className?: string;
  variante?: "artigo" | "compacto";
}) {
  const blocos = analisarMarkdown(conteudo);
  const artigo = variante === "artigo";
  return (
    <div
      className={cn(
        "min-w-0 break-words text-foreground/90",
        artigo ? "space-y-4 text-[15.5px] leading-[1.75]" : "space-y-2.5 text-sm leading-relaxed",
        className,
      )}
    >
      {blocos.map((b, i) => bloco(b, `b${i}`, artigo))}
    </div>
  );
}

function inline(nos: Inline[], k: string): ReactNode {
  return nos.map((n, i) => {
    const key = `${k}-${i}`;
    switch (n.t) {
      case "texto":
        return <Fragment key={key}>{n.v}</Fragment>;
      case "negrito":
        return (
          <strong key={key} className="font-semibold text-foreground">
            {inline(n.c, key)}
          </strong>
        );
      case "italico":
        return <em key={key}>{inline(n.c, key)}</em>;
      case "codigo":
        return (
          <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
            {n.v}
          </code>
        );
      case "link": {
        const externo = /^https?:/i.test(n.href);
        return (
          <a
            key={key}
            href={n.href}
            className="font-medium text-primary underline decoration-primary/30 underline-offset-[3px] hover:decoration-primary"
            {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {inline(n.c, key)}
          </a>
        );
      }
      case "imagem":
        return (
          <img
            key={key}
            src={n.src}
            alt={n.alt}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="inline-block max-h-[420px] max-w-full rounded-lg align-middle"
          />
        );
    }
  });
}

const alinhar = (a: Alinhamento) =>
  a === "centro" ? "text-center" : a === "direita" ? "text-right" : "text-left";

function bloco(b: Bloco, k: string, artigo: boolean): ReactNode {
  switch (b.t) {
    case "titulo": {
      const c = inline(b.c, k);
      if (b.nivel === 1)
        return (
          <h2 key={k} id={b.ancora} className={cn("scroll-mt-20 font-semibold tracking-tight text-foreground", artigo ? "pt-2 text-2xl" : "text-base")}>
            {c}
          </h2>
        );
      if (b.nivel === 2)
        return (
          <h2 key={k} id={b.ancora} className={cn("scroll-mt-20 font-semibold tracking-tight text-foreground", artigo ? "pt-3 text-xl" : "pt-1 text-[15px]")}>
            {c}
          </h2>
        );
      if (b.nivel === 3)
        return (
          <h3 key={k} id={b.ancora} className={cn("scroll-mt-20 font-semibold text-foreground", artigo ? "pt-2 text-lg" : "text-sm")}>
            {c}
          </h3>
        );
      return (
        <h4 key={k} id={b.ancora} className="scroll-mt-20 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {c}
        </h4>
      );
    }
    case "paragrafo":
      return <p key={k}>{inline(b.c, k)}</p>;
    case "lista":
      return b.ordenada ? (
        <ol key={k} start={b.inicio} className="list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-primary">
          {b.itens.map((it, i) => (
            <li key={i} className="pl-1">
              {inline(it, `${k}-${i}`)}
            </li>
          ))}
        </ol>
      ) : (
        <ul key={k} className="list-disc space-y-1.5 pl-6 marker:text-primary">
          {b.itens.map((it, i) => (
            <li key={i} className="pl-1">
              {inline(it, `${k}-${i}`)}
            </li>
          ))}
        </ul>
      );
    case "citacao":
      return (
        <blockquote key={k} className="space-y-2 border-l-[3px] border-primary/60 py-1 pl-4 italic text-muted-foreground">
          {b.blocos.map((x, i) => bloco(x, `${k}-${i}`, artigo))}
        </blockquote>
      );
    case "aviso": {
      const Icone = b.tipo === "atencao" ? AlertTriangle : b.tipo === "dica" ? Lightbulb : Info;
      const tom =
        b.tipo === "atencao"
          ? "border-destructive/30 bg-destructive/5 [&_.rotulo]:text-destructive"
          : b.tipo === "dica"
            ? "border-success/30 bg-success/5 [&_.rotulo]:text-success"
            : "border-primary/25 bg-primary/5 [&_.rotulo]:text-primary";
      return (
        <aside key={k} role="note" className={cn("flex gap-3 rounded-xl border p-4", tom)}>
          <Icone className="rotulo mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 space-y-2">
            <p className="rotulo text-[11px] font-semibold uppercase tracking-[0.12em]">
              {b.tipo === "atencao" ? "Atenção" : b.tipo === "dica" ? "Dica" : "Informação"}
            </p>
            {b.blocos.map((x, i) => bloco(x, `${k}-${i}`, artigo))}
          </div>
        </aside>
      );
    }
    case "tabela":
      return (
        <div key={k} className="max-w-full overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/60">
              <tr>
                {b.cabecalho.map((c, i) => (
                  <th key={i} className={cn("whitespace-nowrap border-b border-border px-3 py-2 font-semibold", alinhar(b.alinhamentos[i] ?? null))}>
                    {inline(c, `${k}-h${i}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.linhas.map((l, r) => (
                <tr key={r} className="even:bg-muted/20">
                  {l.map((c, i) => (
                    <td key={i} className={cn("border-b border-border/60 px-3 py-2 tabular-nums", alinhar(b.alinhamentos[i] ?? null))}>
                      {inline(c, `${k}-${r}-${i}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "separador":
      return <hr key={k} className="my-2 border-border/70" />;
    case "codigo":
      return (
        <pre key={k} className="max-w-full overflow-x-auto rounded-xl bg-muted p-3 font-mono text-[13px]">
          <code>{b.v}</code>
        </pre>
      );
    case "figura":
      return (
        <figure key={k} className="space-y-2">
          <img src={b.src} alt={b.alt} loading="lazy" referrerPolicy="no-referrer" className="w-full rounded-xl border border-border/60 object-cover shadow-sm" />
          {b.alt && <figcaption className="text-center text-xs text-muted-foreground">{b.alt}</figcaption>}
        </figure>
      );
  }
}

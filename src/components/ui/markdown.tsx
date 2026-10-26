/**
 * Renderizador markdown usado nas respostas do Consultor IA e nas prévias da base de
 * conhecimento. Desde a frente a7 (26/10/2026) é o mesmo analisador seguro dos artigos
 * (`src/lib/conhecimento/markdown.ts`): títulos, listas, tabelas, links, avisos, citações
 * e imagens https — sem HTML cru.
 */
import { ArtigoMarkdown } from "@/components/conhecimento/artigo-markdown";

export function Markdown({ conteudo, className }: { conteudo: string; className?: string }) {
  return <ArtigoMarkdown conteudo={conteudo} className={className} variante="compacto" />;
}

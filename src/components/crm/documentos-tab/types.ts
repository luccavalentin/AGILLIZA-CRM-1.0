import {
  SLUG_CATEGORIAS,
  type DocumentoPasta,
} from "@/lib/crm/documento-pastas.functions";

export type Categoria =
  | "comprador"
  | "conjuge"
  | "vendedor"
  | "vendedor_conjuge"
  | "imovel"
  | "outros";

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  comprador: "Comprador / Titular",
  conjuge: "Cônjuge / Composição",
  vendedor: "Vendedor",
  vendedor_conjuge: "Cônjuge do vendedor",
  imovel: "Imóvel",
  outros: "Outros",
};

export const statusTone: Record<
  string,
  "success" | "warning" | "danger" | "muted" | "info"
> = {
  aprovado: "success",
  recebido: "info",
  pendente: "warning",
  reprovado: "danger",
  expirado: "danger",
};

/** Categorias oferecidas no seletor "titular" de uma pasta. */
export function categoriasDaPasta(pasta: DocumentoPasta | null): Categoria[] {
  if (!pasta) return ["outros"];
  if (pasta.slug && SLUG_CATEGORIAS[pasta.slug]) {
    return SLUG_CATEGORIAS[pasta.slug] as Categoria[];
  }
  return ["outros"];
}

/** Um documento pertence à pasta por vínculo direto ou (legado) pela categoria. */
export function docNaPasta(doc: any, pasta: DocumentoPasta): boolean {
  if (doc.pasta_id) return doc.pasta_id === pasta.id;
  if (!pasta.slug) return false;
  return (SLUG_CATEGORIAS[pasta.slug] ?? []).includes(doc.categoria);
}

export type Categoria =
  | "comprador"
  | "conjuge"
  | "vendedor"
  | "vendedor_conjuge"
  | "imovel"
  | "outros";

export interface ItemChecklist {
  id: string;
  label: string;
  feito: boolean;
}

export interface GrupoChecklist {
  id: string;
  titulo: string;
  itens: ItemChecklist[];
}

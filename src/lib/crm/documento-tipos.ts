/**
 * Fonte única dos tipos de documento — client-safe.
 * Os mesmos tipos exibidos no Checklist são oferecidos como opções de "Tipo"
 * ao enviar/editar um documento dentro de uma pasta, garantindo consistência.
 */

export type CategoriaDocumento =
  | "comprador"
  | "conjuge"
  | "vendedor"
  | "vendedor_conjuge"
  | "imovel"
  | "outros";

/** Tipos de documento do checklist, agrupados por categoria (titular). */
export const TIPOS_DOCUMENTO_POR_CATEGORIA: Record<CategoriaDocumento, string[]> = {
  comprador: [
    "Documento de identidade (RG, CPF ou CNH)",
    "Comprovante de endereço atualizado",
    "Certidão de estado civil",
    "Comprovante de endereço no nome do utilizador do FGTS",
    "IRPF completo com recibo",
    "CTPS digital completa",
    "Extrato atualizado do FGTS",
  ],
  conjuge: ["Documento de identidade do cônjuge (RG, CPF ou CNH)"],
  vendedor: [
    "Documento de identidade (RG ou CNH)",
    "Comprovante de endereço atualizado",
    "Certidão de estado civil",
    "Contrato social / última alteração",
    "Cartão CNPJ",
    "Documento dos sócios",
    "Comprovante de endereço da empresa",
  ],
  vendedor_conjuge: ["Documento de identidade do cônjuge (RG, CPF ou CNH)"],
  imovel: [
    "Matrícula atualizada com certidão de ônus",
    "Capa do IPTU ou Certidão de Valor Venal",
    "CND condominial",
    "Planta de quadra e lote",
  ],
  outros: [],
};

/** Retorna os tipos sugeridos para um conjunto de categorias (deduplicados). */
export function tiposParaCategorias(categorias: CategoriaDocumento[]): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const cat of categorias) {
    for (const tipo of TIPOS_DOCUMENTO_POR_CATEGORIA[cat] ?? []) {
      if (!vistos.has(tipo)) {
        vistos.add(tipo);
        lista.push(tipo);
      }
    }
  }
  return lista;
}

/** Valor especial no Select para digitar um tipo livre. */
export const TIPO_OUTRO = "__outro__";

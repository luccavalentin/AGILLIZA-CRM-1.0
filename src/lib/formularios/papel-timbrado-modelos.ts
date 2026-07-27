/**
 * Modelos de Papel Timbrado — 5 variações institucionais Agilliza.
 * Cores dentro dos padrões da marca (azul institucional, grafite, bordô,
 * esmeralda, tinta preta) e todos os modelos incluem marca d'água central.
 */
export type PapelTimbradoModeloId =
  | "institucional"
  | "executivo"
  | "premium"
  | "corporativo"
  | "editorial";

export interface PapelTimbradoModelo {
  id: PapelTimbradoModeloId;
  nome: string;
  descricao: string;
  /** Faixa/acento principal (RGB hex). */
  primaria: string;
  /** Cor mais escura da faixa (para gradiente sutil). */
  primariaEscura: string;
  /** Cor de destaque (linha fina abaixo do cabeçalho, títulos internos). */
  destaque: string;
  /** Cor de texto de destaque (títulos/rótulos no corpo). */
  destaqueTexto: string;
  /** Tom da marca d'água (aplicada em opacidade baixa). */
  marcaDagua: string;
  /** Estilo do cabeçalho. */
  estilo: "faixa" | "hairline" | "borda-lateral";
  /** Rótulo do rodapé. */
  rodape: string;
}

export const PAPEL_TIMBRADO_MODELOS: PapelTimbradoModelo[] = [
  {
    id: "institucional",
    nome: "Institucional Azul",
    descricao: "Faixa azul profundo com detalhe coral. Padrão Agilliza.",
    primaria: "#000F9F",
    primariaEscura: "#000A70",
    destaque: "#F5333F",
    destaqueTexto: "#000F9F",
    marcaDagua: "#000F9F",
    estilo: "faixa",
    rodape: "Agilliza · Crédito Imobiliário — Documento oficial",
  },
  {
    id: "executivo",
    nome: "Executivo Grafite",
    descricao: "Minimalismo em grafite com acento azul discreto.",
    primaria: "#1F2937",
    primariaEscura: "#111827",
    destaque: "#3B82F6",
    destaqueTexto: "#111827",
    marcaDagua: "#1F2937",
    estilo: "hairline",
    rodape: "Agilliza · Correspondente de Crédito Imobiliário",
  },
  {
    id: "premium",
    nome: "Premium Bordô",
    descricao: "Bordô refinado com acento dourado — comunicados premium.",
    primaria: "#6B1E2E",
    primariaEscura: "#4A1220",
    destaque: "#C9A24A",
    destaqueTexto: "#6B1E2E",
    marcaDagua: "#6B1E2E",
    estilo: "faixa",
    rodape: "Agilliza · Assessoria Premium em Crédito",
  },
  {
    id: "corporativo",
    nome: "Corporativo Esmeralda",
    descricao: "Verde esmeralda profundo com dourado — sofisticação corporativa.",
    primaria: "#0F5132",
    primariaEscura: "#0A3A24",
    destaque: "#C9A24A",
    destaqueTexto: "#0F5132",
    marcaDagua: "#0F5132",
    estilo: "borda-lateral",
    rodape: "Agilliza · Soluções Corporativas de Crédito",
  },
  {
    id: "editorial",
    nome: "Editorial Tinta",
    descricao: "Preto e branco tipográfico, hairlines finas e marca d'água ampla.",
    primaria: "#0B0B0F",
    primariaEscura: "#000000",
    destaque: "#0B0B0F",
    destaqueTexto: "#0B0B0F",
    marcaDagua: "#0B0B0F",
    estilo: "hairline",
    rodape: "Agilliza · Correspondência Institucional",
  },
];

export function getPapelTimbradoModelo(id: PapelTimbradoModeloId | undefined | null): PapelTimbradoModelo {
  return PAPEL_TIMBRADO_MODELOS.find((m) => m.id === id) ?? PAPEL_TIMBRADO_MODELOS[0];
}

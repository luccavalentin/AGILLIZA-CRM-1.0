/**
 * Modelos de Papel Timbrado — 10 variações institucionais Agilliza.
 *
 * 5 modelos corporativos (Minimalista, Executivo, Premium, Moderno, Clássico) e 5 modelos da linha
 * "Real" — inspirados em alta nobreza: moldura ornamental refinada,
 * cantos trabalhados em ouro, brasão/selo em marca d'água e tipografia serifada de luxo.
 * Todos incluem marca d'água central e foram calibrados para máxima elegância corporativa.
 */
export type PapelTimbradoModeloId =
  | "institucional"
  | "executivo"
  | "premium"
  | "corporativo"
  | "editorial"
  | "real-pergaminho"
  | "real-bordo"
  | "real-imperial"
  | "real-esmeralda"
  | "real-onix";

/** Ornamento da linha Real (define o desenho da moldura e do selo). */
export type OrnamentoReal = "brasao" | "coroa" | "selo" | "laurel" | "monograma";

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
  estilo: "faixa" | "hairline" | "borda-lateral" | "real";
  /** Rótulo do rodapé. */
  rodape: string;
  /** Ornamento do selo/moldura (apenas estilo "real"). */
  ornamento?: OrnamentoReal;
  /** Fundo do papel (marfim/pergaminho) — apenas estilo "real". */
  fundo?: string;
  /** Cor dourada/metálica dos filetes da moldura — apenas estilo "real". */
  metalico?: string;
  /** Legenda heráldica impressa sob o brasão. */
  lema?: string;
}

export const PAPEL_TIMBRADO_MODELOS: PapelTimbradoModelo[] = [
  {
    id: "institucional",
    nome: "Minimalista Agilliza",
    descricao: "Design limpo com foco na marca. Azul profundo Agilliza e detalhes em coral.",
    primaria: "#000F9F",
    primariaEscura: "#00074A",
    destaque: "#F5333F",
    destaqueTexto: "#000F9F",
    marcaDagua: "#000F9F",
    estilo: "hairline",
    rodape: "Agilliza · Soluções em Crédito Imobiliário",
  },
  {
    id: "executivo",
    nome: "Executivo Agilliza",
    descricao: "Sofisticação em azul marinho e tons neutros. Profissional e direto.",
    primaria: "#00074A",
    primariaEscura: "#000536",
    destaque: "#000F9F",
    destaqueTexto: "#00074A",
    marcaDagua: "#00074A",
    estilo: "faixa",
    rodape: "Agilliza · Correspondente Bancário Autorizado",
  },
  {
    id: "premium",
    nome: "Agilliza Premium",
    descricao: "Visual exclusivo para comunicados de alto impacto. Azul marinho e Coral Agilliza.",
    primaria: "#000A70",
    primariaEscura: "#00074A",
    destaque: "#F5333F",
    destaqueTexto: "#000A70",
    marcaDagua: "#000A70",
    estilo: "borda-lateral",
    rodape: "Agilliza · Assessoria Especializada em Crédito",
  },
  {
    id: "corporativo",
    nome: "Agilliza Elite",
    descricao: "Forte identidade visual com bordas estruturadas e tipografia clara.",
    primaria: "#000F9F",
    primariaEscura: "#00074A",
    destaque: "#F5333F",
    destaqueTexto: "#000F9F",
    marcaDagua: "#000F9F",
    estilo: "faixa",
    rodape: "Agilliza · Gestão de Ativos e Crédito",
  },
  {
    id: "editorial",
    nome: "Clássico Agilliza",
    descricao: "Equilíbrio perfeito entre tradição e modernidade. Elegância atemporal.",
    primaria: "#0B0B0F",
    primariaEscura: "#000000",
    destaque: "#000F9F",
    destaqueTexto: "#0B0B0F",
    marcaDagua: "#000F9F",
    estilo: "hairline",
    rodape: "Agilliza · Excelência em Atendimento",
  },

  /* ——— Linha Real — carta régia moderna, para papel cartão ——— */
  {
    id: "real-pergaminho",
    nome: "Agilliza Real Nobreza",
    descricao: "Luxo em tons de marinho e dourado Agilliza, com moldura artesanal.",
    primaria: "#000F9F",
    primariaEscura: "#00074A",
    destaque: "#C5A048",
    destaqueTexto: "#000F9F",
    marcaDagua: "#C5A048",
    estilo: "real",
    ornamento: "brasao",
    fundo: "#FFFDF5",
    metalico: "#D4AF37",
    lema: "EXCELÊNCIA · INTEGRIDADE · LAR",
    rodape: "Agilliza · Gabinete de Crédito Premium",
  },
  {
    id: "real-bordo",
    nome: "Agilliza Real Majestoso",
    descricao: "Azul profundo combinado com detalhes em ouro Agilliza.",
    primaria: "#00074A",
    primariaEscura: "#000536",
    destaque: "#D4AF37",
    destaqueTexto: "#00074A",
    marcaDagua: "#00074A",
    estilo: "real",
    ornamento: "coroa",
    fundo: "#FEF9F5",
    metalico: "#D4AF37",
    lema: "HONRA · FORTALEZA · FÉ",
    rodape: "Agilliza · Chancelaria de Financiamento Imobiliário",
  },
  {
    id: "real-imperial",
    nome: "Agilliza Real Gran Elite",
    descricao: "O azul oficial Agilliza em uma moldura de gala com selo dourado.",
    primaria: "#000A70",
    primariaEscura: "#00062F",
    destaque: "#D4AF37",
    destaqueTexto: "#000A70",
    marcaDagua: "#000A70",
    estilo: "real",
    ornamento: "selo",
    fundo: "#F7F9FF",
    metalico: "#D4AF37",
    lema: "ORDEM · RAZÃO · CONFIANÇA",
    rodape: "Agilliza · Documentação de Alta Relevância",
  },
  {
    id: "real-esmeralda",
    nome: "Agilliza Real Prestígio",
    descricao: "Marinho profundo e ouro Agilliza, evocando estabilidade.",
    primaria: "#000F9F",
    primariaEscura: "#00074A",
    destaque: "#D4AF37",
    destaqueTexto: "#000F9F",
    marcaDagua: "#000F9F",
    estilo: "real",
    ornamento: "laurel",
    fundo: "#F5FBF7",
    metalico: "#D4AF37",
    lema: "PATRIMÔNIO · CUIDADO · FUTURO",
    rodape: "Agilliza · Consultoria Patrimonial e Crédito",
  },
  {
    id: "real-onix",
    nome: "Agilliza Real Soberano",
    descricao: "O poder do azul Agilliza e dourado em uma peça de altíssima sofisticação.",
    primaria: "#00074A",
    primariaEscura: "#000000",
    destaque: "#D4AF37",
    destaqueTexto: "#00074A",
    marcaDagua: "#D4AF37",
    estilo: "real",
    ornamento: "monograma",
    fundo: "#FAF9F7",
    metalico: "#C5A048",
    lema: "DISCRIÇÃO · RIGOR · EXCELÊNCIA",
    rodape: "Agilliza · Correspondência de Alta Cúpula",
  },
];

export function getPapelTimbradoModelo(id: PapelTimbradoModeloId | undefined | null): PapelTimbradoModelo {
  return PAPEL_TIMBRADO_MODELOS.find((m) => m.id === id) ?? PAPEL_TIMBRADO_MODELOS[0];
}

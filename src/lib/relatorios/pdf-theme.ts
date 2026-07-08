import { getTheme } from "@/lib/theme";

/**
 * Paleta dos documentos/relatórios (PDF e HTML de impressão).
 * Segue o tema ativo do sistema: claro (institucional) ou escuro.
 * Os relatórios saem no mesmo tom da interface no momento da geração.
 */
export interface PdfPalette {
  /** Fundo da página (null = branco/sem preenchimento). */
  pageBg: string | null;
  /** Azul de preenchimento (faixa de cabeçalho, cabeçalho de tabela). */
  azul: string;
  /** Coral de destaque (detalhes/acentos). */
  coral: string;
  /** Cor do texto de corpo. */
  texto: string;
  /** Cor de texto secundário (rótulos, legendas). */
  cinza: string;
  /** Preenchimento de cartões/caixas e linhas zebradas. */
  card: string;
  /** Cor das bordas e linhas de tabela. */
  borda: string;
  /** Cor de destaque para valores/títulos (legível sobre o fundo). */
  destaque: string;
  /** Texto sobre a faixa azul (sempre claro). */
  headText: string;
  /** Subtítulo sobre a faixa azul. */
  subHead: string;
  /** Preenchimento do rodapé de totais da tabela. */
  footFill: string;
  /** Texto do rodapé de totais da tabela. */
  footText: string;
  /** Separador vertical no cabeçalho. */
  sep: string;
  /** true quando o tema é escuro. */
  dark: boolean;
}

const LIGHT: PdfPalette = {
  pageBg: null,
  azul: "#000F9F",
  coral: "#F5333F",
  texto: "#0B0B0F",
  cinza: "#6B7280",
  card: "#F7F8FA",
  borda: "#E4E6EF",
  destaque: "#000F9F",
  headText: "#FFFFFF",
  subHead: "#C7CBF0",
  footFill: "#E9EBF5",
  footText: "#000F9F",
  sep: "#4655C4",
  dark: false,
};

const DARK: PdfPalette = {
  pageBg: "#0E0F16",
  azul: "#000A70",
  coral: "#F5333F",
  texto: "#E6E8F0",
  cinza: "#9AA3B2",
  card: "#1A1C28",
  borda: "#2E3142",
  destaque: "#93A6FF",
  headText: "#FFFFFF",
  subHead: "#C7CBF0",
  footFill: "#1A1C28",
  footText: "#93A6FF",
  sep: "#4655C4",
  dark: true,
};

/** Devolve a paleta do documento conforme o tema ativo do sistema. */
export function getPdfPalette(): PdfPalette {
  return getTheme() === "dark" ? DARK : LIGHT;
}

import { getTheme } from "@/lib/theme";

/**
 * Paleta dos documentos/relatórios (PDF e HTML de impressão).
 *
 * IMPORTANTE: o relatório é SEMPRE branco e formal. A única diferença entre o
 * modo claro e o modo escuro é o TOM DE AZUL usado nos destaques (faixa de
 * cabeçalho, cabeçalho de tabela, valores), acompanhando o tom do menu do
 * sistema. O fundo, o texto, os cartões e as bordas permanecem idênticos.
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

/** Base formal branca — compartilhada pelos dois modos. */
const BASE = {
  pageBg: null,
  coral: "#F5333F",
  texto: "#0B0B0F",
  cinza: "#6B7280",
  card: "#F7F8FA",
  borda: "#E4E6EF",
  headText: "#FFFFFF",
} as const;

/** Modo claro — azul institucional vivo. */
const LIGHT: PdfPalette = {
  ...BASE,
  azul: "#000F9F",
  destaque: "#000F9F",
  subHead: "#C7CBF0",
  footFill: "#E9EBF5",
  footText: "#000F9F",
  sep: "#4655C4",
  dark: false,
};

/** Modo escuro — mesmo relatório branco/formal, apenas o azul num tom mais profundo (tom do menu escuro). */
const DARK: PdfPalette = {
  ...BASE,
  azul: "#050A3C",
  destaque: "#050A3C",
  subHead: "#AEB4E6",
  footFill: "#E7E9F4",
  footText: "#050A3C",
  sep: "#2A3390",
  dark: true,
};

/** Devolve a paleta do documento conforme o tema ativo do sistema. */
export function getPdfPalette(): PdfPalette {
  return getTheme() === "dark" ? DARK : LIGHT;
}

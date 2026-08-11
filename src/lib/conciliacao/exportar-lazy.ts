/**
 * Wrappers assíncronos das exportações do Comparativo de dados.
 *
 * As bibliotecas pesadas (ExcelJS, jsPDF) só entram na rede quando o usuário
 * clica em exportar/imprimir, mantendo a navegação entre telas leve.
 */
import type { AbaXlsx } from "./xlsx-tipos";

export type ModoSaida = "download" | "print";

export async function baixarXlsx(
  nomeArquivo: string,
  abas: AbaXlsx[],
  titulo = "Comparativo de dados",
) {
  const mod = await import("./exportar-xlsx");
  return mod.baixarXlsx(nomeArquivo, abas, titulo);
}

export async function gerarPdfComparativo(
  opcoes: Parameters<(typeof import("./exportar-pdf"))["gerarPdfComparativo"]>[0],
) {
  const mod = await import("./exportar-pdf");
  return mod.gerarPdfComparativo(opcoes);
}

/** Leitura de planilhas de banco (xlsx/xls/csv) sob demanda. */
export async function lerArquivoBanco(
  ...args: Parameters<(typeof import("./leitor-arquivo"))["lerArquivoBanco"]>
) {
  const mod = await import("./leitor-arquivo");
  return mod.lerArquivoBanco(...args);
}

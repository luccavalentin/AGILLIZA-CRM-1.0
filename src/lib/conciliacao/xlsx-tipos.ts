/**
 * Tipos e helpers leves das planilhas do Comparativo de dados.
 *
 * Fica separado de `exportar-xlsx.ts` para que as telas possam montar as abas
 * sem carregar o ExcelJS (~900 kB) no bundle inicial — a biblioteca só é
 * baixada quando o usuário realmente exporta.
 */
export type TipoColuna = "texto" | "brl" | "data" | "int" | "pct";

export interface ColunaXlsx {
  header: string;
  key: string;
  tipo?: TipoColuna;
  width?: number;
  /** Soma/contagem exibida na linha de totais. */
  total?: "sum" | "count";
}

export interface AbaXlsx {
  nome: string;
  colunas: ColunaXlsx[];
  linhas: Record<string, unknown>[];
  /** Subtítulo exibido acima da tabela. */
  subtitulo?: string;
  /** Aba de capa (pares rótulo → valor), sem cabeçalho de tabela colorido. */
  capa?: boolean;
}

/** Aba de capa/resumo com pares rótulo → valor. */
export function abaResumo(
  titulo: string,
  itens: { rotulo: string; valor: string | number }[],
): AbaXlsx {
  return {
    nome: "Resumo",
    capa: true,
    colunas: [
      { header: titulo, key: "rotulo", width: 40 },
      { header: "Valor", key: "valor", width: 28 },
    ],
    linhas: itens.map((i) => ({ rotulo: i.rotulo, valor: i.valor })),
  };
}

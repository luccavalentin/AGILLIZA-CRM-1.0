import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Nenhuma consulta pede mais de mil linhas de uma vez.
 *
 * O PostgREST devolve no máximo 1.000 linhas por resposta e ignora pedidos
 * maiores sem erro nenhum: `.limit(5000)` volta com mil. Foi assim que a
 * esteira escondeu 87 clientes e o volume simulado apareceu como R$ 411 mi
 * em vez de R$ 2,43 bi (19/09/2026). Quem precisa do conjunto inteiro usa
 * `todasAsLinhas` de `src/lib/paginar.ts`, que pagina e falha à vista ao
 * bater no teto.
 *
 * Um `.limit()` até mil continua liberado: é um corte de verdade, não uma
 * ilusão (as 200 últimas mensagens, os 50 primeiros resultados da busca).
 */
const RAIZ = join(process.cwd(), "src", "lib");
const TETO = 1000;

function arquivos(dir: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) achados.push(...arquivos(caminho));
    else if (entrada.name.endsWith(".ts") && !entrada.name.endsWith(".test.ts"))
      achados.push(caminho);
  }
  return achados;
}

describe("teto de mil linhas do PostgREST", () => {
  it("nenhum .limit() acima de mil nas consultas", () => {
    const exagerados: string[] = [];
    for (const caminho of arquivos(RAIZ)) {
      const linhas = readFileSync(caminho, "utf8").split("\n");
      linhas.forEach((linha, i) => {
        const enxuta = linha.trim();
        if (enxuta.startsWith("//") || enxuta.startsWith("*") || enxuta.startsWith("/*")) return;
        const m = /\.limit\((\d[\d_]*)\)/.exec(linha);
        if (!m) return;
        const pedido = Number(m[1].replace(/_/g, ""));
        if (pedido <= TETO) return;
        exagerados.push(`${caminho.replace(process.cwd(), "")}:${i + 1} → limit(${pedido})`);
      });
    }
    expect(exagerados).toEqual([]);
  });
});

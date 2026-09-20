import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Relatório não conta registro que está na lixeira.
 *
 * Em 19/09/2026 o relatório gerencial somava R$ 136 mi onde o real eram R$ 70
 * mi: das 415 propostas do banco, 234 estavam excluídas e entravam na conta.
 * O mesmo valia para o comparativo mensal, os contratos gerenciais e o
 * drilldown de simulações. Como o erro é invisível na tela — o número só fica
 * maior —, este teste lê o próprio código e cobra o filtro.
 *
 * Se uma consulta nova precisar mesmo enxergar excluídos (uma tela de
 * lixeira, por exemplo), basta ela citar `deleted_at` para dizer isso de
 * forma explícita.
 */
const PASTA = join(dirname(fileURLToPath(import.meta.url)));
const COM_LIXEIRA = ["propostas", "simulacoes", "clientes", "tasks", "demandas"];
/** Quantas linhas depois do `.from(...)` ainda fazem parte da mesma consulta. */
const JANELA = 14;

function consultasSemFiltro(arquivo: string) {
  const linhas = readFileSync(join(PASTA, arquivo), "utf8").split("\n");
  const faltando: string[] = [];
  linhas.forEach((linha, i) => {
    const alvo = COM_LIXEIRA.find((t) => linha.includes(`.from("${t}")`));
    if (!alvo) return;
    const bloco = linhas.slice(i, i + JANELA).join("\n");
    // Escrita não filtra lixeira; só leitura.
    if (/\.(insert|update|upsert|delete)\(/.test(bloco)) return;
    if (bloco.includes("deleted_at")) return;
    faltando.push(`${arquivo}:${i + 1} → ${alvo}`);
  });
  return faltando;
}

describe("relatórios e painéis ignoram a lixeira", () => {
  const arquivos = readdirSync(PASTA).filter(
    (f) => f.endsWith(".functions.ts") && !f.endsWith(".test.ts"),
  );

  it("existe relatório para conferir", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  for (const arquivo of arquivos) {
    it(`${arquivo}: toda leitura filtra deleted_at`, () => {
      expect(consultasSemFiltro(arquivo)).toEqual([]);
    });
  }
});

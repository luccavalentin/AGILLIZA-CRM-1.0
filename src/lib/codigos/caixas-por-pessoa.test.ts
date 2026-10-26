/**
 * Servidor de e-mail: cada pessoa vê SÓ as caixas liberadas para ela (decisão 16 do docs/38).
 * O banco decide (pgTAP 762 do Agilliza Tech); aqui a guarda de que o servidor nunca lê as
 * mensagens/caixas por fora das funções que conferem a pessoa, e que toda ação numa caixa
 * confere antes se a pessoa a gere.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(join(__dirname, "codigos.functions.ts"), "utf8");

function corpo(nome: string): string {
  const i = fonte.indexOf(`export const ${nome} =`);
  expect(i, nome).toBeGreaterThan(-1);
  const j = fonte.indexOf("\nexport const ", i + 10);
  return fonte.slice(i, j === -1 ? undefined : j);
}

describe("servidor de e-mail: caixas por pessoa", () => {
  it("mensagens só pela função que confere a pessoa", () => {
    expect(fonte).not.toMatch(/from\(\s*"codigos_recebidos"/);
    expect(corpo("listarCodigos")).toMatch(/rpc\("codigos_mensagens",\s*\{\s*p_user: context\.userId/);
  });
  it("caixas, regras e pessoas só das caixas visíveis", () => {
    const c = corpo("listarCaixas");
    expect(c).toMatch(/caixasDaPessoa\(db, context\.userId\)/);
    for (const t of ["codigos_caixas", "codigos_filtros", "codigos_caixas_pessoas"]) {
      expect(c).toMatch(new RegExp(String.raw`from\("${t}"\)[\s\S]*?\.in\("(id|caixa_id)", ids\)`));
    }
  });
  it("toda ação numa caixa confere se a pessoa a gere", () => {
    for (const nome of ["pausarCaixa", "testarConexaoCaixa", "removerCaixa"]) {
      expect(corpo(nome), nome).toMatch(/exigirGerir\(db, data\.id, context\.userId\)/);
    }
    const s = corpo("salvarCaixa");
    expect(s).toMatch(/if \(data\.id\) await exigirGerir\(db, data\.id, context\.userId\)/);
    expect(s).toMatch(/rpc\("codigos_definir_pessoas"/);
  });
});

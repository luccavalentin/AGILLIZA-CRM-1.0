/**
 * Trava da porta única do financeiro (frente a5): toda ação tem guarda de permissão no
 * servidor, a não ser as poucas em que quem decide é o banco (a própria pessoa contesta a
 * comissão dela; estornar exige a ação do módulo do lançamento; anexo confere a pasta).
 * E nenhuma ação fala com rede ou provedor (C45j).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fonte = readFileSync(join(__dirname, "matriz.functions.ts"), "utf8");

function blocoDe(nome: "CONSULTAS" | "EXECUCOES") {
  const ini = fonte.indexOf(`const ${nome} = {`);
  const fim = fonte.indexOf("} satisfies Record<string, Acao>;", ini);
  return fonte.slice(ini, fim);
}

function acoes(bloco: string) {
  return [...bloco.matchAll(/^ {2}(\w+): \{[\s\S]*?(?=^ {2}\w+: \{|$(?![\s\S]))/gm)].map((m) => ({
    nome: m[1],
    corpo: m[0],
  }));
}

const DECIDIDAS_PELO_BANCO = new Set(["cuContestar", "estornar", "anexo"]);
const LEITURAS_DECIDIDAS_PELO_BANCO = new Set(["cadastros", "relatorio", "demonstrativo"]);

describe("porta única do financeiro", () => {
  it("toda gravação tem permissão no servidor (exceto as que o banco decide pela pessoa)", () => {
    const sem = acoes(blocoDe("EXECUCOES"))
      .filter((a) => /perm: \[\]/.test(a.corpo))
      .map((a) => a.nome);
    expect(sem.sort()).toEqual([...DECIDIDAS_PELO_BANCO].sort());
  });

  it("toda leitura tem permissão no servidor (exceto as que o banco filtra)", () => {
    const sem = acoes(blocoDe("CONSULTAS"))
      .filter((a) => /perm: \[\]/.test(a.corpo))
      .map((a) => a.nome);
    expect(sem.sort()).toEqual([...LEITURAS_DECIDIDAS_PELO_BANCO].sort());
  });

  it("toda ação chama uma função fin_* do banco (nada de SQL solto)", () => {
    for (const a of [...acoes(blocoDe("CONSULTAS")), ...acoes(blocoDe("EXECUCOES"))]) {
      expect(a.corpo, a.nome).toMatch(/fn: "fin_[a-z_]+"/);
    }
  });

  it("registrar pagamento/recebimento exige a ação do módulo do lançamento", () => {
    const baixa = acoes(blocoDe("EXECUCOES")).find((a) => a.nome === "baixa")!;
    expect(baixa.corpo).toContain('"receber"');
    expect(baixa.corpo).toContain('"pagar"');
    expect(baixa.corpo).toContain('"baixar"');
  });

  it("nenhum provedor, webhook ou cobrança no módulo (C45j)", () => {
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/asaas|webhook|fetch\(|https?:\/\//i);
  });
});

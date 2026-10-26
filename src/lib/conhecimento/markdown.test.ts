import { describe, expect, it } from "vitest";
import {
  analisarInline,
  analisarMarkdown,
  hrefSeguro,
  minutosDeLeitura,
  srcSeguro,
  sumario,
  textoPuro,
} from "./markdown";

describe("markdown dos artigos", () => {
  it("títulos, parágrafos, listas, tabela, aviso, citação, figura e código", () => {
    const md = [
      "# Guia do FGTS",
      "",
      "Texto com **negrito**, *itálico*, `código` e [link](https://caixa.gov.br).",
      "continua na mesma linha.",
      "",
      "## Quem pode usar",
      "- trabalhador com 3 anos de FGTS",
      "- sem imóvel na cidade",
      "",
      "1. Simule",
      "2. Envie os documentos",
      "",
      "| Banco | Taxa |",
      "|:--|--:|",
      "| Caixa | 10,99% |",
      "| Itaú | 11,49% |",
      "",
      "> [!ATENCAO] Confira a regra vigente.",
      "> Segunda linha do aviso.",
      "",
      "> Citação simples",
      "",
      "![Planta do imóvel](https://cdn.exemplo.com/planta.png)",
      "",
      "---",
      "```",
      "parcela = pv * i",
      "```",
    ].join("\n");
    const b = analisarMarkdown(md);
    expect(b.map((x) => x.t)).toEqual([
      "titulo",
      "paragrafo",
      "titulo",
      "lista",
      "lista",
      "tabela",
      "aviso",
      "citacao",
      "figura",
      "separador",
      "codigo",
    ]);
    const tabela = b[5] as Extract<(typeof b)[number], { t: "tabela" }>;
    expect(tabela.alinhamentos).toEqual(["esquerda", "direita"]);
    expect(tabela.linhas).toHaveLength(2);
    const aviso = b[6] as Extract<(typeof b)[number], { t: "aviso" }>;
    expect(aviso.tipo).toBe("atencao");
    expect((b[4] as { ordenada: boolean }).ordenada).toBe(true);
    expect(sumario(md)).toEqual([{ nivel: 2, texto: "Quem pode usar", ancora: "quem-pode-usar" }]);
  });

  it("link e imagem perigosos não viram link nem imagem (sem HTML, sem javascript:)", () => {
    const inl = analisarInline(
      "[clique](javascript:alert(1)) ![x](http://inseguro.com/a.png) <script>alert(1)</script>",
    );
    expect(inl.some((x) => x.t === "link" || x.t === "imagem")).toBe(false);
    expect(JSON.stringify(inl)).toContain("<script>"); // fica como TEXTO, que o React escapa
    expect(hrefSeguro("javascript:alert(1)")).toBeNull();
    expect(hrefSeguro("data:text/html,oi")).toBeNull();
    expect(hrefSeguro("//evil.com")).toBeNull();
    expect(hrefSeguro("/crm/clientes")).toBe("/crm/clientes");
    expect(hrefSeguro("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(srcSeguro("http://x.com/a.png")).toBeNull();
    expect(srcSeguro("https://x.com/a.png")).toBe("https://x.com/a.png");
  });

  it("marcação sem par vira texto e snake_case não vira itálico", () => {
    expect(textoPuro("valor_total e taxa_anual **sem fechar")).toBe(
      "valor_total e taxa_anual **sem fechar",
    );
    expect(analisarInline("a_b_c")).toEqual([{ t: "texto", v: "a_b_c" }]);
  });

  it("tempo de leitura e texto puro", () => {
    expect(minutosDeLeitura("palavra ".repeat(1000))).toBe(5);
    expect(minutosDeLeitura("")).toBe(1);
    expect(textoPuro("## Título\n\n**Forte** [link](https://a.com)")).toBe("Título Forte link");
  });
});

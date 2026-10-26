import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Wallet } from "lucide-react";
import { Icone3D, LADO_ICONE_3D, tomIcone3D } from "./icone-3d";
import { Indicador3D, VariacaoSelo } from "./indicador-3d";
import { Estado3D } from "./estado-3d";

describe("Icone3D", () => {
  it("monta face, lateral e sombra com tom e tamanho", () => {
    const html = renderToStaticMarkup(
      createElement(Icone3D, { icone: Wallet, tom: "sucesso", tamanho: "lg" }),
    );
    expect(html).toContain('class="i3d i3d-lg i3d-sucesso"');
    expect(html).toContain("i3d-face");
    expect(html).toContain("i3d-lado");
    expect(html).toContain("i3d-sombra");
    expect(html).toContain("<svg");
  });

  it("é decorativo sem rótulo e vira imagem com rótulo", () => {
    expect(renderToStaticMarkup(createElement(Icone3D, { icone: Wallet }))).toContain(
      'aria-hidden="true"',
    );
    const comRotulo = renderToStaticMarkup(
      createElement(Icone3D, { icone: Wallet, rotulo: "Carteira" }),
    );
    expect(comRotulo).toContain('role="img"');
    expect(comRotulo).toContain('aria-label="Carteira"');
    // O lucide marca o próprio <svg> como aria-hidden; a peça (primeira tag) não.
    expect(comRotulo.slice(0, comRotulo.indexOf(">"))).not.toContain("aria-hidden");
  });

  it("aceita glifo próprio no lugar do lucide", () => {
    const html = renderToStaticMarkup(
      createElement(Icone3D, null, createElement("svg", { "data-proprio": "1" })),
    );
    expect(html).toContain('data-proprio="1"');
  });

  it("traduz os tons antigos dos painéis e mantém os novos", () => {
    expect(tomIcone3D("brand")).toBe("marca");
    expect(tomIcone3D("danger")).toBe("perigo");
    expect(tomIcone3D("warning")).toBe("alerta");
    expect(tomIcone3D("violeta")).toBe("violeta");
    expect(tomIcone3D(undefined)).toBe("marca");
  });

  it("tamanhos ficam entre 20 e 48 px (sofisticado, nunca brinquedo)", () => {
    for (const lado of Object.values(LADO_ICONE_3D)) {
      expect(lado).toBeGreaterThanOrEqual(20);
      expect(lado).toBeLessThanOrEqual(48);
    }
  });
});

describe("Indicador3D e variação", () => {
  it("variação boa, ruim, estável e sem base", () => {
    const boa = renderToStaticMarkup(
      createElement(VariacaoSelo, { v: { pct: 12, sobe: true, bom: true } }),
    );
    expect(boa).toContain("i3d-variacao-boa");
    expect(boa).toContain("+12%");
    const ruim = renderToStaticMarkup(
      createElement(VariacaoSelo, { v: { pct: 8, sobe: true, bom: false } }),
    );
    expect(ruim).toContain("i3d-variacao-ruim");
    const queda = renderToStaticMarkup(
      createElement(VariacaoSelo, { v: { pct: 3.25, sobe: false, bom: true } }),
    );
    expect(queda).toContain("−3,3%");
    expect(renderToStaticMarkup(createElement(VariacaoSelo, { v: { pct: 0 } }))).toContain(
      "estável",
    );
    expect(renderToStaticMarkup(createElement(VariacaoSelo, { v: { pct: null } }))).toContain(
      "novo",
    );
  });

  it("indicador sem link é um bloco; com clique é botão sem o relevo genérico", () => {
    const bloco = renderToStaticMarkup(
      createElement(Indicador3D, { rotulo: "Propostas", valor: "10" }),
    );
    expect(bloco.startsWith("<div")).toBe(true);
    const botao = renderToStaticMarkup(
      createElement(Indicador3D, { rotulo: "Propostas", valor: "10", onClick: () => {} }),
    );
    expect(botao.startsWith("<button")).toBe(true);
    expect(botao).toContain('data-depth="off"');
    expect(botao).toContain("i3d-indicador-seta");
  });

  it("carregando mostra esqueleto e esconde o valor", () => {
    const html = renderToStaticMarkup(
      createElement(Indicador3D, { rotulo: "Propostas", valor: "999", carregando: true }),
    );
    expect(html).toContain("i3d-indicador-esqueleto");
    expect(html).not.toContain("999");
  });
});

describe("Estado3D", () => {
  it("erro é alerta para leitor de tela; carregando é status", () => {
    expect(renderToStaticMarkup(createElement(Estado3D, { tipo: "erro" }))).toContain(
      'role="alert"',
    );
    const c = renderToStaticMarkup(createElement(Estado3D, { tipo: "carregando" }));
    expect(c).toContain('role="status"');
    expect(c).toContain("i3d-girando");
  });
});

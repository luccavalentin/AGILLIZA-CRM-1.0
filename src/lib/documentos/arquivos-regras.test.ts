import { describe, expect, it } from "vitest";
import {
  caminhoNoBucket,
  formatarBytes,
  nomeLivre,
  nomeParaCaminho,
  normalizarEtiquetas,
  planejarEnvio,
  separarExtensao,
  situacaoCota,
  tipoDePrevia,
  validarNome,
} from "./arquivos-regras";

describe("arquivos-regras", () => {
  it("valida nome como o banco", () => {
    expect(validarNome("  ")).toBeTruthy();
    expect(validarNome("a/b")).toBeTruthy();
    expect(validarNome("a\\b")).toBeTruthy();
    expect(validarNome("x".repeat(301))).toBeTruthy();
    expect(validarNome("Contrato Itaú.pdf")).toBeNull();
  });

  it("separa extensão sem quebrar nomes estranhos", () => {
    expect(separarExtensao("a.b.pdf")).toEqual(["a.b", ".pdf"]);
    expect(separarExtensao(".env")).toEqual([".env", ""]);
    expect(separarExtensao("sem")).toEqual(["sem", ""]);
    expect(separarExtensao("ponto.")).toEqual(["ponto.", ""]);
  });

  it("acha nome livre sem diferenciar maiúsculas", () => {
    expect(nomeLivre("c.pdf", ["d.pdf"])).toBe("c.pdf");
    expect(nomeLivre("c.pdf", ["C.PDF"])).toBe("c (2).pdf");
    expect(nomeLivre("c.pdf", ["c.pdf", "c (2).pdf"])).toBe("c (3).pdf");
  });

  it("monta caminho sempre dentro do correspondente, sem travessia", () => {
    const c = caminhoNoBucket("corr", "../../etc/passwd", "id1");
    expect(c.startsWith("corr/id1-")).toBe(true);
    expect(c.slice("corr/".length)).not.toContain("/");
    expect(nomeParaCaminho("Ação ç ã.pdf")).toBe("Acao_c_a.pdf");
    expect(nomeParaCaminho("////")).toBe("_");
    expect(nomeParaCaminho("")).toBe("arquivo");
  });

  it("classifica prévia", () => {
    expect(tipoDePrevia("a.PDF")).toBe("pdf");
    expect(tipoDePrevia("foto", "image/jpeg")).toBe("imagem");
    expect(tipoDePrevia("planilha.xlsx")).toBe("outro");
  });

  it("formata bytes em pt-BR", () => {
    expect(formatarBytes(0)).toBe("0 B");
    expect(formatarBytes(null)).toBe("—");
    expect(formatarBytes(1536)).toBe("1,5 KB");
    expect(formatarBytes(10 * 1024 ** 3)).toBe("10 GB");
  });

  it("situação da cota", () => {
    expect(situacaoCota(50, 100)).toEqual({ percentual: 50, faixa: "ok" });
    expect(situacaoCota(85, 100).faixa).toBe("atencao");
    expect(situacaoCota(200, 100)).toEqual({ percentual: 100, faixa: "cheio" });
    expect(situacaoCota(1, 0).percentual).toBe(0);
  });

  it("normaliza etiquetas", () => {
    expect(normalizarEtiquetas([" Itaú ", "itaú", "", "B"])).toEqual(["b", "itaú"]);
    expect(normalizarEtiquetas(Array.from({ length: 20 }, (_, i) => `e${i}`))).toHaveLength(10);
  });

  it("planeja envio com conflitos (inclusive dentro do próprio lote)", () => {
    expect(planejarEnvio(["a.pdf", "b.pdf"], ["A.pdf"], "versao")).toEqual([
      { nome: "a.pdf", novaVersao: true, pular: false },
      { nome: "b.pdf", novaVersao: false, pular: false },
    ]);
    expect(planejarEnvio(["a.pdf", "a.pdf"], ["a.pdf"], "manter").map((p) => p.nome)).toEqual([
      "a (2).pdf",
      "a (3).pdf",
    ]);
    expect(planejarEnvio(["a.pdf", "a.pdf"], [], "manter").map((p) => p.nome)).toEqual([
      "a.pdf",
      "a (2).pdf",
    ]);
    expect(planejarEnvio(["a.pdf"], ["a.pdf"], "pular")[0].pular).toBe(true);
  });
});

describe("lixeira esvazia sozinha", () => {
  const agora = new Date("2026-10-26T12:00:00Z");
  it("conta os dias que faltam pelo prazo do correspondente", async () => {
    const { diasParaSairDaLixeira } = await import("./arquivos-regras");
    expect(diasParaSairDaLixeira("2026-10-26T12:00:00Z", 30, agora)).toBe(30);
    expect(diasParaSairDaLixeira("2026-10-20T12:00:00Z", 7, agora)).toBe(1);
    expect(diasParaSairDaLixeira("2026-09-01T00:00:00Z", 30, agora)).toBe(0);
  });
  it("entrada torta não inventa prazo", async () => {
    const { diasParaSairDaLixeira } = await import("./arquivos-regras");
    expect(diasParaSairDaLixeira(null, 30, agora)).toBeNull();
    expect(diasParaSairDaLixeira("ontem", 30, agora)).toBeNull();
    expect(diasParaSairDaLixeira("2026-10-26T12:00:00Z", 0, agora)).toBeNull();
  });
});

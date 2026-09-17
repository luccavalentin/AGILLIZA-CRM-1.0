import { describe, expect, it } from "vitest";
import { nomeArquivoSeguro } from "./nome-arquivo";

describe("nomeArquivoSeguro", () => {
  it("remove acentos e espaços (caso Certidão de Casamento)", () => {
    expect(nomeArquivoSeguro("Certidão de Casamento.pdf")).toBe("Certidao-de-Casamento.pdf");
  });

  it("troca caracteres que o Storage recusa e mantém a extensão", () => {
    expect(nomeArquivoSeguro("RG (frente & verso) nº 2.JPEG")).toBe("RG-frente-verso-no-2.jpeg");
    expect(nomeArquivoSeguro("comprovante#endereço%2026.png")).toBe(
      "comprovante-endereco-2026.png",
    );
  });

  it("nunca devolve vazio", () => {
    expect(nomeArquivoSeguro("ção.pdf")).toBe("cao.pdf");
    expect(nomeArquivoSeguro("###.pdf")).toBe("arquivo.pdf");
    expect(nomeArquivoSeguro("")).toBe("arquivo");
  });

  it("limita o tamanho sem perder a extensão", () => {
    const longo = `${"a".repeat(200)}.pdf`;
    const r = nomeArquivoSeguro(longo);
    expect(r.length).toBeLessThanOrEqual(80);
    expect(r.endsWith(".pdf")).toBe(true);
  });
});

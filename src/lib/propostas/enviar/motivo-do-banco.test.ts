import { describe, expect, it } from "vitest";
import { motivoDoBanco } from "./helpers-retorno.server";

describe("motivoDoBanco", () => {
  it("transforma o código de situação do banco em motivo legível", () => {
    expect(motivoDoBanco({ codigoSituacaoBanco: "514 - ANALISE AUTOMATICA DESFAVORAVEL" })).toBe(
      "514 – Analise automatica desfavoravel",
    );
  });
  it("aceita texto sem código numérico", () => {
    expect(motivoDoBanco({ codigoSituacaoBanco: "PENDENTE DE DOCUMENTOS" })).toBe(
      "Pendente de documentos",
    );
  });
  it("ignora estado técnico de uma letra e vazio", () => {
    expect(motivoDoBanco({ codigoSituacaoBanco: "R" })).toBeNull();
    expect(motivoDoBanco({ codigoSituacaoBanco: null })).toBeNull();
    expect(motivoDoBanco(null)).toBeNull();
  });
});

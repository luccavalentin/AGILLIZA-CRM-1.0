import { describe, expect, it } from "vitest";
import { formatarMoedaInput, parseMoeda } from "./moeda";

describe("parseMoeda", () => {
  it("número vindo do banco", () => {
    expect(parseMoeda(2500.75)).toBe(2500.75);
  });
  it("ponto decimal (valor do banco como texto)", () => {
    expect(parseMoeda("2500.75")).toBe(2500.75);
  });
  it("vírgula decimal", () => {
    expect(parseMoeda("2500,75")).toBe(2500.75);
  });
  it("pt-BR com milhar", () => {
    expect(parseMoeda("2.500,75")).toBe(2500.75);
    expect(parseMoeda("R$ 1.234.567,89")).toBe(1234567.89);
  });
  it("ponto de milhar sem centavos", () => {
    expect(parseMoeda("2.500")).toBe(2500);
    expect(parseMoeda("1.234.567")).toBe(1234567);
  });
  it("formato com vírgula de milhar e ponto decimal", () => {
    expect(parseMoeda("2,500.75")).toBe(2500.75);
  });
  it("inteiro e vazio", () => {
    expect(parseMoeda("2500")).toBe(2500);
    expect(parseMoeda("")).toBe(0);
    expect(parseMoeda(null)).toBe(0);
    expect(parseMoeda("abc")).toBe(0);
  });
});

describe("formatarMoedaInput", () => {
  it("formata o valor do banco em pt-BR e volta ao mesmo número", () => {
    const txt = formatarMoedaInput(2500.75);
    expect(txt).toBe("2.500,75");
    expect(parseMoeda(txt)).toBe(2500.75);
    expect(parseMoeda(formatarMoedaInput("2500.75"))).toBe(2500.75);
  });
  it("vazio continua vazio", () => {
    expect(formatarMoedaInput(null)).toBe("");
  });
});

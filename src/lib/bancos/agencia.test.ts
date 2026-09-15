import { describe, expect, it } from "vitest";
import { erroAgencia, normalizarAgencia } from "./agencia";

describe("normalizarAgencia", () => {
  it("completa a agência do Bradesco com zeros à esquerda", () => {
    expect(normalizarAgencia("347", "Bradesco")).toBe("0347");
    expect(normalizarAgencia("7", "Banco Bradesco")).toBe("0007");
    expect(normalizarAgencia("0347", "Bradesco")).toBe("0347");
  });

  it("remove o que não é dígito", () => {
    expect(normalizarAgencia("03-47", "Bradesco")).toBe("0347");
    expect(normalizarAgencia(" 12a3 ", "Itaú")).toBe("123");
  });

  it("não completa agência de outros bancos", () => {
    expect(normalizarAgencia("347", "Itaú")).toBe("347");
    expect(normalizarAgencia("347", "Santander")).toBe("347");
    expect(normalizarAgencia("347")).toBe("347");
  });

  it("vazia continua vazia (sem agência)", () => {
    expect(normalizarAgencia("", "Bradesco")).toBe("");
    expect(normalizarAgencia(null, "Bradesco")).toBe("");
    expect(normalizarAgencia(undefined, "Bradesco")).toBe("");
  });
});

describe("erroAgencia", () => {
  it("recusa mais de 4 dígitos no Bradesco", () => {
    expect(erroAgencia("12345", "Bradesco")).toMatch(/4 dígitos/);
    expect(erroAgencia("1234", "Bradesco")).toBeNull();
    expect(erroAgencia("347", "Bradesco")).toBeNull();
  });

  it("aceita até 5 dígitos nos demais bancos", () => {
    expect(erroAgencia("12345", "Itaú")).toBeNull();
    expect(erroAgencia("123456", "Itaú")).toMatch(/até 5/);
    expect(erroAgencia("", "Itaú")).toBeNull();
  });
});

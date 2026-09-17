import { describe, expect, it } from "vitest";
import { dadosBancariosParticipante, erroAgencia, normalizarAgencia } from "./agencia";

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

describe("dadosBancariosParticipante", () => {
  const base = { idBancoDestino: 45, nomeBanco: "Bradesco" };

  it("leva a agência escolhida ao proponente principal, no banco de destino", () => {
    expect(
      dadosBancariosParticipante({ ...base, participante: {}, ehPrincipal: true, agencia: "145" }),
    ).toEqual({
      idBanco: 45,
      codigoAgencia: "0145",
      codigoContaCorrente: undefined,
      digitoContaCorrente: undefined,
    });
  });

  it("usa a conta conferida quando informada", () => {
    expect(
      dadosBancariosParticipante({
        ...base,
        participante: { idBanco: 1, codigoContaCorrente: "999" },
        ehPrincipal: true,
        agencia: "145",
        contaCorrente: "12.345",
        digitoConta: "6",
      }),
    ).toEqual({
      idBanco: 45,
      codigoAgencia: "0145",
      codigoContaCorrente: "12345",
      digitoContaCorrente: "6",
    });
  });

  it("mantém a conta só quando já era do mesmo banco", () => {
    const participante = {
      idBanco: 45,
      codigoAgencia: "9999",
      codigoContaCorrente: "123",
      digitoContaCorrente: "4",
    };
    expect(
      dadosBancariosParticipante({ ...base, participante, ehPrincipal: true, agencia: "0145" }),
    ).toMatchObject({
      idBanco: 45,
      codigoAgencia: "0145",
      codigoContaCorrente: "123",
      digitoContaCorrente: "4",
    });
    expect(
      dadosBancariosParticipante({
        ...base,
        participante: { ...participante, idBanco: 33 },
        ehPrincipal: true,
        agencia: "0145",
      }),
    ).toMatchObject({ idBanco: 45, codigoContaCorrente: undefined });
  });

  it("sem agência ou fora do principal, preserva o que o participante já tinha", () => {
    const participante = { idBanco: 341, codigoAgencia: "0500" };
    expect(
      dadosBancariosParticipante({ ...base, participante, ehPrincipal: false, agencia: "0145" }),
    ).toMatchObject({ idBanco: 341, codigoAgencia: "0500" });
    expect(
      dadosBancariosParticipante({ ...base, participante, ehPrincipal: true, agencia: "" }),
    ).toMatchObject({ idBanco: 341, codigoAgencia: "0500" });
    expect(
      dadosBancariosParticipante({ ...base, participante: {}, ehPrincipal: true, agencia: null }),
    ).toEqual({
      idBanco: undefined,
      codigoAgencia: undefined,
      codigoContaCorrente: undefined,
      digitoContaCorrente: undefined,
    });
  });
});

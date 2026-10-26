import { describe, expect, it } from "vitest";
import { numeroIdH, propostaComIdH, textoIdH } from "./id-h";

describe("ID H. (C33)", () => {
  it("número vira 'ID H. 12345'", () => {
    expect(textoIdH({ homefin_id_oportunidade: 12345 })).toBe("ID H. 12345");
    expect(textoIdH({ homefin_id_oportunidade: "67890" })).toBe("ID H. 67890");
    expect(textoIdH(" 555 ")).toBe("ID H. 555");
  });
  it("sem oportunidade: traço discreto, nunca o número interno", () => {
    expect(textoIdH({ homefin_id_oportunidade: null })).toBe("ID H. —");
    expect(textoIdH({})).toBe("ID H. —");
    expect(textoIdH(null)).toBe("ID H. —");
    expect(textoIdH(undefined)).toBe("ID H. —");
    expect(textoIdH({ numero_proposta: "PRO-000123" } as never)).toBe("ID H. —");
  });
  it("zero, texto torto e injeção não viram ID", () => {
    expect(numeroIdH({ homefin_id_oportunidade: 0 })).toBeNull();
    expect(numeroIdH("000")).toBeNull();
    expect(numeroIdH("12a3")).toBeNull();
    expect(numeroIdH("<script>")).toBeNull();
    expect(numeroIdH("1".repeat(19))).toBeNull();
    expect(numeroIdH("-5")).toBeNull();
    expect(numeroIdH("1.5")).toBeNull();
  });
  it("zeros à esquerda somem", () => {
    expect(numeroIdH("00042")).toBe("42");
  });
  it("frases", () => {
    expect(propostaComIdH({ homefin_id_oportunidade: 9 })).toBe("Proposta ID H. 9");
    expect(propostaComIdH(null)).toBe("Proposta");
  });
  it("nunca escreve o nome da integração", () => {
    expect(textoIdH(1).toLowerCase()).not.toContain("homefin");
  });
});

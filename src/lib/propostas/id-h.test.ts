import { describe, expect, it } from "vitest";
import { numeroIdH, propostaComIdH, textoIdH, numerosDoCartaoAssinante } from "./id-h";

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

describe("cartão de proposta de assinante no kanban (c1)", () => {
  it("com o id da oportunidade, mostra ID H. no lugar do PRO-…", () => {
    const r = numerosDoCartaoAssinante({ codigo: "PRO-000123", id_h: "4567" });
    expect(r.numero).toBe("ID H. 4567");
    expect(JSON.stringify(r)).not.toContain("PRO-");
  });
  it("com nº do banco, o banco vem primeiro e o ID H. ao lado", () => {
    expect(numerosDoCartaoAssinante({ codigo: "PRO-1", numero_proposta_banco: "998877", id_h: "45" })).toEqual({
      numero: "Nº banco 998877",
      numeroSecundario: "ID H. 45",
    });
  });
  it("sem id da oportunidade (ainda não enviada): o código fica até existir o ID H.", () => {
    expect(numerosDoCartaoAssinante({ codigo: "PRO-9", id_h: null })).toEqual({ numero: "PRO-9", numeroSecundario: null });
    expect(numerosDoCartaoAssinante({ codigo: "PRO-9", id_h: "0" }).numero).toBe("PRO-9");
    expect(numerosDoCartaoAssinante({ codigo: "PRO-9", id_h: "<b>1</b>" }).numero).toBe("PRO-9");
  });
  it("o número no Agilliza continua como secundário", () => {
    expect(numerosDoCartaoAssinante({ codigo: "PRO-9", id_h: "77", numero_agilliza: "15" }).numeroSecundario).toBe(
      "No Agilliza #15",
    );
  });
  it("nunca escreve o nome da integração", () => {
    expect(JSON.stringify(numerosDoCartaoAssinante({ codigo: "PRO-1", id_h: "1" })).toLowerCase()).not.toContain("homefin");
  });
});

import { describe, expect, it } from "vitest";
import { estadoCivilCrmParaCodigo } from "./simulacoes.functions";

// Esta é a conversão usada no payload que cria a oportunidade na HomeFin
// (`simulacao/enviar.server.ts`). Depois da migration de 11/09 o banco guarda
// código ("CA"), e a versão antiga só conhecia palavras: todo casado ia como
// solteiro.
describe("estadoCivilCrmParaCodigo (payload da oportunidade)", () => {
  it("aceita o código gravado pela migration de 11/09", () => {
    for (const codigo of ["S", "CA", "UE", "DI", "VI", "SL"]) {
      expect(estadoCivilCrmParaCodigo(codigo)).toBe(codigo);
    }
  });

  it("continua aceitando as palavras do CRM", () => {
    expect(estadoCivilCrmParaCodigo("casado")).toBe("CA");
    expect(estadoCivilCrmParaCodigo("uniao_estavel")).toBe("UE");
    expect(estadoCivilCrmParaCodigo("solteiro")).toBe("S");
    expect(estadoCivilCrmParaCodigo("divorciado")).toBe("DI");
    expect(estadoCivilCrmParaCodigo("viuvo")).toBe("VI");
    expect(estadoCivilCrmParaCodigo("separado")).toBe("SL");
  });

  it("tolera caixa e espaços", () => {
    expect(estadoCivilCrmParaCodigo("ca")).toBe("CA");
    expect(estadoCivilCrmParaCodigo(" CA ")).toBe("CA");
    expect(estadoCivilCrmParaCodigo("Casado")).toBe("CA");
  });

  it("vazio ou desconhecido vira S, como antes", () => {
    expect(estadoCivilCrmParaCodigo(null)).toBe("S");
    expect(estadoCivilCrmParaCodigo(undefined)).toBe("S");
    expect(estadoCivilCrmParaCodigo("")).toBe("S");
    expect(estadoCivilCrmParaCodigo("xyz")).toBe("S");
  });
});

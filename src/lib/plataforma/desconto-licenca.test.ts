import { describe, expect, it } from "vitest";
import { DESCONTO_INICIAL, paraDesconto, resumoDesconto } from "./desconto-licenca";

const com = (p: Partial<typeof DESCONTO_INICIAL>) => paraDesconto({ ...DESCONTO_INICIAL, ...p });

describe("desconto na licença: o que a tela digita", () => {
  it("lê porcentagem com vírgula ou ponto", () => {
    expect(com({ valor: "20" })).toEqual({ tipo: "percentual", valor: 20, faturas: 1 });
    expect(com({ valor: "12,5" })?.valor).toBe(12.5);
    expect(com({ valor: "12.5" })?.valor).toBe(12.5);
  });

  it("lê reais com milhar", () => {
    expect(com({ tipo: "valor", valor: "1.250,00" })?.valor).toBe(1250);
    expect(com({ tipo: "valor", valor: "100" })?.valor).toBe(100);
  });

  it("recusa o que o servidor recusaria", () => {
    expect(com({ valor: "" })).toBeNull();
    expect(com({ valor: "0" })).toBeNull();
    expect(com({ valor: "-5" })).toBeNull();
    expect(com({ valor: "100,01" })).toBeNull();
    expect(com({ valor: "10,555" })).toBeNull();
    expect(com({ valor: "abc" })).toBeNull();
    expect(com({ tipo: "valor", valor: "1.250" })).toBeNull(); // ambíguo: pede a vírgula
    expect(com({ valor: "10", duracao: "proximas", faturas: "0" })).toBeNull();
    expect(com({ valor: "10", duracao: "proximas", faturas: "121" })).toBeNull();
    expect(com({ valor: "10", duracao: "proximas", faturas: "2,5" })).toBeNull();
  });

  it("aceita 100% e a duração escolhida", () => {
    expect(com({ valor: "100" })?.valor).toBe(100);
    expect(com({ valor: "10", duracao: "proximas", faturas: "6" })?.faturas).toBe(6);
    expect(com({ valor: "10", duracao: "sempre" })?.faturas).toBeNull();
  });

  it("resume em português", () => {
    expect(resumoDesconto(com({ valor: "20" }))).toBe("20% de desconto na próxima fatura paga.");
    expect(resumoDesconto(com({ valor: "12,5", duracao: "proximas", faturas: "3" }))).toBe(
      "12,5% de desconto em cada uma das próximas 3 faturas pagas.",
    );
    expect(resumoDesconto(com({ tipo: "valor", valor: "100", duracao: "sempre" }))).toMatch(
      /^R\$\s?100,00 de desconto em todas as faturas, até alguém encerrar\.$/,
    );
    expect(resumoDesconto(null)).toBeNull();
  });
});

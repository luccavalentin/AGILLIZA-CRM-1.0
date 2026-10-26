import { describe, expect, it } from "vitest";
import { esquemaDecisao, esquemaPedido, lerValor, resumoCompras } from "./compras-regras";

const ID = "11111111-1111-4111-8111-111111111111";

describe("valor do pedido", () => {
  it("aceita pt-BR, ponto do banco e o prefixo R$", () => {
    expect(lerValor("1.500,50")).toBe(1500.5);
    expect(lerValor("1500.5")).toBe(1500.5);
    expect(lerValor("R$ 2.000,00")).toBe(2000);
  });
  it("recusa texto, sinal, três casas e vazio", () => {
    for (const v of ["", "abc", "-10", "1,234,5", "10,999", "1e5"]) {
      expect(Number.isNaN(lerValor(v)), v).toBe(true);
    }
  });
  it("pedido: valor positivo e com teto; descrição de 3 a 500", () => {
    expect(esquemaPedido.safeParse({ descricao: "Cadeiras", valor: 0 }).success).toBe(false);
    expect(esquemaPedido.safeParse({ descricao: "Cadeiras", valor: Number.NaN }).success).toBe(
      false,
    );
    expect(esquemaPedido.safeParse({ descricao: "Cadeiras", valor: 50_000_000 }).success).toBe(
      false,
    );
    expect(esquemaPedido.safeParse({ descricao: "  ab ", valor: 10 }).success).toBe(false);
    expect(esquemaPedido.safeParse({ descricao: "x".repeat(501), valor: 10 }).success).toBe(false);
    expect(esquemaPedido.safeParse({ descricao: "Cadeiras", valor: 1999.9 }).success).toBe(true);
  });
});

describe("decisão do pedido", () => {
  it("recusar exige motivo de pelo menos 5 caracteres", () => {
    expect(esquemaDecisao.safeParse({ id: ID, aprovar: false }).success).toBe(false);
    expect(
      esquemaDecisao.safeParse({ id: ID, aprovar: false, observacao: "   não  " }).success,
    ).toBe(false);
    expect(
      esquemaDecisao.safeParse({ id: ID, aprovar: false, observacao: "Fora do orçamento" }).success,
    ).toBe(true);
  });
  it("aprovar não exige observação", () => {
    expect(esquemaDecisao.safeParse({ id: ID, aprovar: true }).success).toBe(true);
  });
  it("id torto é recusado", () => {
    expect(esquemaDecisao.safeParse({ id: "1; drop table", aprovar: true }).success).toBe(false);
  });
});

describe("resumo", () => {
  it("conta e soma por situação", () => {
    expect(
      resumoCompras([
        { status: "pendente", valor: 100 },
        { status: "pendente", valor: 50.5 },
        { status: "aprovada", valor: 1000 },
        { status: "recusada", valor: 9 },
      ]),
    ).toEqual({
      total: 4,
      pendentes: 2,
      valorPendente: 150.5,
      aprovadas: 1,
      valorAprovado: 1000,
      recusadas: 1,
    });
  });
});

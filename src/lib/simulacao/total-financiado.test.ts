import { describe, expect, it } from "vitest";
import { totalFinanciadoBanco } from "./origem-dados";

/**
 * Retornos reais da SIM-005285 (09/09/2026): imóvel 780.000, financiamento
 * 130.000 e 39.000 de despesas financiadas — total pedido de 169.000.
 *
 * Cada banco preenche campos diferentes, e era isso que quebrava a conta:
 * `valorTotalFinanciamento` já embute as despesas, `valorFinanciamentoBanco`
 * não. Somar despesas sobre o primeiro conta duas vezes.
 */
describe("totalFinanciadoBanco", () => {
  it("Bradesco: devolve a base, então as despesas somam", () => {
    const b = {
      raw_response: {
        valorFinanciamentoBanco: 130_000,
        valorTotalFinanciamento: 169_000,
        valorDespesasFinanciadas: 39_000,
      },
    };
    expect(totalFinanciadoBanco(b)).toBe(169_000);
  });

  it("Itaú: só tem o total — não pode somar despesa de novo (exibia 208.000)", () => {
    const b = {
      raw_response: {
        valorTotalFinanciamento: 169_000,
        valorDespesasFinanciadas: 39_000,
      },
    };
    expect(totalFinanciadoBanco(b)).toBe(169_000);
  });

  it("Santander: mostra o que o banco usou (130.000), não o que pedimos", () => {
    // O provedor descartou as despesas. A tela exibia 169.000 — o valor
    // pedido — ao lado de uma parcela de R$ 1.628,64, que é de 130.000.
    const b = {
      raw_response: {
        valorTotalFinanciamento: 130_000,
        valorDespesasFinanciadas: 39_000,
      },
    };
    expect(totalFinanciadoBanco(b)).toBe(130_000);
  });

  it("sem retorno do banco, devolve null (a tela mostra travessão)", () => {
    expect(totalFinanciadoBanco({ raw_response: null })).toBeNull();
    expect(totalFinanciadoBanco({})).toBeNull();
  });

  it("sem despesas, o total é o próprio valor financiado", () => {
    const b = {
      raw_response: { valorTotalFinanciamento: 280_000, valorDespesasFinanciadas: 0 },
    };
    expect(totalFinanciadoBanco(b)).toBe(280_000);
  });
});

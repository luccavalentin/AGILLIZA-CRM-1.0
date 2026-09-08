import { describe, expect, it } from "vitest";
import { calcularPlano } from "./detalhe-banco";

/**
 * Conferido contra o extrato oficial do Santander de 08/09/2026
 * (Eduardo Augusto Rocha): imóvel R$ 780.000, financiamento R$ 130.000,
 * despesas financiadas R$ 39.000, total R$ 169.000, prazo 420, SAC,
 * 0,9256% a.m. — primeira prestação R$ 2.098,03, sendo R$ 402,38 de
 * amortização, R$ 1.564,21 de juros e R$ 131,44 de encargos
 * (DFI 39,00 + MIP 67,44 + tarifa 25,00).
 *
 * O plano tem de amortizar o TOTAL financiado, não o valor solicitado. Como
 * as despesas nunca chegavam ao provedor (iam no POST, que as descarta, em
 * vez do PUT), o banco devolvia o plano de 130.000 e a parcela saía muito
 * abaixo da real.
 */
describe("plano de pagamento com despesas financiadas", () => {
  const PRAZO = 420;
  // Taxa implícita do próprio extrato (1.564,21 / 169.000). O PDF do banco
  // arredonda para 0,93% na exibição e o nosso para 0,9256%.
  const TAXA_MES = 0.925568;

  it("amortiza o total financiado, batendo com o extrato do banco", () => {
    const plano = calcularPlano(169_000, PRAZO, TAXA_MES, "SAC", "2026-10-08");

    expect(plano[0].amortizacao).toBeCloseTo(402.38, 2);
    expect(plano[0].juros).toBeCloseTo(1564.21, 2);
    expect(plano[0].saldoDevedor).toBeCloseTo(168_597.62, 2);

    // Amortização + juros, sem encargos. Somados os R$ 131,44 de DFI, MIP e
    // tarifa, chega-se aos R$ 2.098,03 da primeira prestação do extrato.
    expect(plano[0].parcela).toBeCloseTo(1966.59, 2);
    expect(plano[0].parcela + 131.44).toBeCloseTo(2098.03, 2);
  });

  it("regressão: amortizar só o valor solicitado subestima a parcela", () => {
    const errado = calcularPlano(130_000, PRAZO, TAXA_MES, "SAC", "2026-10-08");
    const certo = calcularPlano(169_000, PRAZO, TAXA_MES, "SAC", "2026-10-08");

    // Base errada: amortização de 130.000/420 em vez de 169.000/420.
    expect(errado[0].amortizacao).toBeCloseTo(309.52, 2);
    expect(certo[0].parcela - errado[0].parcela).toBeGreaterThan(400);
  });

  it("a última parcela zera o saldo devedor", () => {
    const plano = calcularPlano(169_000, PRAZO, TAXA_MES, "SAC", "2026-10-08");
    expect(plano).toHaveLength(PRAZO);
    expect(plano[PRAZO - 1].saldoDevedor).toBeCloseTo(0, 2);
  });
});

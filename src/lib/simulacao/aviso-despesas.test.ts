import { describe, expect, it } from "vitest";
import { avisoDespesasDescartadas } from "./aviso-despesas";

describe("avisoDespesasDescartadas", () => {
  it("avisa quando o banco calcula sobre menos do que foi pedido", () => {
    // SIM-005330 real: pedido 262.500 + 17.500; Santander devolveu 262.500.
    const aviso = avisoDespesasDescartadas({
      nomeBanco: "Santander",
      totalPedido: 280_000,
      totalRetornado: 262_500,
      despesasFinanciadas: 17_500,
    });
    expect(aviso).toContain("Santander");
    expect(aviso).toContain("262.500,00");
    expect(aviso).toContain("17.500,00");
  });

  it("não avisa quando o banco honra as despesas", () => {
    // Mesmo caso, Itaú: devolveu os 280.000.
    expect(
      avisoDespesasDescartadas({
        nomeBanco: "Itaú",
        totalPedido: 280_000,
        totalRetornado: 280_000,
        despesasFinanciadas: 17_500,
      }),
    ).toBeNull();
  });

  it("não avisa quando não há despesas financiadas", () => {
    expect(
      avisoDespesasDescartadas({
        nomeBanco: "Santander",
        totalPedido: 240_000,
        totalRetornado: 200_000,
        despesasFinanciadas: 0,
      }),
    ).toBeNull();
  });

  it("não avisa quando o banco ainda não devolveu total", () => {
    expect(
      avisoDespesasDescartadas({
        nomeBanco: "Santander",
        totalPedido: 280_000,
        totalRetornado: 0,
        despesasFinanciadas: 17_500,
      }),
    ).toBeNull();
  });

  it("ignora diferença de centavo (arredondamento do provedor)", () => {
    expect(
      avisoDespesasDescartadas({
        nomeBanco: "Bradesco",
        totalPedido: 280_000,
        totalRetornado: 279_999.995,
        despesasFinanciadas: 17_500,
      }),
    ).toBeNull();
  });
});

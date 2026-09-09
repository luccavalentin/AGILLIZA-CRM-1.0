import { describe, expect, it } from "vitest";
import { despesasParaOBanco } from "./despesas-por-banco";

const santander = { codigo_banco: "033", nome_banco: "Santander" };
const itau = { codigo_banco: "341", nome_banco: "Itaú" };

describe("despesasParaOBanco", () => {
  it("embute as custas no financiamento do Santander", () => {
    // SIM-005331 real: 262.500 + 17.500. A integração do Santander recalcula
    // sobre `valorFinanciamento` e devolvia 262.500.
    const r = despesasParaOBanco({
      banco: santander,
      valorFinanciamento: 262_500,
      valorDespesasFinanciadas: 17_500,
    });
    expect(r.valorFinanciamento).toBe(280_000);
    expect(r.valorTotalFinanciamento).toBe(280_000);
    // Zerado para não haver chance de somar duas vezes.
    expect(r.valorDespesasFinanciadas).toBe(0);
    expect(r.fgFinanciarDespesas).toBe("N");
    expect(r.embutidas).toBe(true);
  });

  it("mantém os campos separados nos bancos que respeitam o total", () => {
    const r = despesasParaOBanco({
      banco: itau,
      valorFinanciamento: 262_500,
      valorDespesasFinanciadas: 17_500,
    });
    expect(r.valorFinanciamento).toBe(262_500);
    expect(r.valorDespesasFinanciadas).toBe(17_500);
    expect(r.valorTotalFinanciamento).toBe(280_000);
    expect(r.fgFinanciarDespesas).toBe("S");
    expect(r.embutidas).toBe(false);
  });

  it("sem custas, nada muda nem para o Santander", () => {
    const r = despesasParaOBanco({
      banco: santander,
      valorFinanciamento: 240_000,
      valorDespesasFinanciadas: 0,
    });
    expect(r.valorFinanciamento).toBe(240_000);
    expect(r.valorTotalFinanciamento).toBe(240_000);
    expect(r.fgFinanciarDespesas).toBe("N");
    expect(r.embutidas).toBe(false);
  });
});

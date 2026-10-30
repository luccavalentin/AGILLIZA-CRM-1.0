import { describe, expect, it } from "vitest";
import { camposRetornoBanco } from "./campos-retorno-banco";

describe("camposRetornoBanco", () => {
  it("leva para as colunas o que o banco devolveu", () => {
    expect(
      camposRetornoBanco({
        prazoPagamentoBanco: 420,
        valorFinanciamentoBanco: 238140,
        valorIofBanco: 0,
        codigoIndexadorBanco: "TR",
        codigoSistemaAmortizacaoBanco: "P",
      }),
    ).toEqual({
      prazo_pagamento_max: 420,
      valor_financiamento_max: 238140,
      valor_iof: 0,
      codigo_indexador: "TR",
      sistema_amortizacao_banco: "P",
    });
  });

  it("usa o máximo quando o banco não manda o valor da simulação", () => {
    const c = camposRetornoBanco({ prazoPagamentoBancoMax: 360, valorFinanciamentoBancoMax: 300000 });
    expect(c.prazo_pagamento_max).toBe(360);
    expect(c.valor_financiamento_max).toBe(300000);
  });

  it("não inventa nada do que o banco não mandou", () => {
    expect(
      camposRetornoBanco({
        prazoPagamentoBanco: null,
        valorFinanciamentoBanco: 0,
        valorIofBanco: null,
        codigoIndexadorBanco: "",
        codigoSistemaAmortizacaoBanco: null,
      }),
    ).toEqual({});
    expect(camposRetornoBanco(null)).toEqual({});
  });
});

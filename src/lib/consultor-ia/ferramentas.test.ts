import { describe, expect, it } from "vitest";
import {
  comprometimento,
  custosAquisicao,
  financiamentoMaximo,
  simular,
  taxaMensal,
  type ParametrosCalculo,
} from "./calculos";
import {
  executarFerramentas,
  extrairPrazoMeses,
  extrairTaxa,
  precisaDadoAtual,
  valoresMonetarios,
} from "./ferramentas";

const P: ParametrosCalculo = {
  itbi_percentual: 3,
  itbi_municipios: [
    { municipio: "São Paulo", uf: "SP", percentual: 3 },
    { municipio: "Curitiba", uf: "PR", percentual: 2.7 },
  ],
  cartorio_percentual: 1.5,
  avaliacao_banco: 3000,
  certidoes_valor: 400,
  comprometimento_max_percentual: 30,
  taxa_referencia_anual: null,
};

describe("cálculos determinísticos", () => {
  it("taxa mensal equivalente (efetiva) e nominal", () => {
    expect(taxaMensal(12)).toBeCloseTo(0.009488793, 8);
    expect(taxaMensal(12, "nominal")).toBeCloseTo(0.01, 10);
  });

  it("PRICE: parcela fixa pela fórmula, total = parcelas", () => {
    const s = simular("PRICE", 300_000, 12, 360);
    const i = taxaMensal(12);
    const pmt = (300_000 * i) / (1 - Math.pow(1 + i, -360));
    expect(s.primeira_parcela).toBeCloseTo(pmt, 2);
    expect(s.ultima_parcela).toBeCloseTo(pmt, 0);
    expect(s.total_pago).toBeCloseTo(pmt * 360, 0);
    expect(s.amostra.at(-1)!.saldo).toBe(0);
  });

  it("SAC: amortização constante, 1ª = PV/n + PV·i, juros totais = Σ", () => {
    const s = simular("SAC", 360_000, 10, 360);
    const i = taxaMensal(10);
    expect(s.primeira_parcela).toBeCloseTo(1000 + 360_000 * i, 2);
    expect(s.ultima_parcela).toBeCloseTo(1000 + 1000 * i, 2);
    expect(s.total_pago).toBeCloseTo(360_000 + s.total_juros, 1);
    expect(s.primeira_parcela).toBeGreaterThan(simular("PRICE", 360_000, 10, 360).primeira_parcela);
  });

  it("taxa zero e entradas absurdas", () => {
    expect(simular("PRICE", 1200, 0, 12).primeira_parcela).toBe(100);
    expect(() => simular("SAC", -1, 10, 360)).toThrow(/maior que zero/);
    expect(() => simular("SAC", 1000, 99, 360)).toThrow(/faixa/);
    expect(() => simular("SAC", 1000, 10, 9999)).toThrow(/faixa/);
  });

  it("comprometimento, capacidade e custos com parâmetros da conta", () => {
    expect(comprometimento(3000, 10_000)).toBe(30);
    const cap = financiamentoMaximo(10_000, 12, 360, "PRICE", 30);
    expect(cap.parcela_maxima).toBe(3000);
    expect(simular("PRICE", cap.valor_maximo, 12, 360).primeira_parcela).toBeCloseTo(3000, 1);
    const sac = financiamentoMaximo(10_000, 12, 360, "SAC", 30);
    expect(simular("SAC", sac.valor_maximo, 12, 360).primeira_parcela).toBeCloseTo(3000, 1);
    const c = custosAquisicao(500_000, P, "curitiba");
    expect(c.itbi).toBe(13_500);
    expect(c.itbi_origem).toBe("Curitiba/PR");
    expect(c.total).toBe(13_500 + 7_500 + 3_000 + 400);
    expect(custosAquisicao(500_000, P, "Cidade Sem Cadastro").itbi_percentual).toBe(3);
  });
});

describe("leitura da pergunta em português", () => {
  it("valores, taxa e prazo", () => {
    expect(
      valoresMonetarios("imóvel de R$ 500 mil com entrada de 100.000").map((v) => v.valor),
    ).toEqual([500_000, 100_000]);
    expect(valoresMonetarios("apartamento de 1,2 milhão").map((v) => v.valor)).toEqual([1_200_000]);
    expect(valoresMonetarios("2 quartos e 30 anos a 10%").length).toBe(0);
    expect(extrairTaxa("taxa de 10,5% a.a.")).toEqual({ anual: 10.5, tipo: "efetiva" });
    expect(extrairTaxa("juros de 1% a.m.")!.anual).toBeCloseTo(12.68, 2);
    expect(extrairTaxa("entrada de 20% e taxa de 11%")).toEqual({ anual: 11, tipo: "efetiva" });
    expect(extrairTaxa("entrada de 20%")).toBeNull();
    expect(extrairPrazoMeses("em 30 anos")).toBe(360);
    expect(extrairPrazoMeses("em 420 meses")).toBe(420);
  });

  it("simulação completa: calcula SAC e PRICE com os números da pergunta", () => {
    const r = executarFerramentas(
      "Qual a parcela de um imóvel de R$ 500 mil com entrada de R$ 100 mil, taxa de 11% a.a. em 30 anos?",
      P,
    );
    expect(r.map((x) => x.tipo)).toEqual(["simulacao", "simulacao"]);
    const sac = r[0]!;
    if (sac.tipo !== "simulacao") throw new Error();
    expect(sac.dados.valor_financiado).toBe(400_000);
    expect(sac.dados.meses).toBe(360);
    expect(sac.markdown).toContain("Primeira parcela");
  });

  it("falta a taxa: pede em vez de supor; com taxa de referência da conta, usa e avisa", () => {
    const r = executarFerramentas("Simule a parcela de R$ 300 mil em 35 anos no SAC", P);
    expect(r).toHaveLength(1);
    expect(r[0]!.tipo).toBe("faltando");
    expect(r[0]!.markdown).toMatch(/taxa/);
    const r2 = executarFerramentas("Simule a parcela de R$ 300 mil em 35 anos no SAC", {
      ...P,
      taxa_referencia_anual: 10,
    });
    expect(r2[0]!.tipo).toBe("simulacao");
    expect(r2[0]!.markdown).toMatch(/Taxa de referência cadastrada/);
  });

  it("comprometimento, capacidade e custos", () => {
    const c = executarFerramentas(
      "Uma parcela de R$ 4.500 compromete quanto de uma renda de R$ 12 mil?",
      P,
    );
    expect(c[0]).toMatchObject({
      tipo: "comprometimento",
      dados: { percentual: 37.5, dentro: false },
    });
    const cap = executarFerramentas(
      "Quanto posso financiar com renda de R$ 15 mil, taxa de 10% em 30 anos no PRICE?",
      P,
    );
    expect(cap[0]!.tipo).toBe("capacidade");
    const custos = executarFerramentas(
      "Quanto fica o ITBI e o cartório de um imóvel de R$ 600 mil em Curitiba?",
      P,
    );
    expect(custos[0]).toMatchObject({
      tipo: "custos",
      dados: { itbi: 16_200, itbi_origem: "Curitiba/PR" },
    });
  });

  it("pergunta conceitual não dispara conta; dado atual é detectado", () => {
    expect(executarFerramentas("Qual a diferença entre SFH e SFI?", P)).toEqual([]);
    expect(precisaDadoAtual("Qual a taxa da Caixa hoje?")).toBe(true);
    expect(precisaDadoAtual("Quanto está a Selic?")).toBe(true);
    expect(precisaDadoAtual("Qual o teto do MCMV?")).toBe(true);
    expect(precisaDadoAtual("O que é amortização SAC?")).toBe(false);
  });
});

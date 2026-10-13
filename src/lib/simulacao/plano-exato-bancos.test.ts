import { describe, expect, it } from "vitest";
import { calcularPlano, extrairDetalheBanco } from "./detalhe-banco";

const centavos = (v: number) => Math.round(v * 100) / 100;

/**
 * Valores reais devolvidos pelos bancos via HomeFin (13/10/2026). O plano
 * projetado tem de reproduzir a parcela do banco centavo a centavo.
 */
describe("Bradesco: taxa mensal equivalente à efetiva anual", () => {
  // Simulação de 13/10 — R$ 600.000, 420 meses, PRICE, 12,45% a.a.
  const raw = {
    codigoSistemaAmortizacaoBanco: "P",
    codigoIndexadorBanco: "TR",
    taxaCetAnoBanco: 13.16,
    valorParcelaBanco: 6174.69,
    valorImovel: 1300000,
    descricaoRespostaBanco: {
      valorTag: 2114.03,
      valorCetAno: 13.16,
      valorImovel: 1300000,
      valorSeguro: 180.32,
      valorTaxaNominal: 11.79,
      prazoFinanciamento: 420,
      valorFinanciamento: 600000,
      valorUltimaPrestacao: 5977.26,
      tipoSistemaAmortizador: "PRICE",
      valorTotalFinanciamento: 600000,
      valorTaxaJurosEfetivoAno: 12.45,
      valorTotalDespesasFinanceiras: 0,
      valorRendaLiquidaMinimaExigida: 41164.6,
      valorPrimeiraPrestacaoComSeguroTac: 6174.69,
      valorPrimeiraPrestacaoSemSeguroTac: 5994.37,
      parcelasSimulacao: [],
    },
  };

  it("1ª parcela do plano = 1ª parcela sem seguros do banco", () => {
    const d = extrairDetalheBanco(raw)!;
    expect(centavos(d.parcelas[0].parcela)).toBe(5994.37);
    expect(d.parcelas).toHaveLength(420);
    expect(d.parcelas[419].saldoDevedor).toBe(0);
  });

  it("resumo traz exatamente os valores do banco", () => {
    const d = extrairDetalheBanco(raw)!;
    expect(d.primeiraParcela).toBe(6174.69);
    expect(d.primeiraParcelaSemSeguro).toBe(5994.37);
    expect(d.seguroMensal).toBe(180.32);
    expect(d.ultimaParcela).toBe(5977.26);
    expect(d.cet).toBe(13.16);
    expect(d.tarifaAvaliacao).toBe(2114.03);
    expect(d.rendaMinimaExigida).toBe(41164.6);
    expect(d.valorImovel).toBe(1300000);
    expect(d.valorEntrada).toBe(700000);
  });

  it("despesas e total financiado vêm do banco, não do pedido", () => {
    const d = extrairDetalheBanco({
      ...raw,
      valorDespesasFinanciadas: 50000,
      descricaoRespostaBanco: {
        ...raw.descricaoRespostaBanco,
        valorImovel: 1000000,
        valorTotalFinanciamento: 650000,
        valorTotalDespesasFinanceiras: 50000,
      },
    })!;
    expect(d.despesasFinanciadas).toBe(50000);
    expect(d.valorTotalFinanciamento).toBe(650000);
  });

  it("outros casos reais: PRICE e SAC", () => {
    const equiv = (a: number) => (Math.pow(1 + a / 100, 1 / 12) - 1) * 100;
    const casos: [number, number, number, "PRICE" | "SAC", number][] = [
      [500000, 420, 13.85, "PRICE", 5492.6],
      [500000, 360, 13.85, "PRICE", 5547.23],
      [650000, 420, 12.45, "PRICE", 6493.9],
      [248000, 360, 13.85, "PRICE", 2751.43],
      [1000000, 420, 11.7, "PRICE", 9459.99],
      [500000, 420, 13.85, "SAC", 6624.44],
      [500000, 360, 13.85, "SAC", 6822.85],
      [1700000, 360, 13.85, "SAC", 23197.71],
      [275000, 349, 12.55, "SAC", 3510.73],
    ];
    for (const [p, n, a, sist, banco] of casos) {
      const plano = calcularPlano(p, n, equiv(a), sist, "2026-11-13");
      expect(centavos(plano[0].parcela)).toBe(banco);
    }
  });
});

describe("Itaú: juros e amortização truncados no centavo", () => {
  // Simulação real: R$ 320.000, 399 meses, SAC, 13,85% a.a. (1,0868% exibido).
  const raw = {
    codigoSistemaAmortizacaoBanco: "S",
    valorParcelaBanco: 4474.63,
    descricaoRespostaBanco: {
      amortizationType: "SAC",
      annualRate: 13.85,
      monthlyRate: 1.0868,
      cetAnnual: 15.23,
      period: 399,
      loanAmount: 320000,
      propertyPrice: 400000,
      downPayment: 80000,
      propertyEvaluation: 0,
      installments: [],
      firstInstallment: {
        number: 1,
        dueDate: "2026-11-13",
        interest: 3477.73,
        amortization: 802.0,
        insurerDfi: 22.16,
        insurerMip: 172.74,
        totalValue: 4474.63,
        beginningBalance: 320000,
      },
      lastInstallment: {
        number: 399,
        interest: 8.71,
        amortization: 802.01,
        insurerDfi: 0,
        insurerMip: 0,
        totalValue: 810.72,
      },
    },
  };

  it("1ª e última parcela do plano iguais às do banco", () => {
    const d = extrairDetalheBanco(raw)!;
    expect(d.parcelas[0].amortizacao).toBe(802.0);
    expect(d.parcelas[0].juros).toBe(3477.73);
    const ult = d.parcelas[398];
    expect(ult.amortizacao).toBe(802.01);
    expect(ult.juros).toBe(8.71);
    expect(centavos(ult.parcela)).toBe(810.72);
    expect(ult.saldoDevedor).toBe(0);
  });

  it("resumo e taxas exatamente como o banco informou", () => {
    const d = extrairDetalheBanco(raw)!;
    expect(d.taxaJurosMes).toBe(1.0868);
    expect(d.primeiraParcela).toBe(4474.63);
    expect(d.primeiraParcelaSemSeguro).toBe(4279.73);
    expect(d.seguroMensal).toBeCloseTo(194.9, 10);
    expect(d.ultimaParcela).toBe(810.72);
    expect(d.cet).toBe(15.23);
    expect(d.tarifaAvaliacao).toBe(0);
  });
});

describe("Santander: prazo, taxa e tarifa do banco", () => {
  const raw = {
    codigoSistemaAmortizacaoBanco: "S",
    prazoPagamentoSimulacao: 399,
    taxaCetAnoBanco: 14.27,
    taxaJurosAnoBanco: 13.29,
    valorParcelaBanco: 1323.8,
    valorImovel: 400000,
    descricaoRespostaBanco: {
      financingDeadlineInMonths: 396,
      valuationFeeAmount: 0,
      propertyValue: 400000,
      downPaymentAmount: 80000,
      financingValue: 320000,
      totalFinancingValueWithExpenses: 320000,
      expensesFinancedValue: 0,
      unrelatedFlow: {
        cetRate: 14.27,
        monthlyInterestRate: 1.05,
        firstPaymentAmount: 1323.8,
        lastPaymentAmount: 816.85,
        paymentPlan: [
          {
            numberInstallment: 0,
            installmentValue: "R$ 196,00",
            amortizationValue: "R$ 0,00",
            interestAmount: "R$ 0,00",
          },
          {
            numberInstallment: 1,
            amortizationDate: "05/11/2026",
            installmentValue: "R$ 1.323,80",
            amortizationValue: "R$ 238,10",
            interestAmount: "R$ 1.045,26",
            insuranceValueDfi: "R$ 14,50",
            insuranceValueMip: "R$ 25,94",
            debitBalanceAmount: "R$ 99.761,90",
          },
        ],
      },
    },
  };

  it("usa o prazo aceito pelo banco e a taxa mensal do banco", () => {
    const d = extrairDetalheBanco(raw)!;
    expect(d.prazoMeses).toBe(396);
    expect(d.taxaJurosMes).toBe(1.05);
    expect(d.tarifaAvaliacao).toBe(0);
    expect(d.ultimaParcela).toBe(816.85);
    expect(d.primeiraParcelaSemSeguro).toBe(1283.36);
    expect(d.seguroMensal).toBeCloseTo(40.44, 10);
    expect(d.valorEntrada).toBe(80000);
  });
});

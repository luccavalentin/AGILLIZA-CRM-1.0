import { describe, expect, it } from "vitest";
import { decidirRendaDoCrm } from "./renda-crm";

const base = {
  valor_financiamento: 520000,
  valor_imovel: 650000,
  prazo: 420,
  taxa_ano: 0.1199,
};

describe("renda do CRM na simulação", () => {
  it("soma o cônjuge com renda e mantém a do CRM quando cobre a tabela", () => {
    const d = decidirRendaDoCrm({
      ...base,
      sistema: "S",
      rendaTitularCrm: 48000,
      rendaConjugeCrm: 3000,
      temConjuge: true,
    })!;
    expect(d.rendaCrm).toBe(51000);
    expect(d.suficiente).toBe(true);
  });

  it("cônjuge só soma quando o titular é casado", () => {
    const d = decidirRendaDoCrm({
      ...base,
      sistema: "S",
      rendaTitularCrm: 48000,
      rendaConjugeCrm: 3000,
      temConjuge: false,
    })!;
    expect(d.rendaCrm).toBe(48000);
  });

  it("renda abaixo da necessária pede digitação", () => {
    const d = decidirRendaDoCrm({
      ...base,
      sistema: "S",
      rendaTitularCrm: 5000,
      rendaConjugeCrm: 0,
      temConjuge: false,
    })!;
    expect(d.suficiente).toBe(false);
    expect(d.necessaria).toBeGreaterThan(5000);
  });

  it("em Ambos precisa cobrir SAC e PRICE", () => {
    const sac = decidirRendaDoCrm({
      ...base,
      sistema: "S",
      rendaTitularCrm: 1,
      rendaConjugeCrm: 0,
      temConjuge: false,
    })!;
    const ambos = decidirRendaDoCrm({
      ...base,
      sistema: "B",
      rendaTitularCrm: 1,
      rendaConjugeCrm: 0,
      temConjuge: false,
    })!;
    expect(ambos.necessaria).toBe(Math.max(ambos.necessariaSac!, ambos.necessariaPrice!));
    expect(ambos.necessariaSac).toBe(sac.necessariaSac);
  });

  it("sem renda no CRM ou sem financiamento não decide", () => {
    expect(
      decidirRendaDoCrm({
        ...base,
        sistema: "S",
        rendaTitularCrm: 0,
        rendaConjugeCrm: 0,
        temConjuge: true,
      }),
    ).toBeNull();
    expect(
      decidirRendaDoCrm({
        ...base,
        valor_financiamento: 0,
        valor_imovel: 0,
        sistema: "S",
        rendaTitularCrm: 9000,
        rendaConjugeCrm: 0,
        temConjuge: false,
      }),
    ).toBeNull();
  });
});

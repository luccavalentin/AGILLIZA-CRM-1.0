import { describe, expect, it } from "vitest";
import {
  decidirOportunidade,
  ehMesmoNegocio,
  oportunidadeAceitaNovaSimulacao,
} from "./reaproveitar-oportunidade";

const candidata = {
  homefin_id_oportunidade: "30915",
  cliente_id: "cli-1",
  produto: "financiamento_imobiliario",
  tipo_pessoa: "PF",
  cep_imovel: "13416-222",
  id_operacao_homefin: 1,
};
const nova = {
  cliente_id: "cli-1",
  produto: "financiamento_imobiliario",
  tipo_pessoa: "PF",
  cep_imovel: "13416222",
  id_operacao_homefin: 1,
};
const ativaLivre = {
  tipoSituacao: "A",
  simulacoes: [{ tipoSituacao: "P", valorParcelaBanco: 4377.59 }],
};

describe("ehMesmoNegocio", () => {
  it("aceita o mesmo cliente, produto e imóvel (CEP com máscara ou sem)", () => {
    expect(ehMesmoNegocio(candidata, nova)).toBe(true);
  });

  it("recusa cliente, produto, modalidade ou operação diferentes", () => {
    expect(ehMesmoNegocio(candidata, { ...nova, cliente_id: "cli-2" })).toBe(false);
    expect(ehMesmoNegocio(candidata, { ...nova, produto: "home_equity" })).toBe(false);
    expect(ehMesmoNegocio(candidata, { ...nova, tipo_pessoa: "PJ" })).toBe(false);
    expect(ehMesmoNegocio(candidata, { ...nova, id_operacao_homefin: 2 })).toBe(false);
  });

  it("recusa imóvel diferente, mas não exige CEP quando ninguém tem", () => {
    expect(ehMesmoNegocio(candidata, { ...nova, cep_imovel: "01310100" })).toBe(false);
    expect(ehMesmoNegocio({ ...candidata, cep_imovel: null }, { ...nova, cep_imovel: "" })).toBe(
      true,
    );
    // Um lado sem CEP não bloqueia: simulação costuma nascer antes do imóvel.
    expect(ehMesmoNegocio({ ...candidata, cep_imovel: null }, nova)).toBe(true);
  });

  it("recusa candidata sem id de oportunidade", () => {
    expect(ehMesmoNegocio({ ...candidata, homefin_id_oportunidade: null }, nova)).toBe(false);
  });
});

describe("oportunidadeAceitaNovaSimulacao", () => {
  it("aceita oportunidade ativa em que todas as simulações têm parcela", () => {
    expect(oportunidadeAceitaNovaSimulacao(ativaLivre)).toBe(true);
    expect(oportunidadeAceitaNovaSimulacao({ tipoSituacao: "A", simulacoes: [] })).toBe(true);
  });

  it("recusa quando alguma simulação ficou sem parcela (falha ou sem despacho)", () => {
    expect(
      oportunidadeAceitaNovaSimulacao({
        tipoSituacao: "A",
        simulacoes: [
          { tipoSituacao: "P", valorParcelaBanco: 4377.59 },
          { tipoSituacao: "P", valorParcelaBanco: null },
        ],
      }),
    ).toBe(false);
  });

  it("recusa oportunidade que já passou do teto de simulações", () => {
    const cheia = Array.from({ length: 20 }, () => ({
      tipoSituacao: "P",
      valorParcelaBanco: 1000,
    }));
    expect(oportunidadeAceitaNovaSimulacao({ tipoSituacao: "A", simulacoes: cheia })).toBe(false);
  });

  it("recusa quando há proposta em análise ou aprovada", () => {
    expect(
      oportunidadeAceitaNovaSimulacao({ tipoSituacao: "A", simulacoes: [{ tipoSituacao: "N" }] }),
    ).toBe(false);
    expect(
      oportunidadeAceitaNovaSimulacao({ tipoSituacao: "A", simulacoes: [{ tipoSituacao: "A" }] }),
    ).toBe(false);
  });

  it("recusa oportunidade com contrato emitido, cancelada ou desconhecida", () => {
    expect(oportunidadeAceitaNovaSimulacao({ tipoSituacao: "T", simulacoes: [] })).toBe(false);
    expect(oportunidadeAceitaNovaSimulacao({ tipoSituacao: "C", simulacoes: [] })).toBe(false);
    expect(oportunidadeAceitaNovaSimulacao(null)).toBe(false);
    expect(oportunidadeAceitaNovaSimulacao({})).toBe(false);
  });
});

describe("decidirOportunidade", () => {
  it("devolve o id quando tudo confere", () => {
    expect(decidirOportunidade(candidata, nova, ativaLivre)).toBe("30915");
  });

  it("devolve null (cria nova) em qualquer dúvida", () => {
    expect(decidirOportunidade(null, nova, ativaLivre)).toBeNull();
    expect(decidirOportunidade(candidata, { ...nova, cliente_id: "outro" }, ativaLivre)).toBeNull();
    expect(decidirOportunidade(candidata, nova, null)).toBeNull();
    expect(
      decidirOportunidade(candidata, nova, {
        tipoSituacao: "A",
        simulacoes: [{ tipoSituacao: "N" }],
      }),
    ).toBeNull();
  });
});

describe("valores congelados na criação da oportunidade", () => {
  const criadoraSac = {
    ...candidata,
    sistema_amortizacao: "S",
    renda_total: "33000.00",
    renda_conjuge: "0.00",
    possui_conjuge: true,
    compoe_renda_conjuge: false,
    valor_imovel: "405000.00",
    valor_financiamento: "324000.00",
    utiliza_fgts: "N",
  };
  const mesmaSac = {
    ...nova,
    sistema_amortizacao: "S",
    renda_total: 33000,
    renda_conjuge: 0,
    possui_conjuge: true,
    compoe_renda_conjuge: false,
    valor_imovel: 405000,
    valor_financiamento: 324000,
    utiliza_fgts: "N",
  };

  it("reaproveita quando é o mesmo envio repetido (formato numérico não importa)", () => {
    expect(decidirOportunidade(criadoraSac, mesmaSac, ativaLivre)).toBe("30915");
  });

  it("PRICE nunca entra em oportunidade criada por SAC (caso Bradesco 16/09)", () => {
    expect(
      decidirOportunidade(criadoraSac, { ...mesmaSac, sistema_amortizacao: "P" }, ativaLivre),
    ).toBeNull();
  });

  it("renda, valores, FGTS ou composição diferentes criam oportunidade nova", () => {
    expect(
      decidirOportunidade(criadoraSac, { ...mesmaSac, renda_total: 100000 }, ativaLivre),
    ).toBeNull();
    expect(
      decidirOportunidade(criadoraSac, { ...mesmaSac, valor_financiamento: 300000 }, ativaLivre),
    ).toBeNull();
    expect(
      decidirOportunidade(criadoraSac, { ...mesmaSac, valor_imovel: 500000 }, ativaLivre),
    ).toBeNull();
    expect(
      decidirOportunidade(criadoraSac, { ...mesmaSac, utiliza_fgts: "S" }, ativaLivre),
    ).toBeNull();
    expect(
      decidirOportunidade(
        criadoraSac,
        { ...mesmaSac, compoe_renda_conjuge: true, renda_conjuge: 8000 },
        ativaLivre,
      ),
    ).toBeNull();
  });

  it("renda do cônjuge só pesa quando ele compõe renda", () => {
    expect(decidirOportunidade(criadoraSac, { ...mesmaSac, renda_conjuge: 5000 }, ativaLivre)).toBe(
      "30915",
    );
  });
});

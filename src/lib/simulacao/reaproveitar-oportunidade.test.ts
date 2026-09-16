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
const ativaLivre = { tipoSituacao: "A", simulacoes: [{ tipoSituacao: "S" }] };

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
    expect(
      ehMesmoNegocio({ ...candidata, cep_imovel: null }, { ...nova, cep_imovel: "" }),
    ).toBe(true);
    // Um lado sem CEP não bloqueia: simulação costuma nascer antes do imóvel.
    expect(ehMesmoNegocio({ ...candidata, cep_imovel: null }, nova)).toBe(true);
  });

  it("recusa candidata sem id de oportunidade", () => {
    expect(ehMesmoNegocio({ ...candidata, homefin_id_oportunidade: null }, nova)).toBe(false);
  });
});

describe("oportunidadeAceitaNovaSimulacao", () => {
  it("aceita oportunidade ativa sem proposta viva", () => {
    expect(oportunidadeAceitaNovaSimulacao(ativaLivre)).toBe(true);
    expect(
      oportunidadeAceitaNovaSimulacao({
        tipoSituacao: "A",
        simulacoes: [{ tipoSituacao: "R" }, { tipoSituacao: "P" }],
      }),
    ).toBe(true);
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
      decidirOportunidade(candidata, nova, { tipoSituacao: "A", simulacoes: [{ tipoSituacao: "N" }] }),
    ).toBeNull();
  });
});

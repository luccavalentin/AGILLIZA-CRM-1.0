import { describe, expect, it } from "vitest";
import { acharSimulacaoBanco, simulacoesDaOportunidade } from "./homefin-shape";

/**
 * O contrato `GetOpportunityOk` devolve as simulações dentro de `oportunidade`.
 * Ler a raiz dava sempre `[]` e travava o Santander em "Em análise".
 */
const respostaReal = {
  oportunidade: {
    idOportunidade: 987,
    simulacoes: [
      { idSimulacao: 111, idBanco: 45, valorParcelaBanco: 0 },
      { idSimulacao: 222, idBanco: 9, valorParcelaBanco: 3210.55 },
    ],
  },
  etapa: [{ idEtapa: 1, nomeEtapa: "Simulação" }],
};

describe("simulacoesDaOportunidade", () => {
  it("lê as simulações de dentro do envelope `oportunidade`", () => {
    expect(simulacoesDaOportunidade(respostaReal)).toHaveLength(2);
  });

  it("aceita também a forma sem envelope", () => {
    const semEnvelope = { simulacoes: [{ idSimulacao: 1 }] };
    expect(simulacoesDaOportunidade(semEnvelope)).toHaveLength(1);
  });

  it("prefere o envelope quando as duas formas vêm juntas", () => {
    const ambas = {
      oportunidade: { simulacoes: [{ idSimulacao: "do-envelope" }] },
      simulacoes: [{ idSimulacao: "da-raiz" }],
    };
    expect(simulacoesDaOportunidade(ambas)[0].idSimulacao).toBe("do-envelope");
  });

  it("devolve lista vazia para respostas inesperadas em vez de estourar", () => {
    expect(simulacoesDaOportunidade(null)).toEqual([]);
    expect(simulacoesDaOportunidade(undefined)).toEqual([]);
    expect(simulacoesDaOportunidade({})).toEqual([]);
    expect(simulacoesDaOportunidade({ oportunidade: {} })).toEqual([]);
    expect(simulacoesDaOportunidade({ simulacoes: "nao-e-array" })).toEqual([]);
  });
});

describe("acharSimulacaoBanco", () => {
  it("acha a simulação do banco dentro do envelope", () => {
    expect(acharSimulacaoBanco(respostaReal, 222)?.valorParcelaBanco).toBe(3210.55);
  });

  it("casa id numérico da API com id em texto guardado por nós", () => {
    // A regressão original: a API devolve número, gravamos texto.
    expect(acharSimulacaoBanco(respostaReal, "111")?.idBanco).toBe(45);
  });

  it("devolve null quando o banco não está na resposta", () => {
    expect(acharSimulacaoBanco(respostaReal, 999)).toBeNull();
  });

  it("devolve null para id ausente, em vez de casar com qualquer um", () => {
    expect(acharSimulacaoBanco(respostaReal, null)).toBeNull();
    expect(acharSimulacaoBanco(respostaReal, undefined)).toBeNull();
    expect(acharSimulacaoBanco(respostaReal, "")).toBeNull();
  });
});

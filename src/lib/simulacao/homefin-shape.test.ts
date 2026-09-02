import { describe, expect, it } from "vitest";
import { acharSimulacaoBanco, simulacoesDaOportunidade } from "./homefin-shape";

/**
 * Forma real devolvida por `GET /oportunidade/26870` (capturada da API em
 * produção). O envelope `oportunidade` é o ponto do defeito: ler `simulacoes`
 * na raiz devolvia vazio e a reconciliação nunca recuperava nada.
 */
const RESPOSTA_REAL = {
  oportunidade: {
    idOportunidade: 26870,
    participantes: [{ idParticipante: 26820 }],
    simulacoes: [
      { idSimulacao: 84264, idBanco: 45, valorParcelaBanco: 2450.54, taxaJurosAnoBanco: 12.3 },
      { idSimulacao: 84265, idBanco: 45, valorParcelaBanco: 2417.37, taxaJurosAnoBanco: 12.3 },
    ],
  },
  etapa: {},
};

describe("simulacoesDaOportunidade", () => {
  it("lê as simulações de dentro do envelope `oportunidade`", () => {
    expect(simulacoesDaOportunidade(RESPOSTA_REAL).map((s) => s.idSimulacao)).toEqual([
      84264, 84265,
    ]);
  });

  it("aceita também a lista na raiz, se a API deixar de usar o envelope", () => {
    expect(simulacoesDaOportunidade({ simulacoes: [{ idSimulacao: 1 }] })).toHaveLength(1);
  });

  it("devolve lista vazia para resposta ausente ou sem simulações", () => {
    expect(simulacoesDaOportunidade(null)).toEqual([]);
    expect(simulacoesDaOportunidade({})).toEqual([]);
    expect(simulacoesDaOportunidade({ oportunidade: {} })).toEqual([]);
    expect(simulacoesDaOportunidade({ oportunidade: { simulacoes: null } })).toEqual([]);
  });
});

describe("acharSimulacaoBanco", () => {
  it("acha pela id mesmo quando os tipos diferem (string x number)", () => {
    expect(acharSimulacaoBanco(RESPOSTA_REAL, "84265")?.valorParcelaBanco).toBe(2417.37);
    expect(acharSimulacaoBanco(RESPOSTA_REAL, 84264)?.valorParcelaBanco).toBe(2450.54);
  });

  it("devolve null quando a simulação não está na oportunidade", () => {
    expect(acharSimulacaoBanco(RESPOSTA_REAL, 99999)).toBeNull();
    expect(acharSimulacaoBanco(RESPOSTA_REAL, null)).toBeNull();
  });

  it("regressão: ler a raiz devolvia vazio — o defeito que travava a reconciliação", () => {
    // Como era antes da correção:
    expect((RESPOSTA_REAL as any).simulacoes ?? []).toEqual([]);
    // Como é agora:
    expect(acharSimulacaoBanco(RESPOSTA_REAL, 84264)).not.toBeNull();
  });
});

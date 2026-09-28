import { describe, it, expect } from "vitest";
import { camposAprovadosDoBanco } from "./enviar.server";

/**
 * Retorno real da HomeFin na PRO-000577 (oportunidade 33616, 25/09/2026): o
 * Itaú aprovou com parcela diferente da simulada e o sync gravou a parcela
 * nova mantendo a taxa antiga.
 */
const itauAprovado = {
  idSimulacao: 113920,
  idBanco: 61,
  tipoSituacao: "A",
  valorParcelaBanco: 3611.16,
  prazoPagamentoBanco: 360,
  valorFinanciamentoBanco: 320000,
};

describe("campos aprovados — só o que veio da aprovação", () => {
  it("grava exatamente os valores do banco", () => {
    const r = camposAprovadosDoBanco({
      op: {},
      simulacaoEscolhida: { ...itauAprovado, taxaJurosAnoBanco: 10.31 },
      aprovado: true,
    });
    expect(r).toEqual({
      valor_parcela_aprovado: 3611.16,
      taxa_juros_ano_aprovado: 10.31,
      prazo_aprovado: 360,
      valor_financiamento_aprovado: 320000,
    });
  });

  it("regressão PRO-000577: taxa omitida pelo banco não herda a da simulação", () => {
    // Sem taxa no retorno, o campo tem de sair vazio. Antes ele ficava com a
    // taxa da simulação (13,85% a.a.), que com a parcela aprovada de
    // R$ 3.611,16 dá um conjunto impossível: a 13,85% só amortização + juros
    // já somam R$ 4.366,63 num financiamento de R$ 320.000 em 360 meses.
    const r = camposAprovadosDoBanco({
      op: {},
      simulacaoEscolhida: itauAprovado,
      aprovado: true,
    });
    expect(r.valor_parcela_aprovado).toBe(3611.16);
    expect(r.taxa_juros_ano_aprovado).toBeNull();
    // O campo é escrito, não omitido — é o que apaga o valor velho na gravação.
    expect(Object.keys(r)).toContain("taxa_juros_ano_aprovado");
  });

  it("sem aprovação, preenche o que chega e não apaga nada", () => {
    const r = camposAprovadosDoBanco({
      op: {},
      simulacaoEscolhida: { valorParcelaBanco: 4421.76, taxaJurosAnoBanco: 13.85 },
      aprovado: false,
    });
    expect(r).toEqual({ valor_parcela_aprovado: 4421.76, taxa_juros_ano_aprovado: 13.85 });
    expect(Object.keys(r)).not.toContain("prazo_aprovado");
  });

  it("leitura sem a simulação escolhida não zera dado bom", () => {
    // O polling lê a oportunidade várias vezes; uma leitura parcial não pode
    // limpar os campos já aprovados.
    const r = camposAprovadosDoBanco({ op: {}, simulacaoEscolhida: null, aprovado: true });
    expect(r).toEqual({});
  });

  it("valor na raiz da oportunidade tem precedência", () => {
    const r = camposAprovadosDoBanco({
      op: { valorParcelaBanco: 3611.16 },
      simulacaoEscolhida: { valorParcelaBanco: 4421.76 },
      aprovado: true,
    });
    expect(r.valor_parcela_aprovado).toBe(3611.16);
  });

  it("zero é valor, não ausência", () => {
    const r = camposAprovadosDoBanco({
      op: {},
      simulacaoEscolhida: { ...itauAprovado, taxaJurosAnoBanco: 0 },
      aprovado: true,
    });
    expect(r.taxa_juros_ano_aprovado).toBe(0);
  });
});

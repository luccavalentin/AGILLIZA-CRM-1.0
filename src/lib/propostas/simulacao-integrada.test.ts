import { describe, expect, it } from "vitest";

/**
 * Regra: só se pede proposta sobre simulação que tem resultado do banco.
 *
 * O `PUT /simulacao/{id}` reescreve os parâmetros e zera a cotação anterior
 * (`valorParcelaBanco` volta vazio). Sem chamar `/integracao` depois, o
 * `incluir-proposta-integracao` recebe uma simulação que nunca foi ao banco e
 * o provedor responde `tipoSituacao: "E"`, sem motivo.
 */
function precisaIntegrar(respostaPut: any): boolean {
  const parcela = Number(respostaPut?.valorParcelaBanco ?? 0);
  return !(Number.isFinite(parcela) && parcela > 0);
}

describe("integração da simulação antes da proposta", () => {
  it("PUT que zera a parcela exige nova integração", () => {
    // Resposta real do PUT /oportunidade/28399/simulacao/90177 (PRO-000268):
    // parcela e taxa voltaram como string vazia.
    expect(precisaIntegrar({ valorParcelaBanco: "", taxaJurosAnoBanco: "" })).toBe(true);
  });

  it("PUT sem o campo também exige integração", () => {
    expect(precisaIntegrar({})).toBe(true);
    expect(precisaIntegrar({ valorParcelaBanco: null })).toBe(true);
    expect(precisaIntegrar({ valorParcelaBanco: 0 })).toBe(true);
  });

  it("PUT que preserva a cotação dispensa a chamada extra", () => {
    expect(precisaIntegrar({ valorParcelaBanco: 9355.69 })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

/**
 * Regra de reaproveitamento da simulação bancária no envio da proposta.
 *
 * Extraída do critério aplicado em `renovarSimulacaoSeConsumida`. O que decide
 * é haver retorno do banco (parcela), não o `tipoSituacao` isolado.
 */
function simConsumida(sim: any, erroRetorno = false): boolean {
  const tipo = String(sim?.tipoSituacao ?? "")
    .toUpperCase()
    .charAt(0);
  const parcela = Number(sim?.valorParcelaBanco ?? 0);
  const temRetornoDoBanco = Number.isFinite(parcela) && parcela > 0;
  return (
    !sim || tipo === "R" || tipo === "A" || tipo === "E" || !temRetornoDoBanco || erroRetorno
  );
}

describe("reaproveitamento da simulação no envio da proposta", () => {
  it('"P" COM parcela é simulação boa e deve ser reutilizada', () => {
    // Caso real: 95417 (Itaú) em "P" com R$ 11.567,90. O código antigo tratava
    // todo "P" como consumido, criava uma simulação nova sem integração e o
    // provedor recusava a proposta com "E", sem motivo.
    expect(simConsumida({ tipoSituacao: "P", valorParcelaBanco: 11567.9 })).toBe(false);
  });

  it('"P" SEM parcela nunca foi integrada e precisa ser refeita', () => {
    expect(simConsumida({ tipoSituacao: "P", valorParcelaBanco: 0 })).toBe(true);
    expect(simConsumida({ tipoSituacao: "P", valorParcelaBanco: null })).toBe(true);
  });

  it('"A" e "R" continuam consumidas: a esteira já andou', () => {
    expect(simConsumida({ tipoSituacao: "A", valorParcelaBanco: 5000 })).toBe(true);
    expect(simConsumida({ tipoSituacao: "R", valorParcelaBanco: 5000 })).toBe(true);
  });

  it('"E" é falha do provedor e obriga simulação nova', () => {
    expect(simConsumida({ tipoSituacao: "E", valorParcelaBanco: 5000 })).toBe(true);
  });

  it("simulação órfã ou com validação presa é refeita", () => {
    expect(simConsumida(null)).toBe(true);
    expect(simConsumida({ tipoSituacao: "P", valorParcelaBanco: 9000 }, true)).toBe(true);
  });
});

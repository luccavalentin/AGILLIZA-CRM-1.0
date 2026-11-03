import { describe, expect, it } from "vitest";
import { oportunidadeCancelada } from "./helpers-retorno.server";

/**
 * Oportunidade 22108 (PRO-000192), lida da HomeFin em 03/11/2026: "C" desde a
 * criação, sem data nem autor de cancelamento, com a simulação do Bradesco
 * aprovada. No painel da HomeFin ela está ativa.
 */
const op22108 = {
  tipoSituacao: "C",
  dataCancelamento: null,
  idUsuarioCancelamento: null,
  simulacoes: [
    { idSimulacao: 62675, tipoSituacao: "P" },
    { idSimulacao: 62676, tipoSituacao: "P" },
    { idSimulacao: 62677, tipoSituacao: "A" },
  ],
};

describe("oportunidadeCancelada", () => {
  it("C sem registro de cancelamento e com simulação aprovada não é cancelamento", () => {
    expect(oportunidadeCancelada(op22108)).toBe(false);
  });

  it("simulação condicionada também segura a oportunidade", () => {
    const op = { ...op22108, simulacoes: [{ tipoSituacao: "C" }] };
    expect(oportunidadeCancelada(op)).toBe(false);
  });

  it("C com data de cancelamento é cancelamento", () => {
    expect(oportunidadeCancelada({ ...op22108, dataCancelamento: "2026-11-03" })).toBe(true);
  });

  it("C com autor de cancelamento é cancelamento", () => {
    expect(oportunidadeCancelada({ ...op22108, idUsuarioCancelamento: 409 })).toBe(true);
  });

  it("C sem nenhuma simulação aprovada é cancelamento", () => {
    expect(oportunidadeCancelada({ tipoSituacao: "C", simulacoes: [{ tipoSituacao: "P" }] })).toBe(
      true,
    );
  });

  it("A e T não são cancelamento", () => {
    expect(oportunidadeCancelada({ tipoSituacao: "A" })).toBe(false);
    expect(oportunidadeCancelada({ tipoSituacao: "T" })).toBe(false);
  });
});

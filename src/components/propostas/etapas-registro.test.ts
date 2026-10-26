import { describe, expect, it } from "vitest";
import { etapaDoStatus, etapasDoBanco, indiceEtapa } from "./pipeline-map";
import { statusProposta } from "./status";
import { MACRO_STAGES, macroIndexOf } from "@/components/crm/chat-cliente/painel/painel-utils";

describe("etapa Contrato registrado (C12)", () => {
  it("stepper da proposta termina em Contrato registrado", () => {
    const etapas = etapasDoBanco("Bradesco", "registrado");
    expect(etapas[etapas.length - 1].label).toBe("Contrato registrado");
    expect(etapaDoStatus("registrado")).toBe("registro");
    expect(indiceEtapa("registrado", "Bradesco")).toBe(etapas.length - 1);
    expect(indiceEtapa("contrato_emitido", "Bradesco")).toBe(etapas.length - 2);
  });
  it("status desconhecido não vira registro", () => {
    expect(etapaDoStatus("qualquer")).toBe("simulacao");
  });
  it("rótulo do status", () => {
    expect(statusProposta("registrado").label).toBe("Contrato registrado");
    expect(statusProposta("contrato_emitido").label).toBe("Contrato emitido");
  });
  it("jornada do cliente: registrado depois do contrato emitido", () => {
    const iEmitido = macroIndexOf("contrato_emitido");
    const iRegistrado = macroIndexOf("contrato_registrado");
    expect(iRegistrado).toBe(iEmitido + 1);
    expect(MACRO_STAGES[iRegistrado].label).toBe("Contrato registrado");
    expect(iRegistrado).toBe(MACRO_STAGES.length - 1);
    expect(macroIndexOf("etapa_inexistente")).toBe(0);
    expect(macroIndexOf(null)).toBe(0);
  });
});

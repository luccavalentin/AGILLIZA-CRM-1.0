import { describe, expect, it } from "vitest";
import { etapaDoStatus, etapasDoBanco, indiceEtapa } from "./pipeline-map";
import { statusProposta } from "./status";
import { statusProposta as statusPortal } from "@/lib/portal/jornada";

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
  it("portal do cliente mostra Contrato registrado", () => {
    expect(statusPortal("registrado").rotulo).toBe("Contrato registrado");
  });
});

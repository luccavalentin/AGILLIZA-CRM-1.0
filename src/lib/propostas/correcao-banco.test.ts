import { describe, expect, it } from "vitest";
import { transicaoPermitida } from "./state-machine";
import { grupoDoStatus } from "./status-grupos";
import { statusProposta } from "@/components/propostas/status";
import { etapaDoStatus } from "@/components/propostas/pipeline-map";

describe("correcao_banco (portal do Itaú/Santander cancelou ou recusou)", () => {
  it("tem rótulo próprio e fica entre as aprovadas", () => {
    expect(statusProposta("correcao_banco").label).toBe("Correção no portal do banco");
    expect(grupoDoStatus("correcao_banco")).toBe("aprovadas");
    expect(etapaDoStatus("correcao_banco")).toBe("credito");
  });

  it("entra a partir das etapas em andamento", () => {
    for (const de of ["credito_aprovado", "formularios", "aguardando_documentos", "analise_juridica"] as const) {
      expect(transicaoPermitida(de, "correcao_banco")).toBe(true);
    }
    expect(transicaoPermitida("cancelada", "correcao_banco")).toBe(false);
    expect(transicaoPermitida("registrado", "correcao_banco")).toBe(false);
  });

  it("sai para a etapa em que o portal estiver, ou é cancelada", () => {
    expect(transicaoPermitida("correcao_banco", "formularios")).toBe(true);
    expect(transicaoPermitida("correcao_banco", "engenharia_vistoria")).toBe(true);
    expect(transicaoPermitida("correcao_banco", "cancelada")).toBe(true);
    expect(transicaoPermitida("correcao_banco", "registrado")).toBe(false);
  });
});

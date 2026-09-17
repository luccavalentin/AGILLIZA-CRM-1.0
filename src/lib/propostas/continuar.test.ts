import { describe, expect, it } from "vitest";
import { podeContinuarProposta, STATUS_EDITAVEIS } from "./state-machine";

describe("podeContinuarProposta", () => {
  const aprovado = [{ status_banco: "aprovada" }];

  it("aparece para crédito aprovado ou condicionado com banco aprovado", () => {
    expect(podeContinuarProposta("credito_aprovado", aprovado)).toBe(true);
    expect(podeContinuarProposta("credito_condicionado", [{ status_banco: "condicionado" }])).toBe(
      true,
    );
  });

  it("continua aparecendo nas etapas seguintes", () => {
    for (const s of ["aguardando_documentos", "engenharia_vistoria", "analise_juridica"]) {
      expect(podeContinuarProposta(s, aprovado)).toBe(true);
    }
  });

  it("não aparece em recusada, rascunho, em análise, erro, cancelada ou contrato emitido", () => {
    for (const s of [
      "credito_recusado",
      "rascunho",
      "em_analise_credito",
      "erro_envio",
      "cancelada",
      "contrato_emitido",
    ]) {
      expect(podeContinuarProposta(s, aprovado)).toBe(false);
    }
  });

  it("exige ao menos um banco que aprovou", () => {
    expect(podeContinuarProposta("credito_aprovado", [{ status_banco: "recusada" }])).toBe(false);
    expect(podeContinuarProposta("credito_aprovado", [])).toBe(false);
    expect(
      podeContinuarProposta("credito_aprovado", [
        { status_banco: "recusada" },
        { status_banco: "aprovada" },
      ]),
    ).toBe(true);
  });

  it("libera edição dos dados depois da aprovação", () => {
    expect(STATUS_EDITAVEIS).toContain("credito_aprovado");
    expect(STATUS_EDITAVEIS).toContain("credito_condicionado");
  });
});

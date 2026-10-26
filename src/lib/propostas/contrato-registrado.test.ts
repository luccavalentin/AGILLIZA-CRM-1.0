import { describe, expect, it } from "vitest";
import {
  dataEmSaoPaulo,
  erroDataRegistro,
  formatarDataRegistro,
  hojeEmSaoPaulo,
  instanteDoRegistro,
} from "./contrato-registrado";
import { ORDEM_STATUS, TRANSICOES, transicaoPermitida } from "./state-machine";

// 26/10/2026 01:30 em São Paulo = 04:30 UTC.
const AGORA = new Date("2026-10-26T04:30:00Z");

describe("data do registro (C12)", () => {
  it("hoje em São Paulo, mesmo de madrugada em UTC", () => {
    expect(hojeEmSaoPaulo(new Date("2026-10-27T02:00:00Z"))).toBe("2026-10-26");
    expect(hojeEmSaoPaulo(AGORA)).toBe("2026-10-26");
  });
  it("aceita hoje e dias anteriores à frente da emissão", () => {
    expect(erroDataRegistro("2026-10-26", "2026-10-20T15:00:00Z", AGORA)).toBeNull();
    expect(erroDataRegistro("2026-10-20", "2026-10-20T15:00:00Z", AGORA)).toBeNull();
  });
  it("recusa futura", () => {
    expect(erroDataRegistro("2026-10-27", null, AGORA)).toMatch(/futura/);
  });
  it("recusa anterior à emissão (no calendário de São Paulo)", () => {
    // Emissão às 01:00 UTC de 21/10 = 22:00 de 20/10 em São Paulo.
    expect(erroDataRegistro("2026-10-19", "2026-10-21T01:00:00Z", AGORA)).toMatch(/20\/10\/2026/);
    expect(erroDataRegistro("2026-10-20", "2026-10-21T01:00:00Z", AGORA)).toBeNull();
  });
  it("formato torto, vazio e data inexistente", () => {
    expect(erroDataRegistro("", null, AGORA)).toMatch(/Informe/);
    expect(erroDataRegistro(null, null, AGORA)).toMatch(/Informe/);
    expect(erroDataRegistro("26/10/2026", null, AGORA)).toMatch(/inválida/);
    expect(erroDataRegistro("2026-02-30", null, AGORA)).toMatch(/inválida/);
    expect(erroDataRegistro("1999-12-31", null, AGORA)).toMatch(/inválida/);
    expect(erroDataRegistro("2026-10-26'; drop", null, AGORA)).toMatch(/inválida/);
  });
  it("emissão inválida é ignorada (não trava o registro)", () => {
    expect(erroDataRegistro("2026-10-26", "lixo", AGORA)).toBeNull();
  });
  it("grava meio-dia de São Paulo e mostra o mesmo dia", () => {
    const i = instanteDoRegistro("2026-10-25");
    expect(i).toBe("2026-10-25T15:00:00.000Z");
    expect(dataEmSaoPaulo(i)).toBe("2026-10-25");
    expect(formatarDataRegistro(i)).toBe("25/10/2026");
    expect(formatarDataRegistro(null)).toBeNull();
  });
});

describe("máquina de estados com o registro", () => {
  it("contrato emitido → registrado, e nada depois", () => {
    expect(transicaoPermitida("contrato_emitido", "registrado")).toBe(true);
    expect(TRANSICOES.registrado).toEqual([]);
  });
  it("não pula etapas nem volta", () => {
    expect(transicaoPermitida("analise_juridica", "registrado")).toBe(false);
    expect(transicaoPermitida("credito_aprovado", "registrado")).toBe(false);
    expect(transicaoPermitida("registrado", "contrato_emitido")).toBe(false);
  });
  it("registrado é o último da ordem", () => {
    expect(ORDEM_STATUS[ORDEM_STATUS.length - 1]).toBe("registrado");
    expect(ORDEM_STATUS.indexOf("registrado")).toBeGreaterThan(ORDEM_STATUS.indexOf("contrato_emitido"));
  });
});

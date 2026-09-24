import { describe, expect, it } from "vitest";
import { fgAutorizacaoDadosParticipante } from "./autorizacao-dados";

describe("fgAutorizacaoDadosParticipante", () => {
  it("todo participante vai com a autorização de dados em true", () => {
    expect(fgAutorizacaoDadosParticipante()).toBe(true);
  });
});

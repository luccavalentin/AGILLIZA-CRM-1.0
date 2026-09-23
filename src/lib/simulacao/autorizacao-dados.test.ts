import { afterEach, describe, expect, it } from "vitest";
import { fgAutorizacaoDadosParticipante } from "./autorizacao-dados";

const original = process.env.HOMEFIN_FG_AUTORIZACAO;

afterEach(() => {
  if (original === undefined) delete process.env.HOMEFIN_FG_AUTORIZACAO;
  else process.env.HOMEFIN_FG_AUTORIZACAO = original;
});

describe("fgAutorizacaoDadosParticipante", () => {
  it("manda false por padrão, mesmo com aceite no cadastro", () => {
    delete process.env.HOMEFIN_FG_AUTORIZACAO;
    expect(fgAutorizacaoDadosParticipante(true)).toBe(false);
    expect(fgAutorizacaoDadosParticipante(false)).toBe(false);
    expect(fgAutorizacaoDadosParticipante(null)).toBe(false);
  });

  it("com HOMEFIN_FG_AUTORIZACAO=true, segue o cadastro", () => {
    process.env.HOMEFIN_FG_AUTORIZACAO = "true";
    expect(fgAutorizacaoDadosParticipante(true)).toBe(true);
    expect(fgAutorizacaoDadosParticipante(false)).toBe(false);
    expect(fgAutorizacaoDadosParticipante(undefined)).toBe(false);
  });
});

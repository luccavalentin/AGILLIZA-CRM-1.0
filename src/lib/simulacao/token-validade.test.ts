import { describe, it, expect } from "vitest";
import { validadeDoToken } from "./homefin.server";

const AGORA = new Date("2026-08-30T12:00:00Z").getTime();
const PADRAO_MS = 25 * 60 * 1000;

/** Monta um JWT de mentira (só o payload importa para a leitura do `exp`). */
function jwtCom(payload: Record<string, unknown>): string {
  const base64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}.assinatura`;
}

describe("validade do token da integração", () => {
  it("usa o exp real do JWT em vez dos 25 minutos assumidos", () => {
    const expSegundos = Math.floor((AGORA + 15 * 60 * 1000) / 1000);
    expect(validadeDoToken(jwtCom({ exp: expSegundos }), AGORA)).toBe(expSegundos * 1000);
  });

  it("token sem exp cai no padrão conservador", () => {
    expect(validadeDoToken(jwtCom({ sub: "parceiro" }), AGORA)).toBe(AGORA + PADRAO_MS);
  });

  it("exp já vencido não é aceito", () => {
    const vencido = Math.floor((AGORA - 60_000) / 1000);
    expect(validadeDoToken(jwtCom({ exp: vencido }), AGORA)).toBe(AGORA + PADRAO_MS);
  });

  it("exp absurdamente longo não é aceito", () => {
    const daquiUmAno = Math.floor((AGORA + 365 * 24 * 3_600_000) / 1000);
    expect(validadeDoToken(jwtCom({ exp: daquiUmAno }), AGORA)).toBe(AGORA + PADRAO_MS);
  });

  it("token malformado não derruba a autenticação", () => {
    expect(validadeDoToken("não-é-um-jwt", AGORA)).toBe(AGORA + PADRAO_MS);
    expect(validadeDoToken("", AGORA)).toBe(AGORA + PADRAO_MS);
    expect(validadeDoToken("a.b.c", AGORA)).toBe(AGORA + PADRAO_MS);
  });
});

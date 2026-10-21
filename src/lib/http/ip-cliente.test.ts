import { describe, expect, it } from "vitest";
import { ipDoCliente } from "./ip-cliente";

const de = (h: Record<string, string>) => (n: string) => h[n];

describe("ipDoCliente", () => {
  it("prefere o IP real do proxy do domínio", () => {
    expect(
      ipDoCliente(de({ "cf-connecting-ip": "200.1.2.3", "x-forwarded-for": "172.21.0.1" })),
    ).toBe("200.1.2.3");
  });
  it("usa o primeiro da cadeia do X-Forwarded-For", () => {
    expect(ipDoCliente(de({ "x-forwarded-for": "200.1.2.3, 10.0.0.2" }))).toBe("200.1.2.3");
  });
  it("sem cabeçalho, nulo", () => {
    expect(ipDoCliente(de({}))).toBeNull();
  });
});

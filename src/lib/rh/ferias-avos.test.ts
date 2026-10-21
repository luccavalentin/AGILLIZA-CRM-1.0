import { describe, expect, it } from "vitest";
import { avosAte } from "./ferias-clt";

const d = (s: string) => new Date(`${s}T00:00:00`);

describe("avos de férias (CLT art. 146)", () => {
  it("admissão 01/08 e referência 19/10: 2 meses + 19 dias = 3/12", () => {
    expect(avosAte(d("2026-08-01"), d("2026-10-19"))).toBe(3);
  });
  it("fração de 14 dias não conta", () => {
    expect(avosAte(d("2026-08-01"), d("2026-10-14"))).toBe(2);
  });
  it("fração de 15 dias conta", () => {
    expect(avosAte(d("2026-08-01"), d("2026-10-15"))).toBe(3);
  });
  it("mês exato", () => {
    expect(avosAte(d("2026-08-01"), d("2026-09-30"))).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { valeValido } from "./download.server";

describe("vale de download da matrícula", () => {
  it("só aceita os 48 hexadecimais emitidos pelo banco", () => {
    expect(valeValido("a".repeat(48))).toBe(true);
    expect(valeValido("0123456789abcdef".repeat(3))).toBe(true);
    expect(valeValido("A".repeat(48))).toBe(false);
    expect(valeValido("a".repeat(47))).toBe(false);
    expect(valeValido("a".repeat(49))).toBe(false);
    expect(valeValido("../../outro-correspondente/arquivo.pdf")).toBe(false);
    expect(valeValido("")).toBe(false);
  });
});

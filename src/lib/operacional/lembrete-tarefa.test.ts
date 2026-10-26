import { describe, expect, it } from "vitest";
import { lembreteDoCampo, momentoDoLembrete, rotuloLembrete } from "./lembrete-tarefa";

describe("lembrete de tarefa", () => {
  it("rótulos", () => {
    expect(rotuloLembrete(null)).toBe("Sem lembrete");
    expect(rotuloLembrete(0)).toBe("Na hora do prazo");
    expect(rotuloLembrete(30)).toBe("30 min antes");
    expect(rotuloLembrete(90)).toBe("1,5 h antes");
    expect(rotuloLembrete(1440)).toBe("1 dia antes");
    expect(rotuloLembrete(2880)).toBe("2 dias antes");
    expect(rotuloLembrete(99999)).toBe("Sem lembrete");
  });
  it("campo da tela → minutos, entrada torta vira sem lembrete", () => {
    expect(lembreteDoCampo("nenhum")).toBeNull();
    expect(lembreteDoCampo("30")).toBe(30);
    expect(lembreteDoCampo("0")).toBe(0);
    expect(lembreteDoCampo("-5")).toBeNull();
    expect(lembreteDoCampo("10081")).toBeNull();
    expect(lembreteDoCampo("abc")).toBeNull();
    expect(lembreteDoCampo("1.5")).toBeNull();
  });
  it("momento do aviso", () => {
    expect(momentoDoLembrete("2026-10-26T12:00:00Z", 30)?.toISOString()).toBe("2026-10-26T11:30:00.000Z");
    expect(momentoDoLembrete(null, 30)).toBeNull();
    expect(momentoDoLembrete("2026-10-26T12:00:00Z", null)).toBeNull();
    expect(momentoDoLembrete("torta", 10)).toBeNull();
  });
});

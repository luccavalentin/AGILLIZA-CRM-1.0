import { describe, expect, it } from "vitest";
import { aplicarVariaveis } from "./respostas-rapidas";
import {
  datetimeLocalParaIso,
  isoParaDatetimeLocal,
} from "@/components/shared/chat-core/pecas/utils";


describe("datetime-local no horário de Brasília", () => {
  it("14:30 em Brasília é 17:30 UTC", () => {
    expect(datetimeLocalParaIso("2026-10-21T14:30")).toBe("2026-10-21T17:30:00.000Z");
  });

  it("ida e volta não deslocam a hora (o lembrete adiantava 3 h a cada salvar)", () => {
    const campo = "2026-10-21T22:15";
    let valor = campo;
    for (let i = 0; i < 3; i++) valor = isoParaDatetimeLocal(datetimeLocalParaIso(valor));
    expect(valor).toBe(campo);
  });

  it("instante salvo aparece na hora de Brasília, inclusive na virada do dia", () => {
    expect(isoParaDatetimeLocal("2026-10-22T01:00:00.000Z")).toBe("2026-10-21T22:00");
    expect(isoParaDatetimeLocal("2026-10-22T01:00:00+00:00")).toBe("2026-10-21T22:00");
  });

  it("vazio ou inválido não vira data", () => {
    expect(datetimeLocalParaIso("")).toBeNull();
    expect(datetimeLocalParaIso("21/10/2026 14:30")).toBeNull();
    expect(isoParaDatetimeLocal(null)).toBe("");
  });
});

describe("respostas rápidas", () => {
  it("banco sem nome não gera 'junto ao o banco'", () => {
    const t = aplicarVariaveis("Andamento junto ao {nome_banco}.", {});
    expect(t).toBe("Andamento junto ao banco.");
  });

  it("usa o nome da empresa e, sem ele, um texto neutro", () => {
    expect(aplicarVariaveis("Aqui é da equipe {empresa}.", { empresa: "Casa Crédito" })).toBe(
      "Aqui é da equipe Casa Crédito.",
    );
    expect(aplicarVariaveis("Aqui é da equipe {empresa}.", {})).toBe(
      "Aqui é da equipe de atendimento.",
    );
  });
});

import { describe, expect, it } from "vitest";
import { interpretarFrase } from "./frase-tarefa";

// Segunda, 26/10/2026 às 08:00 (horário local do teste).
const AGORA = new Date(2026, 9, 26, 8, 0, 0, 0);

describe("interpretarFrase (criação rápida de tarefa)", () => {
  it("entende o exemplo da tela com acento: amanhã às 10h", () => {
    const r = interpretarFrase("ligar para Maria amanhã às 10h", AGORA);
    expect(r.tipo).toBe("ligacao");
    expect(r.titulo).toBe("Ligar para Maria");
    expect(r.quando).toEqual(new Date(2026, 9, 27, 10, 0, 0, 0));
  });

  it("depois de amanhã não vira amanhã", () => {
    const r = interpretarFrase("reunião com o banco depois de amanhã 14h30", AGORA);
    expect(r.tipo).toBe("reuniao");
    expect(r.quando).toEqual(new Date(2026, 9, 28, 14, 30, 0, 0));
    expect(r.titulo).toBe("Reunião com o banco");
  });

  it("data com barra e ano curto", () => {
    const r = interpretarFrase("assinar contrato 05/11/26 as 9h", AGORA);
    expect(r.tipo).toBe("documento");
    expect(r.quando).toEqual(new Date(2026, 10, 5, 9, 0, 0, 0));
  });

  it("só hora: hoje naquela hora", () => {
    const r = interpretarFrase("visitar imóvel às 16:45", AGORA);
    expect(r.tipo).toBe("visita");
    expect(r.quando).toEqual(new Date(2026, 9, 26, 16, 45, 0, 0));
  });

  it("sem data fica sem data e vira lembrete", () => {
    const r = interpretarFrase("separar a pasta do Joaquim", AGORA);
    expect(r.tipo).toBe("lembrete");
    expect(r.quando).toBeNull();
    expect(r.titulo).toBe("Separar a pasta do Joaquim");
  });

  it("entrada torta: data impossível não vira outro dia calado", () => {
    expect(interpretarFrase("cobrar 31/02", AGORA).quando).toBeNull();
  });

  it("entrada torta: hora impossível não empurra a data", () => {
    const r = interpretarFrase("ligar hoje às 37h", AGORA);
    expect(r.quando).toEqual(new Date(2026, 9, 26, 9, 0, 0, 0));
  });

  it("palavra dentro de outra não engana (\"hojeiro\" não é hoje)", () => {
    expect(interpretarFrase("falar com o hojeiro", AGORA).quando).toBeNull();
  });

  it("frase só com a data mantém o texto como título", () => {
    expect(interpretarFrase("amanhã", AGORA).titulo).toBe("amanhã");
  });

  it("texto enorme é cortado", () => {
    expect(interpretarFrase("a".repeat(5000), AGORA).titulo.length).toBeLessThanOrEqual(300);
  });
});

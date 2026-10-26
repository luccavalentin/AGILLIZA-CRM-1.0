import { describe, expect, it } from "vitest";
import {
  consumoPrazo,
  estadoPrazo,
  exigeEncerrar,
  motivoValido,
  nomeTipoDemanda,
  proximosStatus,
  STATUS_DEMANDA_ORDEM,
  textoPrazo,
  transicaoDemandaPermitida,
  type DemandaStatus,
} from "./demandas-regras";

const agora = new Date("2026-10-26T12:00:00Z");

describe("transições da situação (mesma tabela do banco)", () => {
  it("permite o fluxo normal", () => {
    expect(transicaoDemandaPermitida("aberta", "em_andamento")).toBe(true);
    expect(transicaoDemandaPermitida("em_andamento", "aguardando")).toBe(true);
    expect(transicaoDemandaPermitida("aguardando", "concluida")).toBe(true);
  });
  it("concluída só reabre para em andamento; cancelada volta para nova", () => {
    expect(proximosStatus("concluida")).toEqual(["em_andamento"]);
    expect(proximosStatus("cancelada")).toEqual(["aberta"]);
    expect(transicaoDemandaPermitida("concluida", "aguardando")).toBe(false);
    expect(transicaoDemandaPermitida("cancelada", "concluida")).toBe(false);
  });
  it("não volta para Nova depois de começar", () => {
    expect(transicaoDemandaPermitida("em_andamento", "aberta")).toBe(false);
    expect(transicaoDemandaPermitida("aguardando", "aberta")).toBe(false);
  });
  it("a mesma situação é sempre aceita (sem efeito)", () => {
    for (const s of STATUS_DEMANDA_ORDEM) expect(transicaoDemandaPermitida(s, s)).toBe(true);
  });
  it("situação inventada não passa", () => {
    expect(transicaoDemandaPermitida("voando" as DemandaStatus, "aberta")).toBe(false);
    expect(proximosStatus("voando" as DemandaStatus)).toEqual([]);
  });
  it("concluir e cancelar exigem encerrar", () => {
    expect(exigeEncerrar("concluida")).toBe(true);
    expect(exigeEncerrar("cancelada")).toBe(true);
    expect(exigeEncerrar("aguardando")).toBe(false);
  });
});

describe("prazo", () => {
  it("classifica atrasada, vencendo (4h), no prazo e sem prazo", () => {
    expect(estadoPrazo("2026-10-26T11:00:00Z", "aberta", agora)).toBe("atrasada");
    expect(estadoPrazo("2026-10-26T15:00:00Z", "em_andamento", agora)).toBe("vencendo");
    expect(estadoPrazo("2026-10-27T12:00:00Z", "aguardando", agora)).toBe("no_prazo");
    expect(estadoPrazo(null, "aberta", agora)).toBe("sem_prazo");
    expect(estadoPrazo("data torta", "aberta", agora)).toBe("sem_prazo");
  });
  it("encerrada não tem alerta de prazo", () => {
    expect(estadoPrazo("2026-10-20T00:00:00Z", "concluida", agora)).toBe("encerrada");
    expect(textoPrazo("2026-10-20T00:00:00Z", "cancelada", agora)).toBe("Cancelada");
  });
  it("texto humano", () => {
    expect(textoPrazo("2026-10-26T12:40:00Z", "aberta", agora)).toBe("Vence em 40min");
    expect(textoPrazo("2026-10-26T09:00:00Z", "aberta", agora)).toBe("Atrasada há 3h");
    expect(textoPrazo("2026-10-29T12:00:00Z", "aberta", agora)).toBe("Vence em 3d");
    expect(textoPrazo(undefined, "aberta", agora)).toBe("Sem prazo");
  });
  it("consumo do prazo fica entre 0 e 1", () => {
    expect(consumoPrazo("2026-10-26T10:00:00Z", "2026-10-26T14:00:00Z", agora)).toBe(0.5);
    expect(consumoPrazo("2026-10-26T00:00:00Z", "2026-10-26T01:00:00Z", agora)).toBe(1);
    expect(consumoPrazo("2026-10-26T13:00:00Z", "2026-10-26T14:00:00Z", agora)).toBe(0);
    expect(consumoPrazo("2026-10-26T14:00:00Z", "2026-10-26T13:00:00Z", agora)).toBeNull();
    expect(consumoPrazo(null, "2026-10-26T13:00:00Z", agora)).toBeNull();
  });
});

describe("rótulos e entradas", () => {
  it("tipo antigo vira Outro; tipo próprio usa o nome configurado", () => {
    expect(nomeTipoDemanda("diversos")).toBe("Outro");
    expect(nomeTipoDemanda("consulta_ficha")).toBe("Consulta de ficha");
    expect(nomeTipoDemanda("vistoria", [{ codigo: "vistoria", nome: "Vistoria" }])).toBe("Vistoria");
    expect(nomeTipoDemanda(null)).toBe("Outro");
  });
  it("motivo de reatribuição: 5 a 500 letras, sem contar espaços das pontas", () => {
    expect(motivoValido("ok")).toBe(false);
    expect(motivoValido("     abc     ")).toBe(false);
    expect(motivoValido("cliente pediu")).toBe(true);
    expect(motivoValido("x".repeat(501))).toBe(false);
    expect(motivoValido(null)).toBe(false);
  });
});

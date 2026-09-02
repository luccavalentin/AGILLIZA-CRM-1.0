import { describe, it, expect } from "vitest";
import { intervaloMinimoMinutos, devesincronizar, filtrarParaSincronizar } from "./sync-backoff";

const AGORA = new Date("2026-08-30T12:00:00Z").getTime();
const horasAtras = (h: number) => new Date(AGORA - h * 3_600_000).toISOString();
const minutosAtras = (m: number) => new Date(AGORA - m * 60_000).toISOString();

describe("intervalo de consulta conforme a idade da proposta", () => {
  it("proposta recém-enviada mantém a cadência do cron", () => {
    expect(intervaloMinimoMinutos({ status_atualizado_em: minutosAtras(10) }, AGORA)).toBe(2);
  });

  it("parada há algumas horas espaça para 15 minutos", () => {
    expect(intervaloMinimoMinutos({ status_atualizado_em: horasAtras(6) }, AGORA)).toBe(15);
  });

  it("parada há dias espaça para 1 hora", () => {
    expect(intervaloMinimoMinutos({ status_atualizado_em: horasAtras(72) }, AGORA)).toBe(60);
  });

  it("parada há semanas espaça para 6 horas", () => {
    expect(intervaloMinimoMinutos({ status_atualizado_em: horasAtras(24 * 30) }, AGORA)).toBe(360);
  });

  it("usa created_at quando nunca houve mudança de status", () => {
    expect(intervaloMinimoMinutos({ created_at: horasAtras(24 * 10) }, AGORA)).toBe(360);
  });

  it("sem nenhuma data, assume a cadência mais frequente", () => {
    expect(intervaloMinimoMinutos({}, AGORA)).toBe(2);
    expect(intervaloMinimoMinutos({ status_atualizado_em: "data-invalida" }, AGORA)).toBe(2);
  });

  it("proposta antiga ENVIADA agora é consultada de perto", () => {
    // O envio ao banco não grava `status_atualizado_em` — só a sincronização
    // grava. Se olhássemos apenas esse campo, esta proposta cairia na faixa de
    // 6h justamente quando o retorno do banco é mais provável.
    const enviadaAgora = {
      created_at: horasAtras(24 * 40),
      status_atualizado_em: horasAtras(24 * 40),
      enviada_em: minutosAtras(3),
    };
    expect(intervaloMinimoMinutos(enviadaAgora, AGORA)).toBe(2);
  });

  it("usa sempre o marco mais recente entre os três", () => {
    const p = {
      created_at: horasAtras(24 * 40),
      enviada_em: horasAtras(24 * 20),
      status_atualizado_em: horasAtras(3),
    };
    expect(intervaloMinimoMinutos(p, AGORA)).toBe(15);
  });
});

describe("decisão de consultar agora", () => {
  it("nunca sincronizada sempre é consultada", () => {
    expect(
      devesincronizar(
        { ultima_sincronizacao_em: null, status_atualizado_em: horasAtras(500) },
        AGORA,
      ),
    ).toBe(true);
  });

  it("proposta parada há semanas não é reconsultada a cada 2 minutos", () => {
    const parada = {
      status_atualizado_em: horasAtras(24 * 30),
      ultima_sincronizacao_em: minutosAtras(2),
    };
    expect(devesincronizar(parada, AGORA)).toBe(false);
  });

  it("mas volta a ser consultada quando o intervalo dela vence", () => {
    const parada = {
      status_atualizado_em: horasAtras(24 * 30),
      ultima_sincronizacao_em: horasAtras(7),
    };
    expect(devesincronizar(parada, AGORA)).toBe(true);
  });

  it("proposta recém-enviada continua sendo consultada de perto", () => {
    const nova = {
      status_atualizado_em: minutosAtras(5),
      ultima_sincronizacao_em: minutosAtras(3),
    };
    expect(devesincronizar(nova, AGORA)).toBe(true);
  });
});

describe("filtro do lote do cron", () => {
  it("é exatamente o cenário que gerou 26 mil consultas", () => {
    // Duas propostas presas em análise há mais de um mês, consultadas há 2 min.
    const presas = [
      {
        id: "a",
        status_atualizado_em: horasAtras(24 * 36),
        ultima_sincronizacao_em: minutosAtras(2),
      },
      {
        id: "b",
        status_atualizado_em: horasAtras(24 * 36),
        ultima_sincronizacao_em: minutosAtras(2),
      },
    ];
    expect(filtrarParaSincronizar(presas, AGORA)).toEqual([]);
  });

  it("não deixa de fora quem realmente precisa ser consultado", () => {
    const lote = [
      {
        id: "nova",
        status_atualizado_em: minutosAtras(1),
        ultima_sincronizacao_em: minutosAtras(3),
      },
      {
        id: "presa",
        status_atualizado_em: horasAtras(24 * 30),
        ultima_sincronizacao_em: minutosAtras(2),
      },
      { id: "virgem", status_atualizado_em: null, ultima_sincronizacao_em: null },
    ];
    expect(filtrarParaSincronizar(lote, AGORA).map((p) => p.id)).toEqual(["nova", "virgem"]);
  });

  it("lista vazia não quebra", () => {
    expect(filtrarParaSincronizar([], AGORA)).toEqual([]);
  });
});

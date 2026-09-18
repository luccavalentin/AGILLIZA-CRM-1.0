import { describe, it, expect } from "vitest";
import {
  devesincronizar,
  emHorarioComercial,
  filtrarParaSincronizar,
  intervaloMinimoMinutos,
} from "./sync-backoff";

// Quarta-feira, 16/09/2026, 14:00 em Brasília (17:00 UTC).
const COMERCIAL = new Date("2026-09-16T17:00:00Z").getTime();
// Mesma quarta, 23:00 em Brasília.
const NOITE = new Date("2026-09-17T02:00:00Z").getTime();
// Sábado, 12:00 em Brasília.
const SABADO = new Date("2026-09-19T15:00:00Z").getTime();

const minAtras = (base: number, m: number) => new Date(base - m * 60_000).toISOString();

describe("horário comercial (Brasília)", () => {
  it("dia útil das 8h às 20h", () => {
    expect(emHorarioComercial(COMERCIAL)).toBe(true);
    expect(emHorarioComercial(NOITE)).toBe(false);
    expect(emHorarioComercial(SABADO)).toBe(false);
  });
});

describe("intervalo por banco e fase", () => {
  const recente = { status_atualizado_em: minAtras(COMERCIAL, 30) };

  it("análise de crédito: Itaú e Santander 1 min, Bradesco 3 min", () => {
    for (const nome of ["Itaú", "Santander"]) {
      expect(
        intervaloMinimoMinutos(
          { ...recente, status: "em_analise_credito", nome_banco: nome },
          COMERCIAL,
        ),
      ).toBe(1);
    }
    expect(
      intervaloMinimoMinutos(
        { ...recente, status: "em_analise_credito", nome_banco: "Bradesco" },
        COMERCIAL,
      ),
    ).toBe(3);
  });

  it("aprovada e etapas seguintes: Itaú e Santander 2 min, Bradesco 10 min", () => {
    for (const status of ["credito_aprovado", "credito_condicionado", "analise_juridica"]) {
      expect(intervaloMinimoMinutos({ ...recente, status, nome_banco: "Itaú" }, COMERCIAL)).toBe(2);
      expect(
        intervaloMinimoMinutos({ ...recente, status, nome_banco: "Santander" }, COMERCIAL),
      ).toBe(2);
      expect(
        intervaloMinimoMinutos({ ...recente, status, nome_banco: "Bradesco" }, COMERCIAL),
      ).toBe(10);
    }
  });

  it("fora do horário: análise 15 min, demais 1 hora", () => {
    const base = { status_atualizado_em: minAtras(NOITE, 30), nome_banco: "Itaú" };
    expect(intervaloMinimoMinutos({ ...base, status: "em_analise_credito" }, NOITE)).toBe(15);
    expect(intervaloMinimoMinutos({ ...base, status: "credito_aprovado" }, NOITE)).toBe(60);
    expect(intervaloMinimoMinutos({ ...base, status: "credito_aprovado" }, SABADO)).toBe(60);
  });

  it("parada há mais de 30 dias: no máximo de hora em hora", () => {
    const parada = {
      status: "credito_aprovado",
      nome_banco: "Itaú",
      status_atualizado_em: minAtras(COMERCIAL, 31 * 24 * 60),
    };
    expect(intervaloMinimoMinutos(parada, COMERCIAL)).toBe(60);
  });
});

describe("decisão de consultar agora", () => {
  it("nunca consultada sempre é consultada", () => {
    expect(devesincronizar({ status: "credito_aprovado", nome_banco: "Itaú" }, COMERCIAL)).toBe(
      true,
    );
  });

  it("respeita o intervalo a partir da última consulta do servidor", () => {
    const p = {
      status: "credito_aprovado",
      nome_banco: "Bradesco",
      status_atualizado_em: minAtras(COMERCIAL, 60),
    };
    expect(devesincronizar({ ...p, ultima_consulta_em: minAtras(COMERCIAL, 5) }, COMERCIAL)).toBe(
      false,
    );
    expect(devesincronizar({ ...p, ultima_consulta_em: minAtras(COMERCIAL, 10) }, COMERCIAL)).toBe(
      true,
    );
  });

  it("usa a leitura mais recente entre o estado do servidor e a da proposta", () => {
    const p = {
      status: "credito_aprovado",
      nome_banco: "Itaú",
      ultima_consulta_em: minAtras(COMERCIAL, 30),
      ultima_sincronizacao_em: minAtras(COMERCIAL, 1),
    };
    expect(devesincronizar(p, COMERCIAL)).toBe(false);
  });

  it("Bradesco em análise espera 5 min após o envio", () => {
    const p = { status: "em_analise_credito", nome_banco: "Bradesco" };
    expect(devesincronizar({ ...p, enviada_em: minAtras(COMERCIAL, 2) }, COMERCIAL)).toBe(false);
    expect(devesincronizar({ ...p, enviada_em: minAtras(COMERCIAL, 6) }, COMERCIAL)).toBe(true);
  });

  it("filtra a lista mantendo só as vencidas", () => {
    const lista = [
      {
        id: "a",
        status: "credito_aprovado",
        nome_banco: "Itaú",
        ultima_consulta_em: minAtras(COMERCIAL, 3),
      },
      {
        id: "b",
        status: "credito_aprovado",
        nome_banco: "Bradesco",
        ultima_consulta_em: minAtras(COMERCIAL, 3),
      },
    ];
    expect(filtrarParaSincronizar(lista, COMERCIAL).map((p) => p.id)).toEqual(["a"]);
  });
});

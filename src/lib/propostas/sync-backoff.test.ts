import { describe, it, expect } from "vitest";
import {
  creditoDecidido,
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

const POS_CREDITO = [
  "credito_aprovado",
  "credito_condicionado",
  "aguardando_documentos",
  "engenharia_vistoria",
  "analise_juridica",
];

describe("horário comercial (Brasília)", () => {
  it("dia útil das 8h às 20h", () => {
    expect(emHorarioComercial(COMERCIAL)).toBe(true);
    expect(emHorarioComercial(NOITE)).toBe(false);
    expect(emHorarioComercial(SABADO)).toBe(false);
  });
});

describe("depois da decisão de crédito", () => {
  it("nenhum banco é consultado sozinho, nem a primeira vez", () => {
    for (const nome_banco of ["Itaú", "BANCO ITAU S.A.", "Santander", "Bradesco"]) {
      for (const status of POS_CREDITO) {
        const p = { status, nome_banco, ultima_consulta_em: minAtras(COMERCIAL, 5 * 24 * 60) };
        expect(creditoDecidido(p)).toBe(true);
        expect(devesincronizar(p, COMERCIAL)).toBe(false);
        expect(devesincronizar({ status, nome_banco }, COMERCIAL)).toBe(false);
      }
    }
  });

  it("na análise de crédito continuam sendo consultados", () => {
    for (const nome_banco of ["Itaú", "Santander", "Bradesco"]) {
      const p = { status: "em_analise_credito", nome_banco };
      expect(creditoDecidido(p)).toBe(false);
      expect(devesincronizar(p, COMERCIAL)).toBe(true);
    }
  });
});

describe("intervalo por banco e fase", () => {
  it("análise na 1ª hora após o envio: Itaú/Santander 2 min, Bradesco 5 min", () => {
    const base = { status: "em_analise_credito", enviada_em: minAtras(COMERCIAL, 20) };
    expect(intervaloMinimoMinutos({ ...base, nome_banco: "Itaú" }, COMERCIAL)).toBe(2);
    expect(intervaloMinimoMinutos({ ...base, nome_banco: "Santander" }, COMERCIAL)).toBe(2);
    expect(intervaloMinimoMinutos({ ...base, nome_banco: "Bradesco" }, COMERCIAL)).toBe(5);
  });

  it("análise depois da 1ª hora: 10 min para todos", () => {
    const base = { status: "em_analise_credito", enviada_em: minAtras(COMERCIAL, 90) };
    for (const nome_banco of ["Itaú", "Santander", "Bradesco"]) {
      expect(intervaloMinimoMinutos({ ...base, nome_banco }, COMERCIAL)).toBe(10);
    }
  });

  it("análise fora do horário: 30 min", () => {
    const p = {
      status: "em_analise_credito",
      nome_banco: "Bradesco",
      enviada_em: minAtras(NOITE, 20),
    };
    expect(intervaloMinimoMinutos(p, NOITE)).toBe(30);
  });

  it("análise sem decisão há mais de 24 h: 1 consulta por dia útil", () => {
    const parada = {
      status: "em_analise_credito",
      nome_banco: "Santander",
      enviada_em: minAtras(COMERCIAL, 25 * 60),
    };
    expect(intervaloMinimoMinutos(parada, COMERCIAL)).toBe(24 * 60);
    expect(intervaloMinimoMinutos(parada, NOITE)).toBe(24 * 60);
    expect(
      devesincronizar({ ...parada, ultima_consulta_em: minAtras(COMERCIAL, 60) }, COMERCIAL),
    ).toBe(false);
    // No fim de semana não consulta.
    expect(devesincronizar({ ...parada, enviada_em: minAtras(SABADO, 3 * 24 * 60) }, SABADO)).toBe(
      false,
    );
    // Reenviada hoje: volta ao ritmo curto.
    expect(
      intervaloMinimoMinutos({ ...parada, enviada_em: minAtras(COMERCIAL, 10) }, COMERCIAL),
    ).toBe(2);
  });
});

describe("decisão de consultar agora", () => {
  it("em análise e nunca consultada: consulta", () => {
    expect(devesincronizar({ status: "em_analise_credito", nome_banco: "Itaú" }, COMERCIAL)).toBe(
      true,
    );
  });

  it("respeita o intervalo a partir da última consulta do servidor", () => {
    const p = {
      status: "em_analise_credito",
      nome_banco: "Itaú",
      enviada_em: minAtras(COMERCIAL, 90),
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
      status: "em_analise_credito",
      nome_banco: "Itaú",
      enviada_em: minAtras(COMERCIAL, 90),
      ultima_consulta_em: minAtras(COMERCIAL, 60),
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
        status: "em_analise_credito",
        nome_banco: "Itaú",
        enviada_em: minAtras(COMERCIAL, 10),
        ultima_consulta_em: minAtras(COMERCIAL, 3),
      },
      {
        id: "b",
        status: "credito_aprovado",
        nome_banco: "Bradesco",
        ultima_consulta_em: minAtras(COMERCIAL, 3 * 24 * 60),
      },
      {
        id: "c",
        status: "credito_condicionado",
        nome_banco: "Santander",
        ultima_consulta_em: minAtras(COMERCIAL, 600),
      },
    ];
    expect(filtrarParaSincronizar(lista, COMERCIAL).map((p) => p.id)).toEqual(["a"]);
  });
});

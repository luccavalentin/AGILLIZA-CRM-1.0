import { describe, it, expect } from "vitest";
import {
  andamentoForaDaHomefin,
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

describe("Itaú e Santander depois do crédito", () => {
  it("não consultam mais a HomeFin: o andamento vem do robô dos portais", () => {
    for (const nome_banco of ["Itaú", "BANCO ITAU S.A.", "Santander"]) {
      for (const status of POS_CREDITO) {
        const p = { status, nome_banco, ultima_consulta_em: minAtras(COMERCIAL, 600) };
        expect(andamentoForaDaHomefin(p)).toBe(true);
        expect(devesincronizar(p, COMERCIAL)).toBe(false);
        // Nem a primeira consulta.
        expect(devesincronizar({ status, nome_banco }, COMERCIAL)).toBe(false);
      }
    }
  });

  it("na análise de crédito continuam sendo consultados", () => {
    const p = { status: "em_analise_credito", nome_banco: "Itaú" };
    expect(andamentoForaDaHomefin(p)).toBe(false);
    expect(devesincronizar(p, COMERCIAL)).toBe(true);
  });

  it("Bradesco depois do crédito continua (follow-up vem pela HomeFin)", () => {
    for (const status of POS_CREDITO) {
      expect(andamentoForaDaHomefin({ status, nome_banco: "Bradesco" })).toBe(false);
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

  it("Bradesco depois da decisão de crédito: 1 vez por dia, em qualquer horário", () => {
    for (const status of POS_CREDITO) {
      const p = { status, nome_banco: "Bradesco", status_atualizado_em: minAtras(COMERCIAL, 60) };
      expect(intervaloMinimoMinutos(p, COMERCIAL)).toBe(24 * 60);
      expect(intervaloMinimoMinutos(p, NOITE)).toBe(24 * 60);
      expect(intervaloMinimoMinutos(p, SABADO)).toBe(24 * 60);
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

  it("análise parada há mais de 7 dias: no máximo a cada 4 h", () => {
    const parada = {
      status: "em_analise_credito",
      nome_banco: "Bradesco",
      enviada_em: minAtras(COMERCIAL, 8 * 24 * 60),
    };
    expect(intervaloMinimoMinutos(parada, COMERCIAL)).toBe(240);
  });
});

describe("decisão de consultar agora", () => {
  it("nunca consultada é consultada (se o andamento vem da HomeFin)", () => {
    expect(devesincronizar({ status: "credito_aprovado", nome_banco: "Bradesco" }, COMERCIAL)).toBe(
      true,
    );
  });

  it("respeita o intervalo a partir da última consulta do servidor", () => {
    const p = {
      status: "credito_aprovado",
      nome_banco: "Bradesco",
      status_atualizado_em: minAtras(COMERCIAL, 60),
    };
    expect(
      devesincronizar({ ...p, ultima_consulta_em: minAtras(COMERCIAL, 23 * 60) }, COMERCIAL),
    ).toBe(false);
    expect(
      devesincronizar({ ...p, ultima_consulta_em: minAtras(COMERCIAL, 24 * 60) }, COMERCIAL),
    ).toBe(true);
  });

  it("usa a leitura mais recente entre o estado do servidor e a da proposta", () => {
    const p = {
      status: "credito_aprovado",
      nome_banco: "Bradesco",
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
        ultima_consulta_em: minAtras(COMERCIAL, 3),
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

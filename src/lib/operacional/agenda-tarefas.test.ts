import { describe, expect, it } from "vitest";
import { agruparAgenda, metricasAgenda, type TarefaDaAgenda } from "./agenda-tarefas";

const AGORA = new Date(2026, 9, 26, 12, 0, 0, 0);
const h = (horas: number) => new Date(AGORA.getTime() + horas * 3_600_000).toISOString();

const T = (id: string, status: string, prazo: string | null, concluida_em?: string | null): TarefaDaAgenda => ({
  id,
  status,
  prazo,
  concluida_em: concluida_em ?? null,
});

describe("agruparAgenda", () => {
  const tarefas = [
    T("atrasada", "aberta", h(-30)),
    T("hoje", "em_andamento", h(3)),
    T("semana", "aberta", h(48)),
    T("depois", "aberta", h(24 * 30)),
    T("semdata", "aberta", null),
    T("feita", "concluida", h(-5), h(-2)),
    T("velha", "concluida", h(-24 * 40), h(-24 * 30)),
    T("cancelada", "cancelada", null, null),
  ];

  it("separa por quando, na ordem da agenda, sem grupos vazios", () => {
    const g = agruparAgenda(tarefas, AGORA);
    expect(g.map((x) => x.chave)).toEqual(["atrasadas", "hoje", "semana", "depois", "sem-data", "feitas"]);
    expect(g.find((x) => x.chave === "atrasadas")!.tarefas.map((t) => t.id)).toEqual(["atrasada"]);
    expect(g.find((x) => x.chave === "hoje")!.tarefas.map((t) => t.id)).toEqual(["hoje"]);
  });

  it("concluída há mais de 14 dias sai da lista; cancelada sem data continua", () => {
    const feitas = agruparAgenda(tarefas, AGORA).find((x) => x.chave === "feitas")!.tarefas.map((t) => t.id);
    expect(feitas).toContain("feita");
    expect(feitas).toContain("cancelada");
    expect(feitas).not.toContain("velha");
  });

  it("lista vazia não gera grupo", () => {
    expect(agruparAgenda([], AGORA)).toEqual([]);
  });

  it("prazo inválido conta como sem data (não quebra)", () => {
    const g = agruparAgenda([T("x", "aberta", "não é data")], AGORA);
    expect(g[0].chave).toBe("sem-data");
  });
});

describe("metricasAgenda", () => {
  it("conta atrasadas, hoje, 7 dias e concluídas na semana", () => {
    const m = metricasAgenda(
      [
        T("a", "aberta", h(-1)), // atrasada e de hoje
        T("b", "aberta", h(2)), // hoje e na semana
        T("c", "aberta", h(24 * 3)), // semana
        T("d", "concluida", h(-3), h(-1)), // concluída na semana
        T("e", "concluida", h(-300), h(-24 * 9)), // concluída há 9 dias
        T("f", "cancelada", h(-1)), // cancelada não conta
      ],
      AGORA,
    );
    expect(m).toEqual({ atrasadas: 1, hoje: 2, semana: 2, concluidasSemana: 1 });
  });
});

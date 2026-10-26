import { describe, expect, it } from "vitest";
import { anosCompletos, calcularRescisao, checklistSaidaInicial, diasAvisoPrevio } from "./rescisao";

const base = {
  salario: 3000,
  data_admissao: "2023-03-01",
  data_desligamento: "2026-10-20",
  ferias_vencidas_dias: 0,
};
const valor = (r: ReturnType<typeof calcularRescisao>, codigo: string) =>
  r.linhas.find((l) => l.codigo === codigo)?.valor ?? 0;

describe("aviso prévio proporcional", () => {
  it("30 + 3 por ano completo, até 90", () => {
    expect(anosCompletos("2023-03-01", "2026-02-28")).toBe(2);
    expect(diasAvisoPrevio("2023-03-01", "2026-10-20")).toBe(39);
    expect(diasAvisoPrevio("2010-01-10", "2026-10-20")).toBe(78);
    expect(diasAvisoPrevio("2000-01-10", "2026-10-20")).toBe(90);
    expect(diasAvisoPrevio("2026-09-01", "2026-10-20")).toBe(30);
  });
});

describe("verbas rescisórias", () => {
  it("sem justa causa com aviso indenizado: projeção conta no 13º e nas férias", () => {
    const r = calcularRescisao({ ...base, tipo: "sem_justa_causa", aviso: "indenizado" });
    expect(valor(r, "S01")).toBe(2000); // 20 dias
    expect(valor(r, "S02")).toBe(3900); // 39 dias
    expect(r.data_projetada).toBe("2026-11-28");
    expect(valor(r, "S03")).toBe(2750); // 11/12
    expect(valor(r, "S05")).toBe(3000); // 9/12 + 1/3
    expect(valor(r, "F01")).toBe(4224); // 40% de 8% × 44 meses
    expect(r.total_proventos).toBe(11650);
    expect(r.liquido_estimado).toBe(11650); // multa é informativa (conta vinculada)
  });

  it("justa causa: só saldo de salário e férias vencidas", () => {
    const r = calcularRescisao({ ...base, tipo: "justa_causa", aviso: "dispensado", ferias_vencidas_dias: 30 });
    expect(r.linhas.map((l) => l.codigo).sort()).toEqual(["S01", "S04"]);
    expect(valor(r, "S04")).toBe(4000);
    expect(r.total_proventos).toBe(6000);
  });

  it("pedido de demissão sem cumprir o aviso desconta 30 dias e não tem multa", () => {
    const r = calcularRescisao({ ...base, tipo: "pedido_demissao", aviso: "indenizado" });
    expect(valor(r, "D01")).toBe(3000);
    expect(valor(r, "S03")).toBe(2500); // 10/12, sem projeção
    expect(valor(r, "S05")).toBe(2666.67);
    expect(valor(r, "F01")).toBe(0);
    expect(r.liquido_estimado).toBe(Math.round((2000 + 2500 + 2666.67 - 3000) * 100) / 100);
  });

  it("acordo: metade do aviso e multa de 20%", () => {
    const r = calcularRescisao({ ...base, tipo: "acordo", aviso: "indenizado", saldo_fgts: 10000 });
    expect(valor(r, "S02")).toBe(1950);
    expect(valor(r, "F01")).toBe(2000);
  });

  it("desligamento antes da admissão é recusado", () => {
    expect(() =>
      calcularRescisao({ ...base, data_desligamento: "2023-02-01", tipo: "sem_justa_causa", aviso: "trabalhado" }),
    ).toThrow();
  });

  it("checklist de saída começa todo pendente", () => {
    const c = checklistSaidaInicial();
    expect(c.length).toBeGreaterThanOrEqual(6);
    expect(c.every((i) => !i.feito && i.feito_em === null)).toBe(true);
  });
});

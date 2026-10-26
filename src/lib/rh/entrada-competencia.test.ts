import { describe, expect, it } from "vitest";
import { calcularHolerite } from "./holerite-calc";
import { tabelaVigente } from "./clt";
import { TABELAS_PADRAO } from "./__fixtures__/tabelas-fiscais";
import {
  faltasNaCompetencia,
  jornadaMensal,
  montarEntradaDaCompetencia,
  salarioNaCompetencia,
  type DadosCompetencia,
} from "./entrada-competencia";

const OUT = { ano: 2026, mes: 10 };
const T = tabelaVigente(TABELAS_PADRAO, OUT)!;

/** O caso da QA: CLT R$ 3.500, falta em 06/10, adiantamento, VT, VR, dependente e lançamentos. */
const caso: DadosCompetencia = {
  salarioAtual: 3500,
  jornadaSemanal: 44,
  alteracoesSalariais: [{ vigencia: "2026-11-01", salario_anterior: 3500, salario_novo: 4000 }],
  beneficios: [
    { nome: "Vale-transporte", valor: 300, desconto: 300, vigencia_inicio: "2026-08-01", vigencia_fim: null },
    { nome: "Vale-refeição", valor: 660.5, desconto: 0, vigencia_inicio: "2026-08-01", vigencia_fim: "2026-09-01" },
  ],
  faltas: [{ data_inicio: "2026-10-06", data_fim: "2026-10-06", abonada: false }],
  adiantamentos: [1400],
  lancamentos: [
    { tipo: "desconto", quantidade: null, valor: 150.75 },
    { tipo: "outro_provento", quantidade: null, valor: 200 },
  ],
  dependentes: [{ ir: true, salario_familia: false, data_nascimento: "2015-03-10" }],
};

describe("entrada da competência", () => {
  it("salário vigente: alteração futura não vale no mês", () => {
    expect(salarioNaCompetencia(caso, OUT)).toBe(3500);
    expect(salarioNaCompetencia(caso, { ano: 2026, mes: 11 })).toBe(4000);
  });

  it("falta não abonada desconta o dia e o DSR da semana", () => {
    expect(faltasNaCompetencia(caso, OUT)).toEqual({ dias: 1, dsr: 1 });
    const abonada = { ...caso, faltas: [{ ...caso.faltas[0], abonada: true }] };
    expect(faltasNaCompetencia(abonada, OUT)).toEqual({ dias: 0, dsr: 0 });
  });

  it("monta a entrada com VT no teto de 6%, VR fora de vigência ignorado e lançamentos do mês", () => {
    const e = montarEntradaDaCompetencia(caso, OUT);
    expect(e.desconta_vt).toBe(true);
    expect(e.desconta_vr).toBe(false);
    expect(e.adiantamento).toBe(1400);
    expect(e.outros_descontos).toBe(150.75);
    expect(e.outros_proventos).toBe(200);
    expect(e.dependentes_ir).toBe(1);
    const h = calcularHolerite(e, T);
    const vt = h.descontos.find((l) => l.codigo === "120");
    expect(vt?.valor).toBe(210); // 6% de 3.500, não os 300 informados
    expect(h.descontos.some((l) => l.codigo === "140" && l.valor === 1400)).toBe(true);
    expect(h.descontos.some((l) => l.codigo === "101")).toBe(true); // falta
    expect(h.liquido).toBe(Math.round((h.total_proventos - h.total_descontos) * 100) / 100);
  });

  it("horas extras, noturno e atraso entram pelo valor-hora da jornada da ficha", () => {
    const e = montarEntradaDaCompetencia(
      {
        ...caso,
        faltas: [],
        adiantamentos: [],
        beneficios: [],
        lancamentos: [
          { tipo: "hora_extra_50", quantidade: 10, valor: 0 },
          { tipo: "hora_extra_100", quantidade: 2, valor: 0 },
          { tipo: "adicional_noturno", quantidade: 5, valor: 0 },
          { tipo: "atraso", quantidade: 3, valor: 0 },
          { tipo: "comissao", quantidade: null, valor: 500 },
          { tipo: "emprestimo_consignado", quantidade: null, valor: 120 },
        ],
      },
      OUT,
    );
    expect(e.jornada_mensal).toBe(220);
    expect(e.horas_extras_50).toBe(10);
    expect(e.atrasos_horas).toBe(3);
    expect(e.comissoes).toBe(500);
    expect(e.emprestimo_consignado).toBe(120);
    const h = calcularHolerite(e, T);
    const hora = 3500 / 220;
    expect(h.proventos.find((l) => l.codigo === "010")?.valor).toBe(Math.round(10 * hora * 1.5 * 100) / 100);
    expect(h.proventos.find((l) => l.codigo === "011")?.valor).toBe(Math.round(2 * hora * 2 * 100) / 100);
    expect(h.descontos.find((l) => l.codigo === "103")?.valor).toBe(Math.round(3 * hora * 100) / 100);
    expect(h.descontos.find((l) => l.codigo === "141")?.valor).toBe(120);
  });

  it("jornada mensal: 44 h → 220 h; 30 h → 150 h; sem jornada → 220 h", () => {
    expect(jornadaMensal(44)).toBe(220);
    expect(jornadaMensal(30)).toBe(150);
    expect(jornadaMensal(null)).toBe(220);
  });
});

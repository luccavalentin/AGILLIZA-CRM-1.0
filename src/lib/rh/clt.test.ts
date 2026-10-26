import { describe, expect, it } from "vitest";
import { calcularINSS, calcularIRRFMensal, normalizarTabelaFiscal, tabelaVigente } from "./clt";
import { TABELAS_PADRAO, TABELA_2025, TABELA_2026 } from "./__fixtures__/tabelas-fiscais";

const OUT_2026 = { ano: 2026, mes: 10 };
const MAR_2025 = { ano: 2025, mes: 3 };
const t26 = tabelaVigente(TABELAS_PADRAO, OUT_2026)!;
const t25 = tabelaVigente(TABELAS_PADRAO, MAR_2025)!;

describe("tabela vigente na competência", () => {
  it("escolhe a vigência mais recente até a competência", () => {
    expect(t26.vigencia_desde).toBe("2026-01-01");
    expect(t25.vigencia_desde).toBe("2025-01-01");
    expect(tabelaVigente(TABELAS_PADRAO, { ano: 2024, mes: 12 })).toBeNull();
  });
  it("na mesma data, a vigência própria do correspondente vence a padrão", () => {
    const propria = { ...TABELA_2026, correspondente_id: "c1", salario_minimo: 1700 };
    expect(tabelaVigente([TABELA_2026, propria], OUT_2026)!.salario_minimo).toBe(1700);
    expect(tabelaVigente([propria, TABELA_2026], OUT_2026)!.salario_minimo).toBe(1700);
  });
  it("vigência própria nova (maio/2026) só vale a partir dela", () => {
    const maio = { ...TABELA_2026, correspondente_id: "c1", vigencia_desde: "2026-05-01", salario_minimo: 1800 };
    expect(tabelaVigente([...TABELAS_PADRAO, maio], { ano: 2026, mes: 4 })!.salario_minimo).toBe(1621);
    expect(tabelaVigente([...TABELAS_PADRAO, maio], { ano: 2026, mes: 5 })!.salario_minimo).toBe(1800);
  });
  it("normaliza a linha do banco (numeric em texto, última faixa sem limite)", () => {
    const t = normalizarTabelaFiscal({
      vigencia_desde: "2026-01-01",
      salario_minimo: "1621.00",
      inss_faixas: [{ ate: "1621", aliquota: "0.075" }],
      irrf_faixas: [{ ate: null, aliquota: "0.275", deducao: "908.73" }],
      irrf_dependente: "189.59",
      irrf_desconto_simplificado: "607.20",
      irrf_reducao: null,
      salario_familia_quota: "67.54",
      salario_familia_teto: "1980.38",
      fgts_aliquota: "0.0800",
    });
    expect(t.salario_minimo).toBe(1621);
    expect(t.irrf_faixas[0].ate).toBeNull();
    expect(t.fgts_aliquota).toBe(0.08);
  });
});

describe("INSS por vigência", () => {
  it("2026: teto de R$ 8.475,55 dá o desconto máximo de R$ 988,09", () => {
    expect(calcularINSS(20000, t26).valor).toBe(988.09);
  });
  it("2026: R$ 3.500 (faixas 1 a 3)", () => {
    // 1621×7,5% + (2902,84−1621)×9% + (3500−2902,84)×12% = 121,58 + 115,37 + 71,66
    expect(calcularINSS(3500, t26).valor).toBe(308.6);
  });
  it("2025 continua com a tabela de 2025", () => {
    expect(calcularINSS(20000, t25).valor).toBe(951.63);
  });
  it("tabela alterada pelo correspondente muda o cálculo (nada fixo no código)", () => {
    const t = { ...TABELA_2026, inss_faixas: [{ ate: 10000, aliquota: 0.1 }] };
    expect(calcularINSS(3000, t).valor).toBe(300);
  });
});

describe("IRRF 2026 (Lei 15.270/2025)", () => {
  it("até R$ 5.000 não paga imposto", () => {
    const inss = calcularINSS(5000, t26).valor;
    expect(calcularIRRFMensal({ rendimento: 5000, inss }, t26).valor).toBe(0);
  });
  it("entre R$ 5.000 e R$ 7.350 a redução diminui com a renda", () => {
    const inss = calcularINSS(6500, t26).valor;
    const r = calcularIRRFMensal({ rendimento: 6500, inss }, t26);
    expect(r.reducao).toBe(113.18); // 978,62 − 0,133145 × 6.500
    expect(r.valor).toBeGreaterThan(0);
  });
  it("acima de R$ 7.350 não há redução", () => {
    const inss = calcularINSS(9000, t26).valor;
    expect(calcularIRRFMensal({ rendimento: 9000, inss }, t26).reducao).toBe(0);
  });
  it("em 2025 não há redução da Lei 15.270", () => {
    const inss = calcularINSS(4000, t25).valor;
    const r = calcularIRRFMensal({ rendimento: 4000, inss }, t25);
    expect(r.reducao).toBe(0);
    expect(r.valor).toBeGreaterThan(0);
  });
  it("desconto simplificado vale quando é maior que as deduções legais", () => {
    // R$ 3.000 em 2025: INSS 2025 ≈ 253,41 < 607,20 → base = 3.000 − 607,20
    const inss = calcularINSS(3000, t25).valor;
    expect(calcularIRRFMensal({ rendimento: 3000, inss }, t25).base).toBe(2392.8);
  });
  it("dependente deduz o valor da tabela", () => {
    const inss = calcularINSS(9000, TABELA_2025).valor;
    const sem = calcularIRRFMensal({ rendimento: 9000, inss }, TABELA_2025);
    const com = calcularIRRFMensal({ rendimento: 9000, inss, dependentes: 2 }, TABELA_2025);
    expect(Math.round((sem.base - com.base) * 100) / 100).toBe(379.18);
  });
});

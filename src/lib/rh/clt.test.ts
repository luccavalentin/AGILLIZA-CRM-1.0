import { describe, expect, it } from "vitest";
import { calcularINSS, calcularIRRFMensal, salarioFamilia, salarioMinimo } from "./clt";

const OUT_2026 = { ano: 2026, mes: 10 };
const MAR_2025 = { ano: 2025, mes: 3 };

describe("INSS por vigência", () => {
  it("2026: teto de R$ 8.475,55 dá o desconto máximo de R$ 988,09", () => {
    expect(calcularINSS(20000, OUT_2026).valor).toBe(988.09);
  });
  it("2026: R$ 3.500 (faixas 1 a 3)", () => {
    // 1621×7,5% + (2902,84−1621)×9% + (3500−2902,84)×12% = 121,58 + 115,37 + 71,66
    expect(calcularINSS(3500, OUT_2026).valor).toBe(308.6);
  });
  it("2025 continua com a tabela de 2025", () => {
    expect(calcularINSS(20000, MAR_2025).valor).toBe(951.63);
  });
});

describe("IRRF 2026 (Lei 15.270/2025)", () => {
  it("até R$ 5.000 não paga imposto", () => {
    const inss = calcularINSS(5000, OUT_2026).valor;
    expect(calcularIRRFMensal({ rendimento: 5000, inss, competencia: OUT_2026 }).valor).toBe(0);
  });
  it("entre R$ 5.000 e R$ 7.350 a redução diminui com a renda", () => {
    const inss = calcularINSS(6500, OUT_2026).valor;
    const r = calcularIRRFMensal({ rendimento: 6500, inss, competencia: OUT_2026 });
    expect(r.reducao).toBe(113.18); // 978,62 − 0,133145 × 6.500
    expect(r.valor).toBeGreaterThan(0);
  });
  it("acima de R$ 7.350 não há redução", () => {
    const inss = calcularINSS(9000, OUT_2026).valor;
    expect(calcularIRRFMensal({ rendimento: 9000, inss, competencia: OUT_2026 }).reducao).toBe(0);
  });
  it("em 2025 não há redução da Lei 15.270", () => {
    const inss = calcularINSS(4000, MAR_2025).valor;
    const r = calcularIRRFMensal({ rendimento: 4000, inss, competencia: MAR_2025 });
    expect(r.reducao).toBe(0);
    expect(r.valor).toBeGreaterThan(0);
  });
  it("desconto simplificado vale quando é maior que as deduções legais", () => {
    // R$ 3.000 em 2025: INSS 2025 ≈ 253,41 < 607,20 → base = 3.000 − 607,20
    const inss = calcularINSS(3000, MAR_2025).valor;
    expect(calcularIRRFMensal({ rendimento: 3000, inss, competencia: MAR_2025 }).base).toBe(2392.8);
  });
});

describe("salário mínimo e salário-família por vigência", () => {
  it("2026", () => {
    expect(salarioMinimo(OUT_2026)).toBe(1621);
    expect(salarioFamilia(OUT_2026)).toEqual({ quota: 67.54, teto: 1980.38 });
  });
  it("2025", () => {
    expect(salarioMinimo(MAR_2025)).toBe(1518);
    expect(salarioFamilia(MAR_2025).teto).toBe(1906.04);
  });
});

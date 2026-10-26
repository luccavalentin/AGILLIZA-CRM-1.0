/**
 * Auditoria adversarial rodada 2 (26/10/2026): o separador de milhar dependia de adivinhar
 * valor a valor — "1.234" num extrato brasileiro virava R$ 1,23 e "1,234" num CSV americano
 * também. Agora o separador decimal é decidido pelo ARQUIVO (todos os valores dele), e cada
 * valor é lido nesse formato.
 */
import { describe, expect, it } from "vitest";
import { detectarDecimal, lerCsv, lerOfx, lerValor } from "./extrato";

describe("milhar conforme o formato do arquivo", () => {
  it("com o formato conhecido, o outro separador é milhar", () => {
    expect(lerValor("1.234", ",")).toBe(1234);
    expect(lerValor("1.234,56", ",")).toBe(1234.56);
    expect(lerValor("1,234", ".")).toBe(1234);
    expect(lerValor("1,234.56", ".")).toBe(1234.56);
    expect(lerValor("12,90", ",")).toBe(12.9);
    expect(lerValor("-12.90", ".")).toBe(-12.9);
  });
  it("milhar fora do lugar não vira número (1.23,4)", () => {
    expect(lerValor("1.23,4", ",")).toBeNull();
    expect(lerValor("12,3.45", ".")).toBeNull();
  });
  it("o decimal vem do arquivo inteiro", () => {
    expect(detectarDecimal(["1.234", "12,90", "-5,00"], ".")).toBe(",");
    expect(detectarDecimal(["1,234", "12.90", "-5.00"], ",")).toBe(".");
    expect(detectarDecimal(["1.234", "2.500"], ",")).toBe(",");
    expect(detectarDecimal(["1.234", "2.500"], ".")).toBe(".");
  });
  it("CSV brasileiro (;) com milhar sem centavos", () => {
    const csv = "Data;Histórico;Valor\n01/10/2026;PIX RECEBIDO;1.234\n02/10/2026;TARIFA;-12,90\n";
    expect(lerCsv(csv).movimentos.map((m) => m.valor)).toEqual([1234, -12.9]);
  });
  it("CSV americano (,) com milhar entre aspas", () => {
    const csv = 'Date,Description,Amount\n2026-10-01,DEPOSIT,"1,234"\n2026-10-02,FEE,-12.90\n';
    expect(lerCsv(csv).movimentos.map((m) => m.valor)).toEqual([1234, -12.9]);
  });
  it("OFX com vírgula decimal (banco brasileiro) e milhar com ponto", () => {
    const ofx = `<OFX><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261001<TRNAMT>1.234,50<FITID>A1</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261002<TRNAMT>-10,00<FITID>A2</STMTTRN></OFX>`;
    expect(lerOfx(ofx).movimentos.map((m) => m.valor)).toEqual([1234.5, -10]);
  });
});

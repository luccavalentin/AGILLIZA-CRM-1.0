import { describe, expect, it } from "vitest";
import { celulaCsv, dataCsv, montarCsv, nomeArquivoFaturas, numeroCsv } from "./csv";

describe("CSV das faturas do ImobMatch", () => {
  it("número com vírgula decimal e sem milhar", () => {
    expect(numeroCsv(1234.5)).toBe("1234,50");
    expect(numeroCsv(0)).toBe("0,00");
    expect(numeroCsv(Number.NaN)).toBe("");
    expect(celulaCsv(197)).toBe("197,00");
  });

  it("nome de conta nunca vira fórmula na planilha (injeção de CSV)", () => {
    expect(celulaCsv('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(celulaCsv("+55 11")).toBe("'+55 11");
    expect(celulaCsv("-10")).toBe("'-10");
    expect(celulaCsv("@SOMA(A1)")).toBe("'@SOMA(A1)");
    expect(celulaCsv("Imobiliária Alfa")).toBe("Imobiliária Alfa");
  });

  it("aspas, ponto e vírgula e quebra de linha ficam dentro de aspas", () => {
    expect(celulaCsv('Conta "A"')).toBe('"Conta ""A"""');
    expect(celulaCsv("a;b")).toBe('"a;b"');
    expect(celulaCsv("linha\nnova")).toBe('"linha\nnova"');
    expect(celulaCsv(null)).toBe("");
  });

  it("data civil e instante no horário de Brasília", () => {
    expect(dataCsv("2026-10-28")).toBe("28/10/2026");
    // 02:00 UTC do dia 29 ainda é dia 28 em Brasília.
    expect(dataCsv("2026-10-29T02:00:00Z")).toBe("28/10/2026");
    expect(dataCsv(null)).toBe("");
    expect(dataCsv("lixo")).toBe("");
  });

  it("arquivo com BOM, separador ; e CRLF", () => {
    const csv = montarCsv(
      ["Conta", "Valor"],
      [
        ["Alfa", 10],
        ["Beta", 2.5],
      ],
    );
    expect(csv.startsWith("\uFEFFConta;Valor\r\n")).toBe(true);
    expect(csv).toContain("Alfa;10,00\r\nBeta;2,50\r\n");
  });

  it("nome do arquivo só com a data", () => {
    expect(nomeArquivoFaturas("2026-10-01", "2026-10-28")).toBe(
      "imobmatch-faturas-2026-10-01-a-2026-10-28.csv",
    );
    expect(nomeArquivoFaturas("../x", "2026")).toBe("imobmatch-faturas--a-2026.csv");
  });
});

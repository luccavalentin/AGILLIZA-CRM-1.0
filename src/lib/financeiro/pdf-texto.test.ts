import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extrairTextoPdf, textoDoConteudo } from "./pdf-texto.server";
import { dadosDoTexto, encontrarCodigosNoTexto } from "./boleto";

const LINHA_BB = "00190.50095 40144.816069 06809.350314 3 37370000000100";

async function pdfDeBoleto(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([595, 842]);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const linhas = [
    "Banco do Brasil 001-9",
    LINHA_BB,
    "Beneficiário: ACME SERVICOS LTDA CNPJ 12.345.678/0001-95",
    "Vencimento: 31/12/2007",
    "Valor do documento R$ 1,00",
  ];
  linhas.forEach((t, i) => pagina.drawText(t, { x: 40, y: 780 - i * 20, size: 11, font: fonte }));
  return doc.save();
}

describe("texto de PDF", () => {
  it("lê o boleto gerado por sistema (fluxo comprimido, texto em hexadecimal)", async () => {
    const texto = extrairTextoPdf(await pdfDeBoleto());
    expect(texto).toContain("ACME SERVICOS LTDA");
    const achados = encontrarCodigosNoTexto(texto, new Date(2007, 11, 1));
    expect(achados).toHaveLength(1);
    expect(achados[0].valor).toBe(1);
    const dados = dadosDoTexto(texto);
    expect(dados.documento).toBe("12345678000195");
    expect(dados.vencimento).toBe("2007-12-31");
  });

  it("operadores Tj, TJ com espaçamento e escapes", () => {
    const t = textoDoConteudo("BT (Linha \\(um\\)) Tj ET BT [(Pal) -50 (avra) -300 (dois)] TJ ET BT <414243> Tj ET");
    expect(t).toContain("Linha (um)");
    expect(t).toContain("Palavra dois");
    expect(t).toContain("ABC");
  });

  it("arquivo que não é PDF é recusado", () => {
    expect(() => extrairTextoPdf(new TextEncoder().encode("não sou pdf"))).toThrow(/não é um PDF/);
  });
});

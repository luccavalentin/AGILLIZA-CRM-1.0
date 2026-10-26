import { describe, expect, it } from "vitest";
import { dividirLinhaCsv, lerCsv, lerData, lerExtrato, lerOfx, lerValor, sha256Hex } from "./extrato";

describe("valores e datas", () => {
  it("lê os formatos de valor dos bancos", () => {
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("1,234.56")).toBe(1234.56);
    expect(lerValor("-12,90")).toBe(-12.9);
    expect(lerValor("(12,90)")).toBe(-12.9);
    expect(lerValor("12,90 D")).toBe(-12.9);
    expect(lerValor("R$ 3.500,00 C")).toBe(3500);
    expect(lerValor("-500.00")).toBe(-500);
    expect(lerValor("1.000.000")).toBe(1000000);
    expect(lerValor("abc")).toBeNull();
    expect(lerValor("")).toBeNull();
  });
  it("lê datas e recusa as impossíveis", () => {
    expect(lerData("31/10/2026")).toBe("2026-10-31");
    expect(lerData("1/2/26")).toBe("2026-02-01");
    expect(lerData("2026-10-31")).toBe("2026-10-31");
    expect(lerData("20261031120000[-3:BRT]")).toBe("2026-10-31");
    expect(lerData("31/02/2026")).toBeNull();
    expect(lerData("ontem")).toBeNull();
  });
});

describe("OFX", () => {
  it("SGML (1.x) sem fechar as tags", () => {
    const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261020120000[-3:BRT]<TRNAMT>-500.00<FITID>A1<CHECKNUM>778<MEMO>PAG ALUGUEL
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261021<TRNAMT>3500,00<FITID>A2<NAME>ITAU<MEMO>CRED COMISSAO
<STMTTRN><TRNTYPE>OTHER<DTPOSTED>20261021<TRNAMT>0<FITID>A3
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const r = lerOfx(ofx);
    expect(r.movimentos).toHaveLength(2);
    expect(r.movimentos[0]).toMatchObject({ data: "2026-10-20", valor: -500, documento: "778", fitid: "A1", descricao: "PAG ALUGUEL" });
    expect(r.movimentos[1]).toMatchObject({ valor: 3500, descricao: "ITAU · CRED COMISSAO", ordem: 1 });
    expect(r.avisos).toHaveLength(1);
  });
  it("XML (2.x) com entidades", () => {
    const xml = `<?xml version="1.0"?><OFX><STMTTRN><DTPOSTED>20261005</DTPOSTED><TRNAMT>-89.90</TRNAMT><FITID>X9</FITID><MEMO>LUZ &amp; FORCA</MEMO></STMTTRN></OFX>`;
    const r = lerExtrato("qualquer.txt", xml);
    expect(r.formato).toBe("ofx");
    expect(r.movimentos[0]).toMatchObject({ valor: -89.9, descricao: "LUZ & FORCA", fitid: "X9" });
  });
});

describe("CSV", () => {
  it("cabeçalho com crédito e débito separados, ponto e vírgula, saldo ignorado", () => {
    const csv = `Extrato conta corrente
Data;Histórico;Documento;Crédito (R$);Débito (R$);Saldo (R$)
01/10/2026;SALDO ANTERIOR;;;;10.000,00
02/10/2026;TED RECEBIDA CONSTRUTORA;123;1.200,00;;11.200,00
03/10/2026;"PAGAMENTO; BOLETO";456;;500,00;10.700,00
03/10/2026;linha torta;;;;
`;
    const r = lerCsv(csv);
    expect(r.movimentos).toHaveLength(2);
    expect(r.movimentos[0]).toMatchObject({ data: "2026-10-02", valor: 1200, documento: "123" });
    expect(r.movimentos[1]).toMatchObject({ valor: -500, descricao: "PAGAMENTO; BOLETO" });
  });
  it("coluna de valor com tipo D/C e separador vírgula", () => {
    const csv = `date,description,amount,type
2026-10-05,Tarifa,12.90,D
2026-10-06,Deposito,100.00,C`;
    const r = lerCsv(csv);
    expect(r.movimentos.map((m) => m.valor)).toEqual([-12.9, 100]);
  });
  it("sem cabeçalho: data, descrição e valor", () => {
    const r = lerCsv("05/10/2026;PIX RECEBIDO;250,00\n06/10/2026;PIX ENVIADO;-50,00");
    expect(r.movimentos.map((m) => m.valor)).toEqual([250, -50]);
    expect(r.avisos[0]).toMatch(/sem cabeçalho/);
  });
  it("aspas duplas escapadas", () => {
    expect(dividirLinhaCsv('a;"b ""c"" d";e', ";")).toEqual(["a", 'b "c" d', "e"]);
  });
  it("duas movimentações iguais no mesmo dia continuam duas (ordem)", () => {
    const r = lerCsv("Data;Descrição;Valor\n05/10/2026;TARIFA;-5,00\n05/10/2026;TARIFA;-5,00");
    expect(r.movimentos.map((m) => m.ordem)).toEqual([0, 1]);
  });
});

describe("sha256", () => {
  it("hash estável do arquivo", async () => {
    const h = await sha256Hex(new TextEncoder().encode("abc").buffer as ArrayBuffer);
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

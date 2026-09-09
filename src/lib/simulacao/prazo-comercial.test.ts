import { describe, expect, it } from "vitest";
import {
  PRAZO_COMERCIAL_PADRAO,
  PRAZO_COMERCIAL_SANTANDER,
  calcularRestricaoEspecial,
  prazoMaxComercialDoBanco,
} from "./use-simulacao-completa/bancos-helpers";

const santander = { codigo_banco: "033", nome_banco: "Santander" } as any;
const bradesco = { codigo_banco: "237", nome_banco: "Bradesco" } as any;
const itau = { codigo_banco: "341", nome_banco: "Itaú" } as any;

const comercial = { tipo_imovel: "AP", uso_imovel: "C" } as any;
const residencial = { tipo_imovel: "AP", uso_imovel: "R" } as any;

describe("prazo em imóvel comercial", () => {
  it("Santander alonga até 360; os demais param em 240", () => {
    expect(prazoMaxComercialDoBanco(santander)).toBe(PRAZO_COMERCIAL_SANTANDER);
    expect(prazoMaxComercialDoBanco(bradesco)).toBe(PRAZO_COMERCIAL_PADRAO);
    expect(prazoMaxComercialDoBanco(itau)).toBe(PRAZO_COMERCIAL_PADRAO);
  });

  it("o teto do formulário acompanha o banco mais longo selecionado", () => {
    // Antes o Santander junto com o Bradesco caía para 240 e o prazo mais
    // longo se perdia; cada banco é limitado ao seu teto no envio.
    expect(calcularRestricaoEspecial(comercial, [santander, bradesco]).prazoMax).toBe(360);
    expect(calcularRestricaoEspecial(comercial, [santander]).prazoMax).toBe(360);
    expect(calcularRestricaoEspecial(comercial, [bradesco, itau]).prazoMax).toBe(240);
  });

  it("sem banco selecionado mantém o teto conservador", () => {
    expect(calcularRestricaoEspecial(comercial, []).prazoMax).toBe(240);
  });

  it("imóvel residencial não entra na restrição", () => {
    const r = calcularRestricaoEspecial(residencial, [santander, bradesco]);
    expect(r.ativo).toBe(false);
    expect(r.isComercial).toBe(false);
  });
});

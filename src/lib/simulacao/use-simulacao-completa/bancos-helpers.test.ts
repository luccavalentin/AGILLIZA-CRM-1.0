import { describe, expect, it } from "vitest";
import { bancoOperaPJ, bancosQueOperamPJ, modalidadePeloDocumento } from "./bancos-helpers";

const BRADESCO = { id: "b1", codigo_banco: 237, nome_banco: "Banco Bradesco" };
const ITAU = { id: "b2", codigo_banco: 341, nome_banco: "Banco Itaú" };
const SANTANDER = { id: "b3", codigo_banco: 33, nome_banco: "Banco Santander" };

/** CNPJ e CPF válidos (dígitos verificadores corretos). */
const CNPJ_VALIDO = "51306419000107";
const CPF_VALIDO = "12345678909";

describe("bancoOperaPJ", () => {
  it("só o Bradesco opera pessoa jurídica", () => {
    expect(bancoOperaPJ(BRADESCO)).toBe(true);
    expect(bancoOperaPJ(ITAU)).toBe(false);
    expect(bancoOperaPJ(SANTANDER)).toBe(false);
  });

  it("reconhece o Bradesco pelo código com zeros à esquerda", () => {
    expect(bancoOperaPJ({ codigo_banco: "0237", nome_banco: null })).toBe(true);
  });

  it("filtra a lista mantendo só quem opera PJ", () => {
    expect(bancosQueOperamPJ([ITAU, BRADESCO, SANTANDER]).map((b) => b.id)).toEqual(["b1"]);
  });
});

describe("modalidadePeloDocumento", () => {
  it("CNPJ válido é pessoa jurídica", () => {
    expect(modalidadePeloDocumento(CNPJ_VALIDO)).toBe("PJ");
    expect(modalidadePeloDocumento("51.306.419/0001-07")).toBe("PJ");
  });

  it("CPF válido é pessoa física", () => {
    expect(modalidadePeloDocumento(CPF_VALIDO)).toBe("PF");
  });

  it("não decide com documento incompleto", () => {
    expect(modalidadePeloDocumento("")).toBeNull();
    expect(modalidadePeloDocumento("513064190")).toBeNull();
    expect(modalidadePeloDocumento(null)).toBeNull();
  });

  it("não troca a modalidade no meio da digitação de um CNPJ", () => {
    // Os 11 primeiros dígitos de um CNPJ não formam um CPF válido, então a
    // modalidade escolhida na tela continua valendo até o documento fechar.
    expect(modalidadePeloDocumento(CNPJ_VALIDO.slice(0, 11))).toBeNull();
  });

  it("documento com dígito verificador errado não decide nada", () => {
    expect(modalidadePeloDocumento("51306419000100")).toBeNull();
    expect(modalidadePeloDocumento("12345678900")).toBeNull();
  });
});

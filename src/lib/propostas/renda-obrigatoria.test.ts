import { describe, expect, it } from "vitest";
import { exigeRenda, faltantesEnvolvido } from "./campos-obrigatorios";

const completo = {
  tipo_situacao: "A",
  tipo_pessoa: "F",
  nome: "Ana",
  cpf_cnpj: "12345678909",
  data_nascimento: "1990-01-01",
  nome_mae: "Maria",
  tipo_sexo: "F",
  estado_civil: "CA",
  tipo_documento_identidade: "RG",
  numero_documento: "123",
  orgao_expedidor: "SSP",
  uf_expedicao: "SP",
  profissao: "Administradora",
  email: "a@b.com",
  celular: "11912345678",
  cep: "13416222",
  logradouro: "Rua A",
  numero_logradouro: "1",
  bairro: "Centro",
  municipio: "Piracicaba",
  uf: "SP",
  fg_autorizacao_dados: true,
};
const apis = (e: any) => faltantesEnvolvido(e).map((c) => c.api);

describe("renda obrigatória", () => {
  it("só o comprador precisa de renda maior que zero", () => {
    expect(exigeRenda({ tipo_qualificacao: "CO" })).toBe(true);
    expect(apis({ ...completo, tipo_qualificacao: "CO", renda: 0 })).toContain("renda");
    expect(apis({ ...completo, tipo_qualificacao: "CO", renda: 5000 })).not.toContain("renda");
  });

  it("cônjuge que não compõe renda e vendedor aceitam zero ou vazio", () => {
    expect(apis({ ...completo, tipo_qualificacao: "TI", renda: null })).not.toContain("renda");
    expect(apis({ ...completo, tipo_qualificacao: "TI", renda: 0 })).not.toContain("renda");
    expect(apis({ ...completo, tipo_qualificacao: "CO", conjuge_de: "x", renda: 0 })).not.toContain(
      "renda",
    );
    expect(apis({ ...completo, tipo_qualificacao: "VD", renda: null })).not.toContain("renda");
  });

  it("tipo de documento só RG ou CNH", () => {
    expect(
      apis({ ...completo, tipo_qualificacao: "CO", renda: 1, tipo_documento_identidade: "RNE" }),
    ).toContain("tipoDocumentoIdentidade");
    expect(
      apis({ ...completo, tipo_qualificacao: "CO", renda: 1, tipo_documento_identidade: "cnh" }),
    ).toEqual([]);
  });
});

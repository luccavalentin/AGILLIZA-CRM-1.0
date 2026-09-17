import { describe, expect, it } from "vitest";
import {
  conjugeParaClienteCrm,
  envolvidoParaVendedorCrm,
  imovelParaClienteCrm,
  mesmoDocumento,
  vendedorCrmParaEnvolvido,
} from "./sincronizar-crm";

describe("espelho proposta ↔ CRM", () => {
  it("cônjuge vai para as colunas conjuge_* sem apagar o que veio vazio", () => {
    expect(
      conjugeParaClienteCrm({
        nome: "Ana",
        cpf_cnpj: "123.456.789-09",
        email: "ANA@X.COM",
        celular: "(11) 91234-5678",
        profissao: "",
        renda: null,
      }),
    ).toEqual({
      conjuge_nome: "Ana",
      conjuge_cpf: "12345678909",
      conjuge_email: "ana@x.com",
      conjuge_celular: "11912345678",
    });
  });

  it("vendedor converte códigos da integração para o CRM", () => {
    const crm = envolvidoParaVendedorCrm({
      tipo_pessoa: "J",
      estado_civil: "CA",
      regime_casamento: "CP",
      municipio: "Campinas",
      numero_logradouro: "10",
    });
    expect(crm).toEqual({
      tipo_pessoa: "PJ",
      estado_civil: "casado",
      regime_casamento: "comunhao_parcial",
      cidade: "Campinas",
      numero: "10",
    });
  });

  it("ida e volta do vendedor preserva os dados", () => {
    const crm = {
      tipo_pessoa: "PF",
      nome: "Marcos",
      documento: "12345678909",
      estado_civil: "casado",
      regime_casamento: "comunhao_parcial",
      cidade: "Campinas",
      numero: "10",
      telefone_celular: "11912345678",
    };
    const volta = envolvidoParaVendedorCrm(vendedorCrmParaEnvolvido(crm) as any);
    expect(volta).toMatchObject(crm);
  });

  it("imóvel vai para clientes.imovel_*", () => {
    expect(
      imovelParaClienteCrm({ cep_imovel: "13416-222", tipo_imovel: "AP", valor_imovel: 500000 }),
    ).toEqual({ imovel_cep: "13416222", imovel_tipo: "AP", imovel_valor: 500000 });
  });

  it("documento compara só dígitos e ignora vazio", () => {
    expect(mesmoDocumento("123.456.789-09", "12345678909")).toBe(true);
    expect(mesmoDocumento("", "")).toBe(false);
  });
  it("vendedor separado e separação obrigatória vão e voltam sem virar outro valor", () => {
    for (const [estado, regime] of [
      ["SL", "SO"],
      ["CA", "CP"],
      ["DI", "SC"],
    ]) {
      const crm = envolvidoParaVendedorCrm({ estado_civil: estado, regime_casamento: regime });
      const volta = vendedorCrmParaEnvolvido(crm);
      expect([volta.estado_civil, volta.regime_casamento]).toEqual([estado, regime]);
    }
  });
});

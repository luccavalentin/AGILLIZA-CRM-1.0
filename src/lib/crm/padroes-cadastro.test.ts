import { describe, expect, it } from "vitest";
import {
  aplicarPadroesCliente,
  aplicarPadroesIdentificacao,
  celularConjugeOuPadrao,
  PADROES_CADASTRO,
} from "./padroes-cadastro";

describe("aplicarPadroesCliente", () => {
  it("preenche o que está vazio", () => {
    const r = aplicarPadroesCliente({ documento: "12345678909" } as Record<string, any>);
    expect(r.mae).toBe(PADROES_CADASTRO.mae);
    expect(r.pai).toBe(PADROES_CADASTRO.pai);
    expect(r.profissao).toBe(PADROES_CADASTRO.profissao);
    expect(r.empresa).toBe(PADROES_CADASTRO.empresa);
    expect(r.tipo_documento_identidade).toBe("RG");
    expect(r.orgao_expedidor).toBe("SSP");
    expect(r.uf_expedicao).toBe("SP");
    expect(r.data_expedicao).toBe("2026-01-01");
    expect(r.numero_documento).toBe("12345678909");
  });

  it("nunca sobrescreve o que o usuário informou", () => {
    const r = aplicarPadroesCliente({
      documento: "12345678909",
      mae: "Ana Maria",
      pai: "Carlos",
      profissao: "Engenheiro",
      empresa: "Outra Ltda",
      tipo_documento_identidade: "CNH",
      numero_documento: "998877",
      orgao_expedidor: "DETRAN",
      uf_expedicao: "PR",
      data_expedicao: "2020-03-15",
    } as Record<string, any>);
    expect(r).toMatchObject({
      mae: "Ana Maria",
      pai: "Carlos",
      profissao: "Engenheiro",
      empresa: "Outra Ltda",
      tipo_documento_identidade: "CNH",
      numero_documento: "998877",
      orgao_expedidor: "DETRAN",
      uf_expedicao: "PR",
      data_expedicao: "2020-03-15",
    });
  });

  it("trata string em branco como vazia", () => {
    const r = aplicarPadroesCliente({ mae: "   ", profissao: "" } as Record<string, any>);
    expect(r.mae).toBe(PADROES_CADASTRO.mae);
    expect(r.profissao).toBe(PADROES_CADASTRO.profissao);
  });

  it("preenche o cônjuge quando ele existe", () => {
    const r = aplicarPadroesCliente({
      documento: "111",
      conjuge_nome: "Fulana",
      conjuge_cpf: "22233344455",
    } as Record<string, any>);
    expect(r.conjuge_nome_mae).toBe(PADROES_CADASTRO.mae);
    expect(r.conjuge_profissao).toBe(PADROES_CADASTRO.profissao);
    expect(r.conjuge_empresa).toBe(PADROES_CADASTRO.empresa);
    expect(r.conjuge_tipo_documento_identidade).toBe("RG");
    expect(r.conjuge_orgao_expedidor).toBe("SSP");
    expect(r.conjuge_uf_expedicao).toBe("SP");
    expect(r.conjuge_data_expedicao).toBe("2026-01-01");
    expect(r.conjuge_numero_documento).toBe("22233344455");
  });

  it("não inventa cônjuge em cliente sem cônjuge", () => {
    const r = aplicarPadroesCliente({ documento: "111" } as Record<string, any>);
    expect(r.conjuge_nome_mae).toBeUndefined();
    expect(r.conjuge_profissao).toBeUndefined();
  });
});

describe("aplicarPadroesIdentificacao", () => {
  it("vazio vira Brasileira, São Paulo/SP e RG = CPF", () => {
    const r = aplicarPadroesIdentificacao({
      tipo_pessoa: "PF",
      documento: "12345678909",
      nacionalidade: "",
      naturalidade: null,
      documento_secundario: "",
    } as Record<string, any>);
    expect(r.nacionalidade).toBe("Brasileira");
    expect(r.naturalidade).toBe("São Paulo/SP");
    expect(r.documento_secundario).toBe("12345678909");
    expect(r.numero_documento).toBe("12345678909");
  });

  it("só o estado SP, sem cidade, também recebe São Paulo", () => {
    const r = aplicarPadroesIdentificacao({ naturalidade: "/SP" } as Record<string, any>);
    expect(r.naturalidade).toBe("São Paulo/SP");
  });

  it("não troca estado escolhido nem valores informados", () => {
    const r = aplicarPadroesIdentificacao({
      documento: "12345678909",
      nacionalidade: "Portuguesa",
      naturalidade: "LIMEIRA/SP",
      documento_secundario: "445566",
    } as Record<string, any>);
    expect(r).toMatchObject({
      nacionalidade: "Portuguesa",
      naturalidade: "LIMEIRA/SP",
      documento_secundario: "445566",
    });
    expect(aplicarPadroesIdentificacao({ naturalidade: "/RJ" } as any).naturalidade).toBe("/RJ");
  });

  it("não mexe em pessoa jurídica", () => {
    const r = aplicarPadroesIdentificacao({
      tipo_pessoa: "PJ",
      documento: "11222333000181",
    } as Record<string, any>);
    expect(r.nacionalidade).toBeUndefined();
    expect(r.naturalidade).toBeUndefined();
    expect(r.documento_secundario).toBeUndefined();
  });

  it("cônjuge existente recebe nacionalidade e RG = CPF dele", () => {
    const r = aplicarPadroesIdentificacao({
      conjuge_nome: "Fulana",
      conjuge_cpf: "22233344455",
    } as Record<string, any>);
    expect(r.conjuge_nacionalidade).toBe("Brasileira");
    expect(r.conjuge_numero_documento).toBe("22233344455");
  });
});

describe("celularConjugeOuPadrao", () => {
  it("vazio ou igual ao do titular vira o padrão", () => {
    expect(celularConjugeOuPadrao("", "19997750050")).toBe("19998710032");
    expect(celularConjugeOuPadrao(null, "19997750050")).toBe("19998710032");
    expect(celularConjugeOuPadrao("(19) 99775-0050", "19997750050")).toBe("19998710032");
  });

  it("número próprio do cônjuge é mantido (só dígitos)", () => {
    expect(celularConjugeOuPadrao("(19) 98326-0000", "19983260031")).toBe("19983260000");
  });

  it("cadastro com cônjuge recebe o celular padrão quando repete o do titular", () => {
    const r = aplicarPadroesIdentificacao({
      telefone_celular: "19991586355",
      conjuge_nome: "Débora",
      conjuge_cpf: "26900000075",
      conjuge_celular: "19991586355",
    } as Record<string, any>);
    expect(r.conjuge_celular).toBe("19998710032");
  });
});

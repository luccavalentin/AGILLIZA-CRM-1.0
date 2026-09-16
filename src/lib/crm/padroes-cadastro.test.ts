import { describe, expect, it } from "vitest";
import { aplicarPadroesCliente, PADROES_CADASTRO } from "./padroes-cadastro";

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

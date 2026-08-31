import { describe, it, expect } from "vitest";
import {
  faltantesEnvolvido,
  ehProponenteEnviadoAoBanco,
  proponentesPendentes,
  CAMPOS_OBRIGATORIOS_PARTICIPANTE,
} from "./campos-obrigatorios";

/** Proponente com os 25 campos "S" do CreateParticipantRequest preenchidos. */
const COMPRADOR_COMPLETO = {
  id: "c1",
  tipo_qualificacao: "CO",
  tipo_situacao: "A",
  tipo_pessoa: "F",
  nome: "Joana Ribeiro Alves",
  cpf_cnpj: "12345678909",
  data_nascimento: "1990-04-12",
  nome_mae: "Marta Ribeiro",
  tipo_sexo: "F",
  estado_civil: "S",
  tipo_documento_identidade: "RG",
  numero_documento: "134673168",
  orgao_expedidor: "SESP",
  uf_expedicao: "PR",
  profissao: "Analista",
  renda: 12000,
  email: "joana@exemplo.com.br",
  celular: "41999107330",
  cep: "80230110",
  logradouro: "Avenida Marechal Floriano Peixoto",
  numero_logradouro: "1605",
  bairro: "Reboucas",
  municipio: "Curitiba",
  uf: "PR",
  utiliza_fgts: false,
  fg_autorizacao_dados: true,
};

describe("campos obrigatórios do participante", () => {
  it("proponente completo não tem pendência", () => {
    expect(faltantesEnvolvido(COMPRADOR_COMPLETO)).toEqual([]);
  });

  it("acusa exatamente os campos que faltam", () => {
    const { nome_mae, tipo_sexo, ...semFiliacao } = COMPRADOR_COMPLETO;
    const chaves = faltantesEnvolvido(semFiliacao).map((c) => c.chave);
    expect(chaves.sort()).toEqual(["nome_mae", "tipo_sexo"]);
  });

  it("fg_autorizacao_dados precisa ser verdadeiro, não apenas preenchido", () => {
    const chaves = faltantesEnvolvido({
      ...COMPRADOR_COMPLETO,
      fg_autorizacao_dados: false,
    }).map((c) => c.chave);
    expect(chaves).toContain("fg_autorizacao_dados");
  });

  it("pessoa jurídica não é cobrada nos campos exclusivos de pessoa física", () => {
    const pj = { ...COMPRADOR_COMPLETO, tipo_pessoa: "J", nome_mae: null, tipo_sexo: null };
    expect(faltantesEnvolvido(pj)).toEqual([]);
  });
});

describe("quem é validado como participante da integração", () => {
  it("comprador e cônjuge/coproponente são enviados ao banco", () => {
    expect(ehProponenteEnviadoAoBanco({ tipo_qualificacao: "CO" })).toBe(true);
    expect(ehProponenteEnviadoAoBanco({ tipo_qualificacao: "TI" })).toBe(true);
  });

  it("vendedor não é enviado por este fluxo", () => {
    expect(ehProponenteEnviadoAoBanco({ tipo_qualificacao: "VD" })).toBe(false);
  });

  it("vendedor incompleto NÃO trava o envio da proposta", () => {
    const vendedorVazio = { id: "v1", tipo_qualificacao: "VD", nome: "Imobiliária X" };
    expect(proponentesPendentes([COMPRADOR_COMPLETO, vendedorVazio])).toEqual([]);
  });

  it("cônjuge incompleto trava o envio e é devolvido como pendente", () => {
    const conjugeIncompleto = { id: "t1", tipo_qualificacao: "TI", nome: "Carlos Alves" };
    const pendentes = proponentesPendentes([COMPRADOR_COMPLETO, conjugeIncompleto]);
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].env.id).toBe("t1");
    expect(pendentes[0].faltantes.length).toBeGreaterThan(0);
  });

  it("ignora buracos na lista sem quebrar", () => {
    expect(proponentesPendentes([null, undefined, COMPRADOR_COMPLETO])).toEqual([]);
  });

  it("preserva a ordem dos pendentes", () => {
    const a = { id: "a", tipo_qualificacao: "CO", nome: "Primeiro" };
    const b = { id: "b", tipo_qualificacao: "TI", nome: "Segundo" };
    expect(proponentesPendentes([a, b]).map((p) => p.env.id)).toEqual(["a", "b"]);
  });
});

describe("aderência ao contrato da API", () => {
  it("mantém os 25 campos marcados 'S' na documentação", () => {
    expect(CAMPOS_OBRIGATORIOS_PARTICIPANTE).toHaveLength(25);
  });

  it("nenhum campo opcional do swagger entrou na lista de obrigatórios", () => {
    const opcionais = [
      "tipo_regime_casamento",
      "data_expedicao",
      "empresa",
      "complemento",
      "agencia",
      "conta_corrente",
      "digito_conta",
    ];
    const chaves = CAMPOS_OBRIGATORIOS_PARTICIPANTE.map((c) => c.chave);
    for (const opcional of opcionais) {
      expect(chaves).not.toContain(opcional);
    }
  });
});

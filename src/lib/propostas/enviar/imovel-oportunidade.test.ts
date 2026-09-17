import { describe, expect, it } from "vitest";
import { conferirGravacao, montarDadosImovelOportunidade } from "./imovel-oportunidade";

const proposta = {
  cep_imovel: "13416-222",
  endereco_imovel: "Rua Dr. Paulo Pinto",
  numero_imovel: "1001",
  complemento_imovel: "",
  bairro_imovel: "São Dimas",
  cidade_imovel: "Piracicaba",
  uf: "sp",
  iq_nome: "Banco Anterior S.A.",
  iq_comentario: "Quitação do saldo devedor",
};

describe("montarDadosImovelOportunidade", () => {
  it("leva endereço, vistoria e IQ nos campos da API", () => {
    const { payload, semCampoNaApi } = montarDadosImovelOportunidade(proposta, {
      i_vistoria_nome: "Leide",
      i_vistoria_tel: "15 991118817",
      i_vagas: "2",
      i_iq: "sim",
    });
    expect(payload).toEqual({
      cep: "13416222",
      logradouro: "Rua Dr. Paulo Pinto",
      numeroLogradouro: "1001",
      bairro: "São Dimas",
      municipio: "Piracicaba",
      uf: "SP",
      contatoAvaliacao: "Leide",
      telefoneContatoAvaliacao: "15991118817",
      nomeIntervenienteQuitante: "Banco Anterior S.A.",
      descricaoIntervenienteQuitante: "Quitação do saldo devedor",
    });
    // Vagas não tem campo na API: avisamos em vez de perder em silêncio.
    expect(semCampoNaApi).toEqual(["Quantidade de vagas do imóvel"]);
  });

  it("não manda vazio, telefone incompleto, CEP inválido nem IQ marcado como Não", () => {
    const { payload } = montarDadosImovelOportunidade(
      { ...proposta, cep_imovel: "123", endereco_imovel: " " },
      { i_vistoria_nome: "", i_vistoria_tel: "9911", i_iq: "nao" },
    );
    expect(payload.cep).toBeUndefined();
    expect(payload.logradouro).toBeUndefined();
    expect(payload.contatoAvaliacao).toBeUndefined();
    expect(payload.telefoneContatoAvaliacao).toBeUndefined();
    expect(payload.nomeIntervenienteQuitante).toBeUndefined();
  });
});

describe("conferirGravacao", () => {
  it("separa o que a HomeFin gravou do que descartou", () => {
    const enviado = {
      cep: "13416222",
      contatoAvaliacao: "Leide",
      telefoneContatoAvaliacao: "15991118817",
    };
    const r = conferirGravacao(enviado, {
      cep: "13416-222",
      contatoAvaliacao: "Leide",
      telefoneContatoAvaliacao: null,
    });
    expect(r.confirmados).toEqual(["cep", "contatoAvaliacao"]);
    expect(r.naoConfirmados).toEqual(["telefoneContatoAvaliacao"]);
  });
});

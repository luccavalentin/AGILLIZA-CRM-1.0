import { describe, expect, it } from "vitest";
import { enderecoParaBanco, montarParticipantesSimulacao } from "./participantes-simulacao";
import { ENDERECO_PADRAO, PADROES_CADASTRO } from "@/lib/crm/padroes-cadastro";

const simCasal = {
  nome_cliente: "Elisabeth de Sousa",
  cpf_cnpj: "896.166.188-49",
  data_nascimento: "1956-05-13",
  email: "eli@x.com",
  celular: "(19) 99158-6355",
  renda_total: 24000,
  estado_civil: "casado",
  sexo: "F",
  nome_conjuge: "Mario de Sousa",
  cpf_conjuge: "012.957.458-95",
  data_nascimento_conjuge: "1956-04-06",
  renda_conjuge: 5000,
  compoe_renda_conjuge: true,
  sexo_conjuge: "M",
};

describe("montarParticipantesSimulacao", () => {
  it("cadastro vazio: titular e cônjuge completos com o padrão", () => {
    const { titular, conjuge } = montarParticipantesSimulacao({ sim: simCasal });
    for (const p of [titular, conjuge!]) {
      expect(p).toMatchObject({
        nomeMae: PADROES_CADASTRO.mae,
        tipoDocumentoIdentidade: "RG",
        orgaoExpedidor: "SSP",
        ufExpedicao: "SP",
        dataExpedicao: PADROES_CADASTRO.dataExpedicao,
        nomeProfissao: PADROES_CADASTRO.profissao,
        nomeEmpresaProfissao: PADROES_CADASTRO.empresa,
        fgAutorizacaoDados: true,
        tipoEstadoCivil: "CA",
        tipoRegimeCasamento: "CP",
        cep: ENDERECO_PADRAO.cep,
        logradouro: ENDERECO_PADRAO.logradouro,
        municipio: ENDERECO_PADRAO.cidade,
      });
    }
    expect(titular).toMatchObject({
      cpfCnpj: "89616618849",
      numeroDocumento: "89616618849",
      tipoSexo: "F",
      celular: "19991586355",
      nomeConjuge: "Mario de Sousa",
      cpfConjuge: "01295745895",
      numeroDocumentoConjuge: "01295745895",
      tipoSexoConjuge: "M",
      rendaConjuge: 5000,
    });
    expect(conjuge).toMatchObject({
      nomeParticipante: "Mario de Sousa",
      cpfCnpj: "01295745895",
      tipoSexo: "M",
      renda: 5000,
      email: "eli@x.com",
      nomeConjuge: "Elisabeth de Sousa",
      cpfConjuge: "89616618849",
      dataNascimentoConjuge: "1956-05-13",
    });
  });

  it("o que o cadastro tem vence o padrão", () => {
    const { titular, conjuge } = montarParticipantesSimulacao({
      sim: simCasal,
      cliente: {
        mae: "Ana Abel",
        profissao: "Professora",
        tipo_documento_identidade: "CNH",
        numero_documento: "05.167.667-31",
        conjuge_nome_mae: "Rosa Sousa",
        conjuge_profissao: "Engenheiro",
      },
      endereco: {
        cep: "13076-627",
        logradouro: "Rua Coronel Joaquim",
        numero: "258",
        bairro: "Jardim Dom Bosco",
        cidade: "Campinas",
        uf: "sp",
      },
    });
    expect(titular).toMatchObject({
      nomeMae: "Ana Abel",
      nomeProfissao: "Professora",
      tipoDocumentoIdentidade: "CNH",
      numeroDocumento: "0516766731",
      nomeProfissaoConjuge: "Engenheiro",
      cep: "13076627",
      municipio: "Campinas",
      uf: "SP",
    });
    expect(conjuge).toMatchObject({
      nomeMae: "Rosa Sousa",
      cep: "13076627",
      numeroLogradouro: "258",
    });
  });

  it("solteiro não gera cônjuge nem campos de cônjuge", () => {
    const { titular, conjuge } = montarParticipantesSimulacao({
      sim: { ...simCasal, estado_civil: "solteiro" },
    });
    expect(conjuge).toBeNull();
    expect(titular).not.toHaveProperty("nomeConjuge");
    expect(titular.tipoRegimeCasamento).toBeUndefined();
  });

  it("endereço incompleto usa o padrão inteiro", () => {
    expect(enderecoParaBanco({ cep: "13076627", logradouro: "" })).toMatchObject({
      cep: ENDERECO_PADRAO.cep,
      logradouro: ENDERECO_PADRAO.logradouro,
    });
  });
});

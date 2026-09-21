import { beforeEach, describe, expect, it, vi } from "vitest";

const chamadas: { endpoint: string; metodo: string; payload: any }[] = [];
let participantesHomefin: any[] = [];

vi.mock("@/lib/simulacao/homefin.server", () => ({
  TIPO_BANCO_SANTANDER: 33,
  IntegracaoBancariaError: class extends Error {},
  sanitizarMensagemErro: (m: string) => m,
  chamarIntegracao: vi.fn(async (endpoint: string, metodo: string, payload: any) => {
    chamadas.push({ endpoint, metodo, payload });
    if (metodo === "GET")
      return { oportunidade: { tipoSituacao: "A", participantes: participantesHomefin } };
    return {};
  }),
}));
vi.mock("./propostas.functions", () => ({
  ressincronizarDadosParticipantesImpl: vi.fn(async () => undefined),
}));

import { garantirEnderecoParticipantes } from "./enviar.server";
import { ENDERECO_PADRAO } from "@/lib/crm/padroes-cadastro";

/** Supabase mínimo: cada tabela devolve o que o teste define. */
function supabaseFake(tabelas: Record<string, any>) {
  return {
    from(tabela: string) {
      const dado = tabelas[tabela];
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: Array.isArray(dado) ? dado[0] : dado }),
        then: (ok: any) => Promise.resolve({ data: dado }).then(ok),
      };
      return q;
    },
  } as any;
}

const pessoa = (extra: Record<string, any>) => ({
  tipo_situacao: "A",
  tipo_pessoa: "F",
  tipo_sexo: "F",
  tipo_documento_identidade: "RG",
  orgao_expedidor: "SSP",
  uf_expedicao: "SP",
  data_expedicao: "2015-01-10",
  profissao: "Analista",
  renda: 8000,
  email: "a@b.com.br",
  celular: "19999999999",
  utiliza_fgts: false,
  fg_autorizacao_dados: true,
  estado_civil: "CA",
  regime_casamento: "CP",
  ...extra,
});

const endereco = {
  cep: "13405463",
  logradouro: "Rua João Graner",
  numero_logradouro: "258",
  bairro: "Jardim Algodoal",
  municipio: "Piracicaba",
  uf: "SP",
};

const titular = pessoa({
  id: "t1",
  nome: "Thamires Silva",
  cpf_cnpj: "41612449832",
  tipo_qualificacao: "CO",
  data_nascimento: "1993-03-08",
  nome_mae: "Maria José",
  numero_documento: "123456789",
  ...endereco,
});

const conjugeBase = pessoa({
  id: "c1",
  conjuge_de: "t1",
  nome: "Lucas Silva",
  cpf_cnpj: "38944636869",
  tipo_qualificacao: "TI",
  tipo_sexo: "M",
  data_nascimento: "1990-07-16",
  nome_mae: "Ana Souza",
  numero_documento: "987654321",
});

const prop = {
  id: "p1",
  cpf_cnpj: "41612449832",
  cliente_id: null,
  simulacao_id: null,
  estado_civil: "CA",
  compoe_renda_conjuge: true,
};

const partHomefin = (cpf: string, id: number) => ({
  idParticipante: id,
  cpfCnpj: cpf,
  tipoQualificacao: "CO",
  tipoPessoa: "F",
  tipoEstadoCivil: "CA",
});

async function enviar(conjuge: any) {
  await garantirEnderecoParticipantes({
    prop,
    pb: { nome_banco: "Itaú" },
    idOportunidade: "31541",
    ctx: { simulacao_id: null, proposta_id: "p1", correspondente_id: null },
    supabase: supabaseFake({ proposta_envolvidos: [titular, conjuge] }),
  });
  const puts = chamadas.filter((c) => c.metodo === "PUT");
  return {
    titular: puts.find((c) => c.endpoint.endsWith("/1"))?.payload,
    conjuge: puts.find((c) => c.endpoint.endsWith("/2"))?.payload,
  };
}

describe("envio de casal ao banco", () => {
  beforeEach(() => {
    chamadas.length = 0;
    participantesHomefin = [partHomefin("41612449832", 1), partHomefin("38944636869", 2)];
  });

  it("o cônjuge leva os dados completos da titular, e vice-versa", async () => {
    const { titular: t, conjuge: c } = await enviar({ ...conjugeBase, ...endereco });
    expect(t).toMatchObject({
      nomeConjuge: "Lucas Silva",
      cpfConjuge: "38944636869",
      numeroDocumentoConjuge: "987654321",
      dataNascimentoConjuge: "1990-07-16",
      tipoSexoConjuge: "M",
    });
    expect(c).toMatchObject({
      nomeParticipante: "Lucas Silva",
      tipoEstadoCivil: "CA",
      nomeMae: "Ana Souza",
      numeroDocumento: "987654321",
      nomeConjuge: "Thamires Silva",
      cpfConjuge: "41612449832",
      numeroDocumentoConjuge: "123456789",
      dataNascimentoConjuge: "1993-03-08",
      rendaConjuge: 8000,
    });
  });

  it("cônjuge sem endereço no cadastro usa o endereço do casal", async () => {
    const { conjuge: c } = await enviar(conjugeBase);
    expect(c).toMatchObject({
      cep: "13405463",
      logradouro: "Rua João Graner",
      numeroLogradouro: "258",
      bairro: "Jardim Algodoal",
      municipio: "Piracicaba",
      uf: "SP",
    });
  });

  it("proponente sem endereço no cadastro vai com o endereço padrão, sem barrar o envio", async () => {
    participantesHomefin = [
      partHomefin("41612449832", 1),
      {
        ...partHomefin("11122233396", 3),
        nomeParticipante: "Caio Guerrero",
        tipoEstadoCivil: "S",
        uf: "SP",
      },
    ];
    await garantirEnderecoParticipantes({
      prop: { ...prop, estado_civil: "S" },
      pb: { nome_banco: "Itaú" },
      idOportunidade: "31676",
      ctx: { simulacao_id: null, proposta_id: "p1", correspondente_id: null },
      supabase: supabaseFake({
        proposta_envolvidos: [{ ...titular, estado_civil: "S", regime_casamento: null }],
      }),
    });
    const fora = chamadas.filter((c) => c.metodo === "PUT").find((c) => c.endpoint.endsWith("/3"));
    expect(fora?.payload).toMatchObject({
      cep: ENDERECO_PADRAO.cep,
      logradouro: ENDERECO_PADRAO.logradouro,
      numeroLogradouro: ENDERECO_PADRAO.numero,
      bairro: ENDERECO_PADRAO.bairro,
      municipio: ENDERECO_PADRAO.cidade,
    });
  });
});

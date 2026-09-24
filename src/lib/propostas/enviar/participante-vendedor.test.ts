import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPOS_OBRIGATORIOS_PARTICIPANTE } from "../campos-obrigatorios";
import { payloadParticipanteVendedor, pendenciasDoVendedor } from "./participante-vendedor";

const swagger = JSON.parse(
  readFileSync(
    join(__dirname, "..", "..", "simulacao", "contrato-homefin", "swagger-homefin.json"),
    "utf-8",
  ),
) as any;
const PROPS = Object.keys(swagger.components.schemas.CreateParticipantRequest.properties);

const vendedorCompleto = {
  tipo_situacao: "A",
  tipo_qualificacao: "VD",
  tipo_pessoa: "F",
  nome: "Marcos Vendedor",
  cpf_cnpj: "123.456.789-09",
  data_nascimento: "1980-05-10",
  nome_mae: "Maria",
  tipo_sexo: "M",
  estado_civil: "CA",
  regime_casamento: "CP",
  tipo_documento_identidade: "RG",
  numero_documento: "123456",
  orgao_expedidor: "SSP",
  uf_expedicao: "SP",
  profissao: "Engenheiro",
  renda: 10000,
  email: "marcos@x.com",
  celular: "(11) 91234-5678",
  cep: "13416-222",
  logradouro: "Rua A",
  numero_logradouro: "10",
  bairro: "Centro",
  municipio: "Piracicaba",
  uf: "SP",
  utiliza_fgts: false,
  fg_autorizacao_dados: true,
  agencia: "0347",
  conta_corrente: "12345",
  digito_conta: "6",
};

describe("vendedor como participante VD", () => {
  it("usa só campos do CreateParticipantRequest e leva todos os obrigatórios", () => {
    const payload = payloadParticipanteVendedor(vendedorCompleto, {
      nome: "Ana",
      cpf_cnpj: "98765432100",
      tipo_sexo: "F",
    });
    expect(Object.keys(payload).filter((k) => !PROPS.includes(k))).toEqual([]);
    const obrigatorios = CAMPOS_OBRIGATORIOS_PARTICIPANTE.map((c) => c.api);
    expect(obrigatorios.filter((c) => !(c in payload))).toEqual([]);
    expect(payload).toMatchObject({
      tipoQualificacao: "VD",
      cpfCnpj: "12345678909",
      celular: "11912345678",
      cep: "13416222",
      utilizaFgts: "N",
      nomeConjuge: "Ana",
      cpfConjuge: "98765432100",
    });
  });

  it("só trava no que ninguém preenche pelo vendedor; o resto vai com padrão", () => {
    expect(pendenciasDoVendedor(vendedorCompleto)).toEqual([]);
    // Nome da mãe, e-mail, celular, profissão e documento têm padrão — não
    // travam. Renda não é cobrada do vendedor (vai 0 no payload).
    const comPadrao = {
      ...vendedorCompleto,
      nome_mae: "",
      email: "",
      celular: "",
      profissao: "",
      tipo_documento_identidade: "",
      numero_documento: "",
      orgao_expedidor: "",
      uf_expedicao: "",
      renda: null,
    };
    expect(pendenciasDoVendedor(comPadrao)).toEqual([]);
    const p = payloadParticipanteVendedor(comPadrao);
    expect(p).toMatchObject({
      nomeMae: "Maria José",
      email: "thiago@agilliza.net.br",
      celular: "19998710032",
      nomeProfissao: "Administrador",
      tipoDocumentoIdentidade: "RG",
      numeroDocumento: "12345678909",
      renda: 0,
    });
    // Sem data de nascimento ninguém inventa: continua pendente.
    const faltando = pendenciasDoVendedor({ ...vendedorCompleto, data_nascimento: "" }).map(
      (c) => c.api,
    );
    expect(faltando).toEqual(["dataNascimento"]);
  });

  it("campo vazio não vai no payload (PUT não apaga o que a HomeFin tem)", () => {
    const payload = payloadParticipanteVendedor({ ...vendedorCompleto, empresa: "", agencia: "" });
    expect(payload).not.toHaveProperty("nomeEmpresaProfissao");
    expect(payload).not.toHaveProperty("codigoAgencia");
  });
});

describe("RG padrão do vendedor", () => {
  it("sem número do documento, pessoa física vai com o CPF", () => {
    const p = payloadParticipanteVendedor({ ...vendedorCompleto, numero_documento: "" });
    expect(p.numeroDocumento).toBe("12345678909");
  });

  it("cônjuge do vendedor sem documento vai com o CPF dele", () => {
    const p = payloadParticipanteVendedor(vendedorCompleto, {
      nome: "Ana",
      cpf_cnpj: "987.654.321-00",
    });
    expect(p.numeroDocumentoConjuge).toBe("98765432100");
  });
});

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

  it("vendedor completo não tem pendência; incompleto diz o que falta", () => {
    expect(pendenciasDoVendedor(vendedorCompleto)).toEqual([]);
    const faltando = pendenciasDoVendedor({ ...vendedorCompleto, nome_mae: "", renda: null })
      .map((c) => c.api)
      .sort();
    expect(faltando).toEqual(["nomeMae", "renda"]);
  });

  it("campo vazio não vai no payload (PUT não apaga o que a HomeFin tem)", () => {
    const payload = payloadParticipanteVendedor({ ...vendedorCompleto, empresa: "", agencia: "" });
    expect(payload).not.toHaveProperty("nomeEmpresaProfissao");
    expect(payload).not.toHaveProperty("codigoAgencia");
  });
});

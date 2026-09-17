/**
 * Espelho entre a proposta e o cadastro do cliente no CRM (módulo puro).
 *
 * A proposta guarda os participantes em `proposta_envolvidos`, com os códigos
 * do contrato da integração (CA, CP, F/J). O CRM guarda o titular e o cônjuge
 * em `clientes` (cônjuge nas colunas `conjuge_*`), os vendedores em
 * `cliente_vendedores` e o imóvel em `clientes.imovel_*`, com valores por
 * extenso. Estas funções convertem nos dois sentidos, só com os campos que
 * vieram preenchidos — nunca apagam o que já está no outro lado.
 */
import { estadoCivilCrmParaCodigo, regimeCasamentoCrmParaCodigo } from "./dominios";

const ESTADO_CIVIL_PARA_CRM: Record<string, string> = {
  S: "solteiro",
  CA: "casado",
  UE: "uniao_estavel",
  DI: "divorciado",
  VI: "viuvo",
  SL: "separado",
};
const REGIME_PARA_CRM: Record<string, string> = {
  CP: "comunhao_parcial",
  CU: "comunhao_universal",
  PA: "participacao_final",
  SC: "separacao_total",
  SO: "separacao_obrigatoria",
};

const tem = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";
const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

function sóPreenchidos(patch: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => tem(v)));
}

/** Cônjuge editado na proposta → colunas `conjuge_*` do titular no CRM. */
export function conjugeParaClienteCrm(dados: Record<string, any>): Record<string, unknown> {
  return sóPreenchidos({
    conjuge_nome: dados.nome,
    conjuge_cpf: tem(dados.cpf_cnpj) ? digitos(dados.cpf_cnpj) : undefined,
    conjuge_data_nascimento: dados.data_nascimento,
    conjuge_nome_mae: dados.nome_mae,
    conjuge_sexo: dados.tipo_sexo,
    conjuge_tipo_documento_identidade: dados.tipo_documento_identidade,
    conjuge_numero_documento: dados.numero_documento,
    conjuge_orgao_expedidor: dados.orgao_expedidor,
    conjuge_uf_expedicao: dados.uf_expedicao,
    conjuge_data_expedicao: dados.data_expedicao,
    conjuge_profissao: dados.profissao,
    conjuge_empresa: dados.empresa,
    conjuge_email: tem(dados.email) ? String(dados.email).toLowerCase() : undefined,
    conjuge_celular: tem(dados.celular) ? digitos(dados.celular) : undefined,
  });
}

/** Vendedor editado na proposta → `cliente_vendedores`. */
export function envolvidoParaVendedorCrm(dados: Record<string, any>): Record<string, unknown> {
  return sóPreenchidos({
    tipo_pessoa: tem(dados.tipo_pessoa) ? (dados.tipo_pessoa === "J" ? "PJ" : "PF") : undefined,
    nome: dados.nome,
    documento: tem(dados.cpf_cnpj) ? digitos(dados.cpf_cnpj) : undefined,
    data_nascimento: dados.data_nascimento,
    mae: dados.nome_mae,
    sexo: dados.tipo_sexo,
    estado_civil: ESTADO_CIVIL_PARA_CRM[String(dados.estado_civil ?? "").toUpperCase()],
    regime_casamento: REGIME_PARA_CRM[String(dados.regime_casamento ?? "").toUpperCase()],
    tipo_documento_identidade: dados.tipo_documento_identidade,
    numero_documento: dados.numero_documento,
    orgao_expedidor: dados.orgao_expedidor,
    uf_expedicao: dados.uf_expedicao,
    data_expedicao: dados.data_expedicao,
    profissao: dados.profissao,
    empresa: dados.empresa,
    renda_total_declarada: dados.renda,
    email: tem(dados.email) ? String(dados.email).toLowerCase() : undefined,
    telefone_celular: tem(dados.celular) ? digitos(dados.celular) : undefined,
    cep: tem(dados.cep) ? digitos(dados.cep) : undefined,
    logradouro: dados.logradouro,
    numero: dados.numero_logradouro,
    complemento: dados.complemento,
    bairro: dados.bairro,
    cidade: dados.municipio,
    uf: dados.uf,
  });
}

/** Vendedor do CRM → linha de `proposta_envolvidos` (mesmo mapa da criação da proposta). */
export function vendedorCrmParaEnvolvido(v: Record<string, any>): Record<string, unknown> {
  return {
    tipo_qualificacao: "VD",
    tipo_pessoa: v.tipo_pessoa === "PJ" ? "J" : "F",
    nome: v.nome,
    cpf_cnpj: v.documento,
    data_nascimento: v.data_nascimento,
    nome_mae: v.mae,
    tipo_sexo: v.sexo ? String(v.sexo).trim().charAt(0).toUpperCase() : v.sexo,
    estado_civil: estadoCivilCrmParaCodigo(v.estado_civil) || null,
    regime_casamento: regimeCasamentoCrmParaCodigo(v.regime_casamento) || null,
    tipo_documento_identidade: v.tipo_documento_identidade,
    numero_documento: v.numero_documento,
    data_expedicao: v.data_expedicao,
    orgao_expedidor: v.orgao_expedidor,
    uf_expedicao: v.uf_expedicao,
    profissao: v.profissao,
    empresa: v.empresa,
    renda: v.renda_total_declarada,
    agencia: v.agencia,
    conta_corrente: v.conta_corrente,
    digito_conta: v.digito_conta,
    email: v.email,
    celular: v.telefone_celular,
    cep: v.cep,
    logradouro: v.logradouro,
    numero_logradouro: v.numero,
    complemento: v.complemento,
    bairro: v.bairro,
    municipio: v.cidade,
    uf: v.uf,
    utiliza_fgts: v.utiliza_fgts ?? false,
    fg_autorizacao_dados: v.fg_autorizacao_dados ?? false,
  };
}

/** Imóvel e valor conferidos na proposta → `clientes.imovel_*`. */
export function imovelParaClienteCrm(proposta: Record<string, any>): Record<string, unknown> {
  return sóPreenchidos({
    imovel_cep: tem(proposta.cep_imovel) ? digitos(proposta.cep_imovel) : undefined,
    imovel_logradouro: proposta.endereco_imovel,
    imovel_numero: proposta.numero_imovel,
    imovel_complemento: proposta.complemento_imovel,
    imovel_bairro: proposta.bairro_imovel,
    imovel_cidade: proposta.cidade_imovel,
    imovel_uf: proposta.uf,
    imovel_tipo: proposta.tipo_imovel,
    imovel_uso: proposta.uso_imovel,
    imovel_situacao: proposta.situacao_imovel,
    imovel_valor: proposta.valor_imovel,
  });
}

/** Mesmo documento (CPF/CNPJ só com dígitos)? Vazio nunca casa. */
export function mesmoDocumento(a: unknown, b: unknown): boolean {
  const x = digitos(a);
  return x.length > 0 && x === digitos(b);
}

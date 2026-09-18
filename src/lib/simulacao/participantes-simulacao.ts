/**
 * Titular e cônjuge completos para a oportunidade criada pela simulação.
 *
 * Módulo puro (testado). O `POST /oportunidade` só aceita nome, CPF,
 * nascimento, e-mail, celular e renda de cada um; a HomeFin cria os
 * participantes com o resto vazio — mãe, sexo, documento, profissão, endereço
 * e `fgAutorizacaoDados: false` — e a simulação dos bancos seguia assim. O
 * padrão de preenchimento do cadastro (`PADROES_CADASTRO`) só era aplicado no
 * envio da proposta. Aqui ele vale já na simulação: o que o cadastro tem vence,
 * o que faltar recebe o padrão, e titular e cônjuge levam os dados um do outro.
 */
import { ENDERECO_PADRAO, PADROES_CADASTRO } from "@/lib/crm/padroes-cadastro";
import { estadoCivilCrmParaCodigo, regimeCasamentoCrmParaCodigo } from "@/lib/propostas/dominios";

const texto = (v: unknown): string | undefined => {
  const s = String(v ?? "").trim();
  return s ? s : undefined;
};
const digitos = (v: unknown): string | undefined => texto(String(v ?? "").replace(/\D/g, ""));
const documento = (v: unknown): string | undefined =>
  texto(String(v ?? "").replace(/[^0-9A-Za-z]/g, ""));
const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function sexo(v: unknown): "M" | "F" | undefined {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return undefined;
}

/** `RG`/`CNH` — o contrato não aceita outros tipos. */
function tipoDocumento(v: unknown): string {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
  return s === "CNH" ? "CNH" : PADROES_CADASTRO.tipoDocumentoIdentidade;
}

export interface EnderecoCadastro {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

/**
 * Endereço do cadastro do cliente; incompleto, vale o endereço padrão inteiro
 * (misturar CEP de um com rua de outro seria pior que o padrão).
 */
export function enderecoParaBanco(e?: EnderecoCadastro | null) {
  const cep = digitos(e?.cep);
  const completo =
    cep?.length === 8 &&
    texto(e?.logradouro) &&
    texto(e?.bairro) &&
    texto(e?.cidade) &&
    texto(e?.uf);
  const base = completo
    ? {
        cep: cep!,
        logradouro: texto(e?.logradouro)!,
        numero: texto(e?.numero) ?? "SN",
        complemento: texto(e?.complemento),
        bairro: texto(e?.bairro)!,
        cidade: texto(e?.cidade)!,
        uf: texto(e?.uf)!.toUpperCase(),
      }
    : { ...ENDERECO_PADRAO, complemento: undefined };
  return {
    cep: base.cep,
    logradouro: base.logradouro,
    numeroLogradouro: base.numero,
    complementoLogradouro: base.complemento,
    bairro: base.bairro,
    municipio: base.cidade,
    uf: base.uf,
  };
}

interface Pessoa {
  nome?: string;
  cpf?: string;
  nascimento?: string;
  mae?: string;
  sexo?: "M" | "F";
  tipoDocumento: string;
  numeroDocumento?: string;
  orgao: string;
  ufExpedicao: string;
  dataExpedicao: string;
  profissao: string;
  empresa: string;
  renda: number;
  email?: string;
  celular?: string;
}

function comoParticipante(p: Pessoa) {
  return {
    nomeParticipante: p.nome,
    cpfCnpj: p.cpf,
    dataNascimento: p.nascimento,
    nomeMae: p.mae,
    tipoSexo: p.sexo,
    tipoDocumentoIdentidade: p.tipoDocumento,
    numeroDocumento: p.numeroDocumento,
    dataExpedicao: p.dataExpedicao,
    orgaoExpedidor: p.orgao,
    ufExpedicao: p.ufExpedicao,
    nomeProfissao: p.profissao,
    nomeEmpresaProfissao: p.empresa,
    renda: p.renda,
    email: p.email,
    celular: p.celular,
  };
}

function comoConjuge(p: Pessoa, estadoCivil: string) {
  return {
    nomeConjuge: p.nome,
    cpfConjuge: p.cpf,
    dataNascimentoConjuge: p.nascimento,
    tipoEstadoCivilConjuge: estadoCivil,
    tipoSexoConjuge: p.sexo,
    tipoDocumentoIdentidadeConjuge: p.tipoDocumento,
    numeroDocumentoConjuge: p.numeroDocumento,
    dataExpedicaoConjuge: p.dataExpedicao,
    orgaoExpedidorConjuge: p.orgao,
    ufExpedicaoConjuge: p.ufExpedicao,
    nomeProfissaoConjuge: p.profissao,
    nomeEmpresaProfissaoConjuge: p.empresa,
    rendaConjuge: p.renda,
  };
}

/**
 * Payloads do `PUT /oportunidade/{id}/participante/{id}` para titular e
 * cônjuge. `conjuge` é `null` quando o titular não é casado ou o cônjuge não
 * está identificado. Só pessoa física.
 */
export function montarParticipantesSimulacao({
  sim,
  cliente,
  endereco,
}: {
  sim: Record<string, any>;
  cliente?: Record<string, any> | null;
  endereco?: EnderecoCadastro | null;
}): { titular: Record<string, unknown>; conjuge: Record<string, unknown> | null } {
  const c = cliente ?? {};
  const P = PADROES_CADASTRO;
  const estadoCivil = estadoCivilCrmParaCodigo(sim.estado_civil || c.estado_civil) || "S";
  const casado = estadoCivil === "CA" || estadoCivil === "UE";
  const cpfTitular = digitos(sim.cpf_cnpj ?? c.documento);

  const titular: Pessoa = {
    nome: texto(sim.nome_cliente),
    cpf: cpfTitular,
    nascimento: texto(sim.data_nascimento ?? c.data_nascimento),
    mae: texto(c.mae) ?? P.mae,
    sexo: sexo(sim.sexo ?? c.sexo),
    tipoDocumento: tipoDocumento(c.tipo_documento_identidade),
    numeroDocumento: documento(c.numero_documento) ?? cpfTitular,
    orgao: texto(c.orgao_expedidor) ?? P.orgaoExpedidor,
    ufExpedicao: texto(c.uf_expedicao) ?? P.ufExpedicao,
    dataExpedicao: texto(c.data_expedicao) ?? P.dataExpedicao,
    profissao: texto(c.profissao) ?? P.profissao,
    empresa: texto(c.empresa) ?? P.empresa,
    renda: numero(sim.renda_total),
    email: texto(sim.email ?? c.email) ?? P.email,
    celular: digitos(sim.celular),
  };

  const cpfConjuge = digitos(sim.cpf_conjuge ?? c.conjuge_cpf);
  const nomeConjuge = texto(sim.nome_conjuge ?? c.conjuge_nome);
  const temConjuge = casado && Boolean(cpfConjuge || nomeConjuge);
  const estadoCivilConjuge = estadoCivilCrmParaCodigo(sim.estado_civil_conjuge) || estadoCivil;
  const conjuge: Pessoa | null = temConjuge
    ? {
        nome: nomeConjuge,
        cpf: cpfConjuge,
        nascimento: texto(sim.data_nascimento_conjuge ?? c.conjuge_data_nascimento),
        mae: texto(c.conjuge_nome_mae) ?? P.mae,
        sexo: sexo(sim.sexo_conjuge ?? c.conjuge_sexo),
        tipoDocumento: tipoDocumento(c.conjuge_tipo_documento_identidade),
        numeroDocumento: documento(c.conjuge_numero_documento) ?? cpfConjuge,
        orgao: texto(c.conjuge_orgao_expedidor) ?? P.orgaoExpedidor,
        ufExpedicao: texto(c.conjuge_uf_expedicao) ?? P.ufExpedicao,
        dataExpedicao: texto(c.conjuge_data_expedicao) ?? P.dataExpedicao,
        profissao: texto(c.conjuge_profissao) ?? P.profissao,
        empresa: texto(c.conjuge_empresa) ?? P.empresa,
        renda:
          sim.compoe_renda_conjuge === false ? 0 : numero(sim.renda_conjuge ?? c.conjuge_renda),
        email: texto(sim.email_conjuge ?? c.conjuge_email) ?? titular.email,
        celular: digitos(sim.celular_conjuge ?? c.conjuge_celular) ?? titular.celular,
      }
    : null;

  const regime = casado
    ? regimeCasamentoCrmParaCodigo(sim.regime_casamento || c.regime_casamento) || "CP"
    : undefined;
  const comum = {
    tipoSituacao: "A",
    tipoQualificacao: "CO",
    tipoPessoa: "F",
    utilizaFgts: String(sim.utiliza_fgts ?? "N") === "S" ? "S" : "N",
    fgAutorizacaoDados: true,
    // Casal mora junto: o mesmo endereço para os dois.
    ...enderecoParaBanco(endereco),
  };

  return {
    titular: {
      ...comum,
      ...comoParticipante(titular),
      tipoEstadoCivil: estadoCivil,
      tipoRegimeCasamento: regime,
      ...(conjuge ? comoConjuge(conjuge, estadoCivilConjuge) : {}),
    },
    conjuge: conjuge
      ? {
          ...comum,
          ...comoParticipante(conjuge),
          tipoEstadoCivil: estadoCivilConjuge,
          tipoRegimeCasamento: regime,
          ...comoConjuge(titular, estadoCivil),
        }
      : null,
  };
}

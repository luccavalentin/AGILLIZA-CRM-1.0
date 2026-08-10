import { ESTADO_CIVIL_COM_REGIME } from "@/lib/propostas/dominios";
import { faltantesEnvolvido } from "@/lib/propostas/campos-obrigatorios";
import { maskCpfCnpj, maskCelular, apenasDigitos, validarCpfCnpj } from "@/lib/simulacao/format";

export type ParticipanteForm = {
  tipo_situacao: string;
  tipo_qualificacao: string;
  tipo_pessoa: string;
  nome: string;
  cpf_cnpj: string;
  data_nascimento: string;
  nome_mae: string;
  tipo_sexo: string;
  estado_civil: string;
  regime_casamento: string;
  tipo_documento_identidade: string;
  numero_documento: string;
  orgao_expedidor: string;
  uf_expedicao: string;
  data_expedicao: string;
  profissao: string;
  empresa: string;
  renda: number;
  email: string;
  celular: string;
  cep: string;
  logradouro: string;
  numero_logradouro: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  utiliza_fgts: boolean;
  fg_autorizacao_dados: boolean;
};

export const VAZIO: ParticipanteForm = {
  tipo_situacao: "A",
  tipo_qualificacao: "CO",
  tipo_pessoa: "F",
  nome: "",
  cpf_cnpj: "",
  data_nascimento: "",
  nome_mae: "",
  tipo_sexo: "",
  estado_civil: "",
  regime_casamento: "",
  tipo_documento_identidade: "",
  numero_documento: "",
  orgao_expedidor: "",
  uf_expedicao: "",
  data_expedicao: "",
  profissao: "",
  empresa: "",
  renda: 0,
  email: "",
  celular: "",
  cep: "",
  logradouro: "",
  numero_logradouro: "",
  complemento: "",
  bairro: "",
  municipio: "",
  uf: "",
  utiliza_fgts: false,
  fg_autorizacao_dados: false,
};

/** Converte a linha do banco (proposta_envolvidos) para o formulário. */
export function envolvidoParaForm(e: any): ParticipanteForm {
  return {
    ...VAZIO,
    tipo_situacao: e.tipo_situacao ?? "A",
    tipo_qualificacao: e.tipo_qualificacao ?? "CO",
    tipo_pessoa: e.tipo_pessoa ?? "F",
    nome: e.nome ?? "",
    cpf_cnpj: e.cpf_cnpj ? maskCpfCnpj(e.cpf_cnpj) : "",
    data_nascimento: e.data_nascimento ?? "",
    nome_mae: e.nome_mae ?? "",
    tipo_sexo: e.tipo_sexo ?? "",
    estado_civil: e.estado_civil ?? "",
    regime_casamento: e.regime_casamento ?? "",
    tipo_documento_identidade: e.tipo_documento_identidade ?? "",
    numero_documento: e.numero_documento ?? "",
    orgao_expedidor: e.orgao_expedidor ?? "",
    uf_expedicao: e.uf_expedicao ?? "",
    data_expedicao: e.data_expedicao ?? "",
    profissao: e.profissao ?? "",
    empresa: e.empresa ?? "",
    renda: e.renda ?? 0,
    email: e.email ?? "",
    celular: e.celular ? maskCelular(e.celular) : "",
    cep: e.cep ?? "",
    logradouro: e.logradouro ?? "",
    numero_logradouro: e.numero_logradouro ?? "",
    complemento: e.complemento ?? "",
    bairro: e.bairro ?? "",
    municipio: e.municipio ?? "",
    uf: e.uf ?? "",
    utiliza_fgts: Boolean(e.utiliza_fgts),
    fg_autorizacao_dados: Boolean(e.fg_autorizacao_dados),
  };
}

/** Normaliza o formulário para o payload salvo em proposta_envolvidos. */
export function formParaEnvolvido(f: ParticipanteForm) {
  const pf = f.tipo_pessoa === "F";
  return {
    tipo_situacao: f.tipo_situacao,
    tipo_qualificacao: f.tipo_qualificacao,
    tipo_pessoa: f.tipo_pessoa,
    nome: f.nome.trim(),
    cpf_cnpj: apenasDigitos(f.cpf_cnpj),
    data_nascimento: pf ? f.data_nascimento || null : null,
    nome_mae: pf ? f.nome_mae.trim() || null : null,
    tipo_sexo: pf ? f.tipo_sexo || null : null,
    estado_civil: pf ? f.estado_civil || null : null,
    regime_casamento:
      pf && ESTADO_CIVIL_COM_REGIME.has(f.estado_civil) ? f.regime_casamento || null : null,
    tipo_documento_identidade: f.tipo_documento_identidade || null,
    numero_documento: f.numero_documento.trim() || null,
    orgao_expedidor: f.orgao_expedidor.trim() || null,
    uf_expedicao: f.uf_expedicao || null,
    data_expedicao: f.data_expedicao || null,
    profissao: f.profissao.trim() || null,
    empresa: f.empresa.trim() || null,
    renda: f.renda || null,
    email: f.email.trim() || null,
    celular: apenasDigitos(f.celular) || null,
    cep: apenasDigitos(f.cep) || null,
    logradouro: f.logradouro.trim() || null,
    numero_logradouro: f.numero_logradouro.trim() || null,
    complemento: f.complemento.trim() || null,
    bairro: f.bairro.trim() || null,
    municipio: f.municipio.trim() || null,
    uf: f.uf || null,
    utiliza_fgts: f.utiliza_fgts,
    fg_autorizacao_dados: f.fg_autorizacao_dados,
  };
}

/** Verifica se um envolvido (linha do banco) tem todos os dados obrigatórios. */
export function participanteCompleto(e: any): boolean {
  return faltantesEnvolvido(e ?? {}).length === 0;
}

/**
 * Retorna a lista de chaves de campos obrigatórios que ainda estão vazios/inválidos.
 * A base é a lista OFICIAL de 25 campos "S" da documentação
 * (`CAMPOS_OBRIGATORIOS_PARTICIPANTE`); aqui só acrescentamos as validações de
 * FORMATO que o formulário consegue fazer (CPF, e-mail, celular).
 *
 * `tipoRegimeCasamento` e `dataExpedicao` NÃO são obrigatórios pela
 * documentação e nunca entram nesta lista.
 */
export function camposFaltantes(f: ParticipanteForm): Set<string> {
  const faltantes = faltantesEnvolvido(f as any);
  const faltando = new Set(faltantes.map((c) => c.chave));

  // Validações de formato (o campo existe, mas o valor não serve).
  if (f.cpf_cnpj && !validarCpfCnpj(f.cpf_cnpj)) faltando.add("cpf_cnpj");
  if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) faltando.add("email");
  if (f.celular && apenasDigitos(f.celular).length < 10) faltando.add("celular");

  return faltando;
}

export function mascararCep(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Classe aplicada a um campo obrigatório vazio (destaque em vermelho). */
export const CLASSE_ERRO =
  "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive animate-in fade-in zoom-in duration-200";

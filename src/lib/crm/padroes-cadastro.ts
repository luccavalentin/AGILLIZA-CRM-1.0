/**
 * Padrões do cadastro de cliente.
 *
 * A API do banco exige campos que o operador quase nunca tem em mãos na hora
 * (nome da mãe, documento de identidade, profissão). Cadastro incompleto
 * significa proposta barrada — ou recusada pelo banco depois de ida e volta.
 * Por isso o que ficar vazio recebe um padrão; o que o operador digitar
 * sempre vence, e ele pode alterar e salvar depois.
 */
export const PADROES_CADASTRO = {
  email: "thiago@agilliza.net.br",
  mae: "Maria José",
  pai: "José Maria",
  /** Filiação padrão do cônjuge — diferente da do titular. */
  maeConjuge: "Ana Maria",
  paiConjuge: "José Antonio",
  profissao: "Administrador",
  empresa: "Agilliza",
  tipoDocumentoIdentidade: "RG",
  orgaoExpedidor: "SSP",
  ufExpedicao: "SP",
  dataExpedicao: "2026-01-01",
  nacionalidade: "Brasileira",
  naturalidade: "São Paulo/SP",
  /** Celular do cônjuge quando vazio ou igual ao do titular (ver `celularConjugeOuPadrao`). */
  celularConjuge: "19998710032",
  /** E-mail do cônjuge quando vazio ou igual ao do titular (ver `emailConjugeOuPadrao`). */
  emailConjuge: "thiago@agilliza1.net.br",
  /** Renda do cônjuge quando vazia ou zero (ver `rendaConjugeOuPadrao`). */
  rendaConjuge: 3000,
} as const;

/** Endereço padrão — só o cadastro do cliente usa; a simulação não mexe em endereço. */
export const ENDERECO_PADRAO = {
  cep: "13416222",
  logradouro: "Rua Dr. Paulo Pinto",
  numero: "1001",
  bairro: "São Dimas",
  cidade: "Piracicaba",
  uf: "SP",
} as const;

const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/** Tamanho do RG usado como padrão (RG de SP: 9 caracteres). */
export const TAMANHO_RG = 9;

/**
 * RG padrão a partir do CPF: os primeiros 9 dígitos do CPF. Quem não informa
 * o RG ia ao banco com os 11 dígitos do CPF no campo de identidade.
 */
export function rgDoCpf(cpf: unknown): string {
  return String(cpf ?? "")
    .replace(/\D/g, "")
    .slice(0, TAMANHO_RG);
}

/** Devolve `padrao` quando o valor está vazio; senão devolve o próprio valor. */
export function ouPadrao<T>(valor: T, padrao: string): T | string {
  return vazio(valor) ? padrao : valor;
}

/**
 * Celular do cônjuge: vazio ou igual ao do titular vira o número padrão.
 *
 * O envio cobra celular de cada participante e a simulação deixa o do cônjuge
 * opcional, então a equipe repetia o do titular — os dois proponentes iam ao
 * banco com o mesmo contato. Um número próprio e diferente, digitado para o
 * cônjuge, é mantido. Devolve só dígitos.
 */
export function celularConjugeOuPadrao(celularConjuge: unknown, celularTitular: unknown): string {
  const conj = String(celularConjuge ?? "").replace(/\D/g, "");
  const tit = String(celularTitular ?? "").replace(/\D/g, "");
  return !conj || conj === tit ? PADROES_CADASTRO.celularConjuge : conj;
}

/**
 * E-mail do cônjuge: vazio ou igual ao do titular vira o e-mail padrão do
 * cônjuge. Mesmo motivo do celular: os dois proponentes iam ao banco com o
 * mesmo contato (o padrão do titular). E-mail próprio e diferente é mantido.
 */
export function emailConjugeOuPadrao(emailConjuge: unknown, emailTitular: unknown): string {
  const conj = String(emailConjuge ?? "")
    .trim()
    .toLowerCase();
  const tit = String(emailTitular ?? "")
    .trim()
    .toLowerCase();
  return !conj || conj === tit ? PADROES_CADASTRO.emailConjuge : conj;
}

/**
 * Renda do cônjuge: vazia, zero ou inválida vira R$ 3.000. O Itaú trata o
 * cônjuge como 2º comprador e exige renda própria dele; o cônjuge ia ao banco
 * com `rendaConjuge: 0` sempre que o operador não preenchia. Se o cônjuge
 * compõe ou não a renda é outro dado (`fgCompoeRenda` da oportunidade).
 */
export function rendaConjugeOuPadrao(renda: unknown): number {
  const n = Number(renda);
  return Number.isFinite(n) && n > 0 ? n : PADROES_CADASTRO.rendaConjuge;
}

/**
 * Nacionalidade, naturalidade e RG de pessoa física: valem na criação E na
 * edição do cadastro (ao contrário dos demais padrões, que só entram na
 * criação). Vazio vira Brasileira / São Paulo-SP / o CPF no tamanho de RG; celular e
 * e-mail do cônjuge seguem `celularConjugeOuPadrao` / `emailConjugeOuPadrao`.
 *
 * Naturalidade é gravada como "Cidade/UF". Só o estado ("/SP") conta como
 * vazia e recebe São Paulo; estado diferente de SP sem cidade fica como está,
 * para não trocar o estado que o operador escolheu.
 */
export function aplicarPadroesIdentificacao<T extends Record<string, any>>(campos: T): T {
  if (campos.tipo_pessoa === "PJ") return campos;
  const c = campos as Record<string, any>;

  if (vazio(c.nacionalidade)) c.nacionalidade = PADROES_CADASTRO.nacionalidade;

  const nat = String(c.naturalidade ?? "").trim();
  const barra = nat.lastIndexOf("/");
  const cidade = barra === -1 ? nat : nat.slice(0, barra).trim();
  const uf =
    barra === -1
      ? ""
      : nat
          .slice(barra + 1)
          .trim()
          .toUpperCase();
  if (!cidade && (!uf || uf === "SP")) c.naturalidade = PADROES_CADASTRO.naturalidade;

  if (!vazio(c.documento)) {
    if (vazio(c.documento_secundario)) c.documento_secundario = rgDoCpf(c.documento);
    if (vazio(c.numero_documento)) c.numero_documento = rgDoCpf(c.documento);
  }

  if (!vazio(c.conjuge_nome) || !vazio(c.conjuge_cpf)) {
    if (vazio(c.conjuge_nacionalidade)) c.conjuge_nacionalidade = PADROES_CADASTRO.nacionalidade;
    if (vazio(c.conjuge_numero_documento) && !vazio(c.conjuge_cpf)) {
      c.conjuge_numero_documento = rgDoCpf(c.conjuge_cpf);
    }
    c.conjuge_celular = celularConjugeOuPadrao(c.conjuge_celular, c.telefone_celular);
    c.conjuge_email = emailConjugeOuPadrao(c.conjuge_email, c.email);
  }
  return campos;
}

/**
 * Cópia do cadastro com nacionalidade, naturalidade e RG padrão, sem alterar
 * o original — para quem só lê o cliente (ex.: copiar para a proposta).
 */
export function comPadroesIdentificacao<T extends Record<string, any>>(campos: T): T {
  return aplicarPadroesIdentificacao({ ...campos });
}

/**
 * Aplica os padrões sobre as colunas de `clientes`.
 *
 * `documento` (CPF), cortado no tamanho de RG, entra como número do documento
 * de identidade quando ele não foi informado; o mesmo vale para o cônjuge com
 * `conjuge_cpf`.
 */
export function aplicarPadroesCliente<T extends Record<string, any>>(campos: T): T {
  const p = PADROES_CADASTRO;
  const comPadrao = (chave: string, padrao: string) => {
    if (vazio(campos[chave])) (campos as Record<string, any>)[chave] = padrao;
  };

  comPadrao("email", p.email);
  comPadrao("mae", p.mae);
  comPadrao("pai", p.pai);
  comPadrao("profissao", p.profissao);
  comPadrao("empresa", p.empresa);
  comPadrao("tipo_documento_identidade", p.tipoDocumentoIdentidade);
  comPadrao("orgao_expedidor", p.orgaoExpedidor);
  comPadrao("uf_expedicao", p.ufExpedicao);
  comPadrao("data_expedicao", p.dataExpedicao);
  if (vazio(campos.numero_documento) && !vazio(campos.documento)) {
    (campos as Record<string, any>).numero_documento = rgDoCpf(campos.documento);
  }

  // Cônjuge: só quando existe cônjuge no cadastro, para não criar um cônjuge
  // fantasma só de padrão em cliente solteiro.
  if (!vazio(campos.conjuge_nome) || !vazio(campos.conjuge_cpf)) {
    comPadrao("conjuge_email", p.emailConjuge);
    comPadrao("conjuge_nome_mae", p.maeConjuge);
    comPadrao("conjuge_profissao", p.profissao);
    comPadrao("conjuge_empresa", p.empresa);
    comPadrao("conjuge_tipo_documento_identidade", p.tipoDocumentoIdentidade);
    comPadrao("conjuge_orgao_expedidor", p.orgaoExpedidor);
    comPadrao("conjuge_uf_expedicao", p.ufExpedicao);
    comPadrao("conjuge_data_expedicao", p.dataExpedicao);
    if (vazio(campos.conjuge_numero_documento) && !vazio(campos.conjuge_cpf)) {
      (campos as Record<string, any>).conjuge_numero_documento = rgDoCpf(campos.conjuge_cpf);
    }
  }

  return aplicarPadroesIdentificacao(campos);
}

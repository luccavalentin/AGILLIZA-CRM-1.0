/**
 * Lista OFICIAL dos campos obrigatórios do POST/PUT
 * `/oportunidade/{id}/participante` — exatamente os 25 marcados com "S" na
 * coluna "Obrig." da documentação da integração.
 *
 * NÃO são obrigatórios (marcados "-"/"N") e portanto NUNCA bloqueiam o envio:
 *   tipoRegimeCasamento, dataExpedicao, nomeEmpresaProfissao,
 *   complementoLogradouro, idBanco, codigoAgencia, codigoContaCorrente,
 *   digitoContaCorrente, tipoEmpresa, dataRegistroEmpresa, faturamentoEmpresa,
 *   patrimonioLiquidoEmpresa, capitalSocialEmpresa e TODOS os campos do
 *   cônjuge (nomeConjuge, cpfConjuge, ...).
 *
 * Vale SOMENTE para PROPOSTA. A simulação não exige estes campos e não pode
 * ser bloqueada por eles.
 */

export type CampoObrigatorio = {
  /** Coluna em `proposta_envolvidos` (e chave do formulário). */
  chave: string;
  /** Campo correspondente no payload da API. */
  api: string;
  /** Rótulo em português exibido na tela. */
  label: string;
  /** Exigido apenas para pessoa física. */
  apenasPF?: boolean;
  /** Campo booleano (o "vazio" é `false`, não string vazia). */
  booleano?: boolean;
};

export const CAMPOS_OBRIGATORIOS_PARTICIPANTE: CampoObrigatorio[] = [
  { chave: "tipo_situacao", api: "tipoSituacao", label: "Situação" },
  { chave: "nome", api: "nomeParticipante", label: "Nome completo" },
  { chave: "tipo_qualificacao", api: "tipoQualificacao", label: "Qualificação" },
  { chave: "tipo_pessoa", api: "tipoPessoa", label: "Tipo de pessoa" },
  { chave: "cpf_cnpj", api: "cpfCnpj", label: "CPF/CNPJ" },
  { chave: "data_nascimento", api: "dataNascimento", label: "Data de nascimento", apenasPF: true },
  { chave: "nome_mae", api: "nomeMae", label: "Nome da mãe", apenasPF: true },
  { chave: "tipo_sexo", api: "tipoSexo", label: "Sexo", apenasPF: true },
  { chave: "estado_civil", api: "tipoEstadoCivil", label: "Estado civil", apenasPF: true },
  {
    chave: "tipo_documento_identidade",
    api: "tipoDocumentoIdentidade",
    label: "Tipo de documento",
  },
  { chave: "numero_documento", api: "numeroDocumento", label: "Número do documento" },
  { chave: "orgao_expedidor", api: "orgaoExpedidor", label: "Órgão expedidor" },
  { chave: "uf_expedicao", api: "ufExpedicao", label: "UF de expedição" },
  { chave: "profissao", api: "nomeProfissao", label: "Profissão" },
  { chave: "renda", api: "renda", label: "Renda" },
  { chave: "email", api: "email", label: "E-mail" },
  { chave: "celular", api: "celular", label: "Celular" },
  { chave: "cep", api: "cep", label: "CEP" },
  { chave: "logradouro", api: "logradouro", label: "Logradouro" },
  { chave: "numero_logradouro", api: "numeroLogradouro", label: "Número" },
  { chave: "bairro", api: "bairro", label: "Bairro" },
  { chave: "municipio", api: "municipio", label: "Município" },
  { chave: "uf", api: "uf", label: "UF" },
  { chave: "utiliza_fgts", api: "utilizaFgts", label: "Utiliza FGTS", booleano: true },
  {
    chave: "fg_autorizacao_dados",
    api: "fgAutorizacaoDados",
    label: "Autorização de consulta de dados",
    booleano: true,
  },
];

/** Chaves obrigatórias (para marcar o asterisco na tela). */
export const CHAVES_OBRIGATORIAS = new Set(
  CAMPOS_OBRIGATORIOS_PARTICIPANTE.map((c) => c.chave),
);

/** Rótulo por chave — reaproveitado nas mensagens de erro. */
export const LABEL_POR_CHAVE: Record<string, string> = Object.fromEntries(
  CAMPOS_OBRIGATORIOS_PARTICIPANTE.map((c) => [c.chave, c.label]),
);

export const QUALIFICACAO_LABEL: Record<string, string> = {
  CO: "comprador",
  TI: "cônjuge/coproponente",
  VD: "vendedor",
};

function vazio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "number") return !(valor > 0);
  return String(valor).trim().length === 0;
}

/**
 * Campos obrigatórios ausentes em uma linha de `proposta_envolvidos`.
 * `utiliza_fgts` é booleano com default e nunca é apontado como pendente;
 * `fg_autorizacao_dados` precisa ser `true` (é um aceite do titular).
 */
export function faltantesEnvolvido(env: Record<string, any> = {}): CampoObrigatorio[] {
  const pf = String(env?.tipo_pessoa ?? "F") === "F";
  return CAMPOS_OBRIGATORIOS_PARTICIPANTE.filter((c) => {
    if (c.apenasPF && !pf) return false;
    if (c.chave === "utiliza_fgts") return false; // booleano com default (S/N)
    if (c.chave === "fg_autorizacao_dados") return env?.fg_autorizacao_dados !== true;
    return vazio(env?.[c.chave]);
  });
}

/** "Hércules Rodrigues de Oliveira (coobrigado)". */
export function descreverParticipante(env: Record<string, any>): string {
  const nome = String(env?.nome ?? "").trim() || "participante sem nome";
  const qual = QUALIFICACAO_LABEL[String(env?.tipo_qualificacao ?? "")] ?? "participante";
  return `${nome} (${qual})`;
}

/** "CEP, logradouro, número, bairro e cidade" */
export function listarLabels(campos: CampoObrigatorio[]): string {
  const labels = campos.map((c) => c.label);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

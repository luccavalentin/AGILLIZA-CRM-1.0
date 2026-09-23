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

import { QUALIFICACOES_ENVIADAS_AO_BANCO } from "./dominios";

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

/**
 * Endereço do proponente: continua pedido na tela, mas não barra o envio — o
 * que ficar vazio sai com o endereço padrão do cadastro.
 */
const CAMPOS_ENDERECO_COM_PADRAO = new Set([
  "cep",
  "logradouro",
  "numero_logradouro",
  "bairro",
  "municipio",
  "uf",
]);

/** Chaves obrigatórias (para marcar o asterisco na tela). */
export const CHAVES_OBRIGATORIAS = new Set(CAMPOS_OBRIGATORIOS_PARTICIPANTE.map((c) => c.chave));

/** Rótulo por chave — reaproveitado nas mensagens de erro. */
export const LABEL_POR_CHAVE: Record<string, string> = Object.fromEntries(
  CAMPOS_OBRIGATORIOS_PARTICIPANTE.map((c) => [c.chave, c.label]),
);

export const QUALIFICACAO_LABEL: Record<string, string> = {
  CO: "comprador",
  TI: "cônjuge/coproponente",
  VD: "vendedor",
};

/**
 * Renda só é cobrada de quem compra e compõe renda por conta própria: o
 * comprador. Cônjuge/coproponente (TI) pode não compor renda — a proposta
 * manda `rendaConjuge: 0` nesse caso — e vendedor não tem renda na operação.
 * Para eles vale zero ou vazio (a integração recebe 0).
 */
export function exigeRenda(env: Record<string, any> | null | undefined): boolean {
  const q = String(env?.tipo_qualificacao ?? "CO").toUpperCase();
  return !env?.conjuge_de && !["VD", "TI", "CJ"].includes(q);
}

/** `tipoDocumentoIdentidade` do CreateParticipantRequest: "RG/CNH". */
export const TIPOS_DOCUMENTO_ACEITOS = ["RG", "CNH"];

function vazio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "number") return !(valor > 0);
  return String(valor).trim().length === 0;
}

/**
 * `dataExpedicao` é opcional no contrato da HomeFin, mas o backend do
 * Santander rejeita a proposta inteira sem ela ("Favor inserir uma data de
 * emissão do documento válida" — visto em produção em 14-15/09/2026,
 * oportunidades 30588/30764). Por isso, quando o Santander está entre os
 * bancos do envio, ela vira obrigatória só para essa chamada — os demais
 * bancos continuam sem essa exigência.
 */
export const CAMPO_DATA_EXPEDICAO: CampoObrigatorio = {
  chave: "data_expedicao",
  api: "dataExpedicao",
  label: "Data de expedição do documento",
  apenasPF: true,
};

/**
 * Campos obrigatórios ausentes em uma linha de `proposta_envolvidos`.
 * `utiliza_fgts` é booleano com default e nunca é apontado como pendente.
 * `fg_autorizacao_dados` continua na lista do contrato, mas deixou de ser
 * cobrado: todo participante vai ao banco com `false` (ver
 * `fgAutorizacaoDadosParticipante`), então exigir o aceite na tela travava o
 * envio sem mudar nada no que a integração recebe.
 *
 * `exigirDataExpedicao` acrescenta `data_expedicao` à lista de obrigatórios
 * — usar quando o Santander está entre os bancos do envio (ver
 * `CAMPO_DATA_EXPEDICAO`).
 */
export function faltantesEnvolvido(
  env: Record<string, any> = {},
  opts: { exigirDataExpedicao?: boolean } = {},
): CampoObrigatorio[] {
  if (!env || typeof env !== "object") return [];
  const pf = String(env?.tipo_pessoa ?? "F") === "F";
  const campos = opts.exigirDataExpedicao
    ? [...CAMPOS_OBRIGATORIOS_PARTICIPANTE, CAMPO_DATA_EXPEDICAO]
    : CAMPOS_OBRIGATORIOS_PARTICIPANTE;
  return campos.filter((c) => {
    if (c.apenasPF && !pf) return false;
    // O contrato aceita só RG ou CNH; o CRM também oferece RNE, Passaporte e
    // CTPS, que a HomeFin não recebe.
    if (c.chave === "tipo_documento_identidade" && !vazio(env?.[c.chave])) {
      return !TIPOS_DOCUMENTO_ACEITOS.includes(String(env[c.chave]).trim().toUpperCase());
    }
    // Endereço vazio vai ao banco com o endereço padrão do cadastro (ver
    // `ENDERECO_PADRAO` e `enviar.server.ts`), então não trava o envio — o
    // operador completa depois na conferência, como faz com profissão e RG.
    if (CAMPOS_ENDERECO_COM_PADRAO.has(c.chave)) return false;
    // RG vazio de pessoa física vai ao banco como o próprio CPF (padrão do
    // cadastro), então não trava o envio.
    if (
      c.chave === "numero_documento" &&
      pf &&
      String(env?.cpf_cnpj ?? "").replace(/\D/g, "").length === 11
    ) {
      return false;
    }
    // Celular vazio do cônjuge/coproponente vai com o número padrão do
    // cônjuge (ver `celularConjugeOuPadrao`), então não trava o envio.
    if (
      c.chave === "celular" &&
      (env?.conjuge_de || String(env?.tipo_qualificacao ?? "") === "TI")
    ) {
      return false;
    }
    if (c.chave === "renda" && !exigeRenda(env)) return false;
    if (c.chave === "utiliza_fgts") return false; // booleano com default (S/N)
    if (c.chave === "fg_autorizacao_dados") return false; // sempre enviado como false
    return vazio(env?.[c.chave]);
  });
}

/**
 * O envolvido vira participante na integração?
 *
 * Só comprador (`CO`) e cônjuge/coproponente (`TI`) são enviados — o vendedor
 * (`VD`) existe apenas no cadastro local. Por isso os campos obrigatórios do
 * `CreateParticipantRequest` não se aplicam a ele e um vendedor incompleto
 * não pode travar o envio da proposta ao banco.
 */
export function ehProponenteEnviadoAoBanco(env: Record<string, any> = {}): boolean {
  return QUALIFICACOES_ENVIADAS_AO_BANCO.includes(
    String(env?.tipo_qualificacao ?? "CO") as (typeof QUALIFICACOES_ENVIADAS_AO_BANCO)[number],
  );
}

/**
 * Proponentes com campo obrigatório faltando, na ordem em que aparecem.
 * É a fonte única usada pelos gates de envio e pelo formulário de cadastro.
 */
export function proponentesPendentes<T extends Record<string, any>>(
  envolvidos: readonly (T | null | undefined)[] = [],
  opts: { exigirDataExpedicao?: boolean } = {},
): { env: T; faltantes: CampoObrigatorio[] }[] {
  return (envolvidos ?? [])
    .filter((e): e is T => Boolean(e) && ehProponenteEnviadoAoBanco(e as Record<string, any>))
    .map((env) => ({ env, faltantes: faltantesEnvolvido(env, opts) }))
    .filter((p) => p.faltantes.length > 0);
}

/** "Banco Santander", "SANTANDER FINANCIAMENTOS" etc. — variações de nome que a HomeFin usa. */
export function ehSantander(nomeBanco: unknown): boolean {
  return /santander/i.test(String(nomeBanco ?? ""));
}

export function ehBradesco(nomeBanco: unknown): boolean {
  return /bradesco/i.test(String(nomeBanco ?? ""));
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

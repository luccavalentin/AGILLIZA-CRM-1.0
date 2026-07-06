/**
 * Domínios dos participantes da oportunidade/proposta.
 * Valores derivados do swagger oficial (CreateParticipantRequest) — os bancos
 * validam exatamente estes códigos ao enviar a proposta.
 */

export type Opcao = { value: string; label: string };

/** tipoSituacao — A/I (Ativa/Inativa) */
export const TIPO_SITUACAO: Opcao[] = [
  { value: "A", label: "Ativa" },
  { value: "I", label: "Inativa" },
];

/** tipoQualificacao — CO/VD (Comprador/Vendedor). TI = terceiro interveniente. */
export const TIPO_QUALIFICACAO: Opcao[] = [
  { value: "CO", label: "Comprador / Proponente" },
  { value: "TI", label: "Cônjuge / Coproponente" },
  { value: "VD", label: "Vendedor" },
];

/** tipoPessoa — F/J (Física/Jurídica) */
export const TIPO_PESSOA: Opcao[] = [
  { value: "F", label: "Pessoa Física" },
  { value: "J", label: "Pessoa Jurídica" },
];

/** tipoSexo — M/F (Masculino/Feminino) */
export const TIPO_SEXO: Opcao[] = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
];

/** tipoEstadoCivil — CA/S/VI/DI/SL/UE */
export const TIPO_ESTADO_CIVIL: Opcao[] = [
  { value: "S", label: "Solteiro(a)" },
  { value: "CA", label: "Casado(a)" },
  { value: "VI", label: "Viúvo(a)" },
  { value: "DI", label: "Divorciado(a)" },
  { value: "SL", label: "Separado(a) Legalmente" },
  { value: "UE", label: "União Estável" },
];

/** tipoRegimeCasamento — CP/CU/PA/SC/SO */
export const TIPO_REGIME_CASAMENTO: Opcao[] = [
  { value: "CP", label: "Comunhão Parcial de Bens" },
  { value: "CU", label: "Comunhão Universal de Bens" },
  { value: "PA", label: "Participação Final nos Aquestos" },
  { value: "SC", label: "Separação Convencional de Bens" },
  { value: "SO", label: "Separação Obrigatória de Bens" },
];

/** tipoDocumentoIdentidade — RG/CNH */
export const TIPO_DOCUMENTO_IDENTIDADE: Opcao[] = [
  { value: "RG", label: "RG" },
  { value: "CNH", label: "CNH" },
];

/** Estados civis que exigem informar o regime de casamento. */
export const ESTADO_CIVIL_COM_REGIME = new Set(["CA", "UE"]);

/**
 * Conversão dos valores gravados no cadastro do cliente (CRM, texto por extenso)
 * para os códigos usados nas simulações e propostas (swagger dos bancos).
 */
const ESTADO_CIVIL_CRM_PARA_CODIGO: Record<string, string> = {
  solteiro: "S",
  casado: "CA",
  uniao_estavel: "UE",
  divorciado: "DI",
  viuvo: "VI",
  separado: "SL",
};

const REGIME_CRM_PARA_CODIGO: Record<string, string> = {
  comunhao_parcial: "CP",
  comunhao_universal: "CU",
  participacao_final: "PA",
  separacao_total: "SC",
  separacao_convencional: "SC",
  separacao_obrigatoria: "SO",
};

/** Retorna o código de estado civil (S/CA/...) a partir do valor do CRM ou do próprio código. */
export function estadoCivilCrmParaCodigo(v: string | null | undefined): string {
  if (!v) return "";
  if (TIPO_ESTADO_CIVIL.some((o) => o.value === v)) return v;
  return ESTADO_CIVIL_CRM_PARA_CODIGO[String(v).toLowerCase()] ?? "";
}

/** Retorna o código de regime de casamento (CP/CU/...) a partir do valor do CRM ou do próprio código. */
export function regimeCasamentoCrmParaCodigo(v: string | null | undefined): string {
  if (!v) return "";
  if (TIPO_REGIME_CASAMENTO.some((o) => o.value === v)) return v;
  return REGIME_CRM_PARA_CODIGO[String(v).toLowerCase()] ?? "";
}

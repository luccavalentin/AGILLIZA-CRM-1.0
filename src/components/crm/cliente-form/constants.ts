export interface ClienteFormValues {
  id?: string;
  tipo_pessoa: "PF" | "PJ";
  nome: string;
  documento: string;
  documento_secundario: string;
  data_nascimento: string;
  estado_civil: string;
  regime_casamento: string;
  mae: string;
  pai: string;
  sexo: string;
  nacionalidade: string;
  naturalidade: string;
  tipo_documento_identidade: string;
  numero_documento: string;
  orgao_expedidor: string;
  uf_expedicao: string;
  data_expedicao: string;
  profissao: string;
  empresa: string;
  /** Campos de pessoa jurídica exigidos pela integração bancária. */
  tipo_empresa: string;
  faturamento_empresa: string;
  patrimonio_liquido_empresa: string;
  capital_social_empresa: string;
  banco_conta: string;
  agencia: string;
  conta_corrente: string;
  digito_conta: string;
  email: string;
  telefone_celular: string;
  renda_total_declarada: string;
  uf_interesse: string;
  utiliza_fgts: boolean;
  fg_autorizacao_dados: boolean;
  origem: string;
  conjuge_nome: string;
  conjuge_cpf: string;
  conjuge_data_nascimento: string;
  conjuge_nome_mae: string;
  conjuge_sexo: string;
  conjuge_nacionalidade: string;
  conjuge_tipo_documento_identidade: string;
  conjuge_numero_documento: string;
  conjuge_orgao_expedidor: string;
  conjuge_uf_expedicao: string;
  conjuge_data_expedicao: string;
  conjuge_profissao: string;
  conjuge_empresa: string;
  conjuge_renda: string;
  conjuge_email: string;
  conjuge_celular: string;
  conjuge_banco_conta: string;
  conjuge_agencia: string;
  conjuge_conta_corrente: string;
  conjuge_digito_conta: string;
}

export interface EnderecoValues {
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/** Atualiza um único campo do formulário de cliente. */
export type SetCampo = <K extends keyof ClienteFormValues>(k: K, val: ClienteFormValues[K]) => void;

/** Classe aplicada a um campo obrigatório pendente (destaque em vermelho). */
export const CLASSE_ERRO =
  "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive";

export const ESTADOS_CIVIS = [
  { v: "solteiro", l: "Solteiro(a)" },
  { v: "casado", l: "Casado(a)" },
  { v: "uniao_estavel", l: "União estável" },
  { v: "divorciado", l: "Divorciado(a)" },
  { v: "viuvo", l: "Viúvo(a)" },
];

export const REGIMES = [
  { v: "comunhao_parcial", l: "Comunhão parcial" },
  { v: "comunhao_universal", l: "Comunhão universal" },
  { v: "separacao_total", l: "Separação total" },
  { v: "participacao_final", l: "Participação final" },
  { v: "nao_aplicavel", l: "Não aplicável" },
];

// Sugestões pré-cadastradas para os campos de autocomplete (texto livre + seleção).
export const OPCOES_SEXO = [
  { v: "M", l: "Masculino" },
  { v: "F", l: "Feminino" },
];

/**
 * Normaliza o sexo salvo para o valor canônico do <Select> ("M"/"F").
 * O cadastro antigo e a sincronização de propostas podem gravar tanto o
 * nome completo ("Masculino"/"Feminino") quanto a inicial ("M"/"F"); sem
 * normalizar, o valor não bate com as opções e o campo aparece vazio.
 */
export function normalizarSexo(valor?: string | null): string {
  if (!valor) return "";
  const c = valor.trim().charAt(0).toUpperCase();
  return c === "M" || c === "F" ? c : "";
}

export const OPCOES_NACIONALIDADE = [
  "Brasileira",
  "Portuguesa",
  "Argentina",
  "Boliviana",
  "Paraguaia",
  "Uruguaia",
  "Chilena",
  "Colombiana",
  "Venezuelana",
  "Peruana",
  "Espanhola",
  "Italiana",
  "Alemã",
  "Francesa",
  "Japonesa",
  "Chinesa",
  "Norte-americana",
];
export const OPCOES_TIPO_DOCUMENTO = ["RG", "CNH", "RNE", "Passaporte", "CTPS"];
export const OPCOES_ORGAO_EXPEDIDOR = [
  "SSP",
  "DETRAN",
  "DIC",
  "IFP",
  "PC",
  "PM",
  "Marinha",
  "Exército",
  "Aeronáutica",
  "OAB",
  "CRM",
  "CREA",
  "MTE",
  "DPF",
];
export const OPCOES_UF = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

// Todas as cidades do Brasil (Cidade/UF) para a naturalidade — fonte IBGE.
import { MUNICIPIOS_BR } from "./municipios-br";
export const OPCOES_NATURALIDADE = MUNICIPIOS_BR;

// Bancos previamente cadastrados para pesquisa/sugestão (conta do cliente).
export const OPCOES_BANCO = [
  "001 - Banco do Brasil",
  "033 - Santander",
  "070 - BRB - Banco de Brasília",
  "077 - Banco Inter",
  "104 - Caixa Econômica Federal",
  "208 - Banco BTG Pactual",
  "212 - Banco Original",
  "237 - Bradesco",
  "260 - Nubank (Nu Pagamentos)",
  "290 - PagBank (PagSeguro)",
  "323 - Mercado Pago",
  "336 - Banco C6",
  "341 - Itaú Unibanco",
  "356 - Banco Real",
  "380 - PicPay",
  "422 - Banco Safra",
  "623 - Banco PAN",
  "633 - Banco Rendimento",
  "655 - Banco Votorantim / BV",
  "745 - Citibank",
  "746 - Banco Modal",
  "748 - Sicredi",
  "756 - Sicoob",
];

// Exibe um número no formato R$ pt-BR (ex.: 20000 -> "20.000,00").
export function formatarMoedaBR(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Aplica máscara de moeda enquanto o usuário digita (tratando os dígitos como centavos).
export function mascararMoedaBR(raw: string): string {
  const digitos = raw.replace(/\D/g, "");
  if (!digitos) return "";
  return formatarMoedaBR(parseInt(digitos, 10) / 100);
}

export function mascararCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export const emptyValues: ClienteFormValues = {
  tipo_pessoa: "PF",
  nome: "",
  documento: "",
  documento_secundario: "",
  data_nascimento: "",
  estado_civil: "solteiro",
  regime_casamento: "",
  mae: "",
  pai: "",
  sexo: "",
  nacionalidade: "Brasileira",
  naturalidade: "",
  tipo_documento_identidade: "",
  numero_documento: "",
  orgao_expedidor: "",
  uf_expedicao: "",
  data_expedicao: "",
  profissao: "",
  empresa: "",
  tipo_empresa: "",
  faturamento_empresa: "",
  patrimonio_liquido_empresa: "",
  capital_social_empresa: "",
  banco_conta: "",
  agencia: "",
  conta_corrente: "",
  digito_conta: "",
  email: "thiago@agilliza.net.br",
  telefone_celular: "",
  renda_total_declarada: "",
  uf_interesse: "",
  utiliza_fgts: false,
  fg_autorizacao_dados: false,
  origem: "direto",
  conjuge_nome: "",
  conjuge_cpf: "",
  conjuge_data_nascimento: "",
  conjuge_nome_mae: "",
  conjuge_sexo: "",
  conjuge_nacionalidade: "Brasileira",
  conjuge_tipo_documento_identidade: "",
  conjuge_numero_documento: "",
  conjuge_orgao_expedidor: "",
  conjuge_uf_expedicao: "",
  conjuge_data_expedicao: "",
  conjuge_profissao: "",
  conjuge_empresa: "",
  conjuge_renda: "",
  conjuge_email: "thiago@agilliza.net.br",
  conjuge_celular: "",
  conjuge_banco_conta: "",
  conjuge_agencia: "",
  conjuge_conta_corrente: "",
  conjuge_digito_conta: "",
};

/** Naturezas jurídicas aceitas pela integração (campo `tipoEmpresa`). */
export const TIPOS_EMPRESA = [
  { v: "MEI", l: "MEI" },
  { v: "ME", l: "ME — Microempresa" },
  { v: "EPP", l: "EPP — Empresa de Pequeno Porte" },
  { v: "EIRELI", l: "EIRELI" },
  { v: "SA", l: "S.A." },
];

import { mascararDocumentoTipo, mascararTelefone } from "@/lib/crm/documento";
import { mascararCep, mascararMoedaBR } from "../cliente-form/constants";

export interface VendedorForm {
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
  banco_conta: string;
  agencia: string;
  conta_corrente: string;
  digito_conta: string;
  conjuge_banco_conta: string;
  conjuge_agencia: string;
  conjuge_conta_corrente: string;
  conjuge_digito_conta: string;
  email: string;
  telefone_celular: string;
  renda_total_declarada: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  utiliza_fgts: boolean;
  fg_autorizacao_dados: boolean;
}

export const VAZIO: VendedorForm = {
  tipo_pessoa: "PF",
  nome: "",
  documento: "",
  documento_secundario: "",
  data_nascimento: "",
  estado_civil: "",
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
  banco_conta: "",
  agencia: "",
  conta_corrente: "",
  digito_conta: "",
  conjuge_banco_conta: "",
  conjuge_agencia: "",
  conjuge_conta_corrente: "",
  conjuge_digito_conta: "",
  email: "",
  telefone_celular: "",
  renda_total_declarada: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  utiliza_fgts: false,
  fg_autorizacao_dados: false,
};

export function paraForm(v: any): VendedorForm {
  return {
    ...VAZIO,
    ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val ?? ""])),
    id: v.id,
    tipo_pessoa: v.tipo_pessoa === "PJ" ? "PJ" : "PF",
    documento: mascararDocumentoTipo(v.documento ?? "", v.tipo_pessoa === "PJ" ? "PJ" : "PF"),
    telefone_celular: mascararTelefone(v.telefone_celular ?? ""),
    cep: mascararCep(v.cep ?? ""),
    renda_total_declarada:
      v.renda_total_declarada != null && v.renda_total_declarada !== ""
        ? mascararMoedaBR(String(Math.round(Number(v.renda_total_declarada) * 100)))
        : "",
    utiliza_fgts: Boolean(v.utiliza_fgts),
    fg_autorizacao_dados: Boolean(v.fg_autorizacao_dados),
  };
}

/**
 * Patches puros para vínculo do titular/cônjuge com o CRM.
 * Extraído de `use-simulacao-completa.ts` para reduzir a superfície do hook.
 * Cada função recebe o `form` atual e devolve o próximo estado — sem side effects.
 */
import { estadoCivilCrmParaCodigo } from "@/lib/propostas/dominios";
import { maskCpfCnpj, maskCelular } from "@/lib/simulacao/format";
import { EMAIL_PADRAO, type Form } from "./state";

/** Aplica dados de um cliente do CRM ao titular (e cônjuge, se houver). */
export function patchSelecionarClienteCRM(prev: Form, c: any): {
  next: Form;
  temConjugePreenchido: boolean;
  nomeCadastro: string;
} {
  const ecOriginal = estadoCivilCrmParaCodigo(c.estado_civil);
  const conjugePreenchido = Boolean(c.conjuge_nome || c.conjuge_cpf || c.conjuge_renda);
  const ec =
    ecOriginal === "CA" || ecOriginal === "UE"
      ? ecOriginal
      : conjugePreenchido
        ? "CA"
        : ecOriginal;
  const temConjuge = ec === "CA" || ec === "UE";
  const next: Form = {
    ...prev,
    cliente_id: c.id,
    nome_cliente: c.nome ?? "",
    cpf_cnpj: c.documento ? maskCpfCnpj(c.documento) : "",
    email: c.email || EMAIL_PADRAO,
    celular: c.telefone_celular ? maskCelular(c.telefone_celular) : "",
    data_nascimento: c.data_nascimento ?? "",
    estado_civil: ec || prev.estado_civil,
    renda_total: c.renda_total_declarada ?? prev.renda_total,
    cep_imovel: c.imovel_cep ?? prev.cep_imovel,
    uf: c.imovel_uf ?? prev.uf,
    possui_conjuge: temConjuge,
    compoe_renda: prev.compoe_renda || (temConjuge && Number(c.conjuge_renda) > 0),
    nome_conjuge: c.conjuge_nome ?? "",
    cpf_conjuge: c.conjuge_cpf ? maskCpfCnpj(c.conjuge_cpf) : "",
    renda_conjuge: c.conjuge_renda ?? 0,
    data_nascimento_conjuge: c.conjuge_data_nascimento ?? "",
    email_conjuge: c.conjuge_email || EMAIL_PADRAO,
    celular_conjuge: c.conjuge_celular ? maskCelular(c.conjuge_celular) : "",
    estado_civil_conjuge: temConjuge ? ec : (prev.estado_civil_conjuge ?? ""),
  };
  return { next, temConjugePreenchido: conjugePreenchido, nomeCadastro: c.nome ?? "" };
}

/** Zera o vínculo do titular com o CRM. */
export function patchLimparTitular(prev: Form): Form {
  return {
    ...prev,
    cliente_id: null,
    nome_cliente: "",
    cpf_cnpj: "",
    email: EMAIL_PADRAO,
    celular: "",
    data_nascimento: "",
    estado_civil: "",
    renda_total: 0,
    possui_conjuge: false,
    compoe_renda: false,
    nome_conjuge: "",
    cpf_conjuge: "",
    renda_conjuge: 0,
    data_nascimento_conjuge: "",
    email_conjuge: EMAIL_PADRAO,
    celular_conjuge: "",
  };
}

/** Puxa os dados do cônjuge cadastrados no CRM para o formulário. */
export function patchPuxarConjugeCRM(prev: Form, crm: any): Form {
  const ecTitular =
    prev.estado_civil === "CA" || prev.estado_civil === "UE" ? prev.estado_civil : "CA";
  return {
    ...prev,
    possui_conjuge: true,
    compoe_renda: prev.compoe_renda || Number(crm.conjuge_renda) > 0,
    estado_civil: ecTitular,
    estado_civil_conjuge: ecTitular,
    nome_conjuge: crm.conjuge_nome ?? "",
    cpf_conjuge: crm.conjuge_cpf ? maskCpfCnpj(crm.conjuge_cpf) : "",
    renda_conjuge: crm.conjuge_renda ?? 0,
    data_nascimento_conjuge: crm.conjuge_data_nascimento ?? "",
    email_conjuge: crm.conjuge_email || EMAIL_PADRAO,
    celular_conjuge: crm.conjuge_celular ? maskCelular(crm.conjuge_celular) : "",
  };
}

/** Inverte titular e cônjuge, preservando os demais campos. */
export function patchInverterPrincipal(prev: Form): Form {
  return {
    ...prev,
    nome_cliente: prev.nome_conjuge ?? "",
    cpf_cnpj: prev.cpf_conjuge ?? "",
    renda_total: Number(prev.renda_conjuge) || 0,
    data_nascimento: prev.data_nascimento_conjuge ?? "",
    estado_civil: prev.estado_civil_conjuge || prev.estado_civil,
    email: prev.email_conjuge || EMAIL_PADRAO,
    celular: prev.celular_conjuge ?? "",
    nome_conjuge: prev.nome_cliente ?? "",
    cpf_conjuge: prev.cpf_cnpj ?? "",
    renda_conjuge: Number(prev.renda_total) || 0,
    data_nascimento_conjuge: prev.data_nascimento ?? "",
    estado_civil_conjuge: prev.estado_civil || prev.estado_civil_conjuge,
    email_conjuge: prev.email || EMAIL_PADRAO,
    celular_conjuge: prev.celular ?? "",
  };
}

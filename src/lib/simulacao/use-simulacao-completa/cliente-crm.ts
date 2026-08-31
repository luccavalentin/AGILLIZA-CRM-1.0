/**
 * Patches puros para vínculo do titular/cônjuge com o CRM.
 * Extraído de `use-simulacao-completa.ts` para reduzir a superfície do hook.
 * Cada função recebe o `form` atual e devolve o próximo estado — sem side effects.
 */
import { estadoCivilCrmParaCodigo, regimeCasamentoCrmParaCodigo } from "@/lib/propostas/dominios";
import { maskCpfCnpj, maskCelular } from "@/lib/simulacao/format";
import { EMAIL_PADRAO, type Form } from "./state";

/** Aplica dados de um cliente do CRM ao titular (e cônjuge, se houver). */
export function patchSelecionarClienteCRM(
  prev: Form,
  c: any,
): {
  next: Form;
  temConjugePreenchido: boolean;
  nomeCadastro: string;
} {
  const ecOriginal = estadoCivilCrmParaCodigo(c.estado_civil);
  const conjugePreenchido = Boolean(c.conjuge_nome || c.conjuge_cpf || c.conjuge_renda);
  // O estado civil do cadastro manda. Antes, qualquer resquício de cônjuge no
  // CRM promovia o cliente a "casado" — e um titular solteiro passava a ter
  // seção de cônjuge e a cobrar o sexo dele.
  const ec = ecOriginal;
  const temConjuge = ec === "CA" || ec === "UE";
  const next: Form = {
    ...prev,
    cliente_id: c.id,
    nome_cliente: c.nome ?? "",
    cpf_cnpj: c.documento ? maskCpfCnpj(c.documento) : "",
    email: c.email || EMAIL_PADRAO,
    celular: c.telefone_celular ? maskCelular(c.telefone_celular) : "",
    data_nascimento: c.data_nascimento ?? "",
    sexo: c.sexo === "M" || c.sexo === "F" ? c.sexo : prev.sexo,
    estado_civil: ec || prev.estado_civil,
    // O regime já era GRAVADO no cadastro a cada simulação, mas nunca era lido
    // de volta: a cada nova simulação do mesmo cliente o campo voltava vazio e
    // precisava ser redigitado. Só faz sentido quando há casamento/união.
    regime_casamento: temConjuge
      ? regimeCasamentoCrmParaCodigo(c.regime_casamento) || prev.regime_casamento
      : "",
    renda_total: c.renda_total_declarada ?? prev.renda_total,
    cep_imovel: c.imovel_cep ?? prev.cep_imovel,
    uf: c.imovel_uf ?? prev.uf,
    possui_conjuge: temConjuge,
    // Nunca herdar a flag do cliente anterior: ela é derivada apenas do
    // cadastro selecionado agora.
    compoe_renda: temConjuge && Number(c.conjuge_renda) > 0,
    compoe_renda_conjuge: temConjuge && Number(c.conjuge_renda) > 0,
    nome_conjuge: c.conjuge_nome ?? "",
    cpf_conjuge: c.conjuge_cpf ? maskCpfCnpj(c.conjuge_cpf) : "",
    renda_conjuge: c.conjuge_renda ?? 0,
    data_nascimento_conjuge: c.conjuge_data_nascimento ?? "",
    sexo_conjuge:
      c.conjuge_sexo === "M" || c.conjuge_sexo === "F" ? c.conjuge_sexo : prev.sexo_conjuge,
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
    compoe_renda_conjuge: false,
    nome_conjuge: "",
    cpf_conjuge: "",
    renda_conjuge: 0,
    data_nascimento_conjuge: "",
    email_conjuge: EMAIL_PADRAO,
    celular_conjuge: "",
  };
}

/** Valor "vazio" (null/undefined/string em branco/zero). */
function vazio(v: unknown) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return v === 0;
  return false;
}

/**
 * Puxa os dados do cônjuge cadastrados no CRM para o formulário.
 * Faz merge: só preenche o que ainda está vazio no formulário, para nunca
 * apagar o que o usuário já digitou — e completa campo a campo.
 */
export function patchPuxarConjugeCRM(prev: Form, crm: any): Form {
  const ecTitular =
    prev.estado_civil === "CA" || prev.estado_civil === "UE" ? prev.estado_civil : "CA";
  const doCrm = {
    nome_conjuge: crm.conjuge_nome ?? "",
    cpf_conjuge: crm.conjuge_cpf ? maskCpfCnpj(crm.conjuge_cpf) : "",
    renda_conjuge: Number(crm.conjuge_renda) || 0,
    data_nascimento_conjuge: crm.conjuge_data_nascimento ?? "",
    email_conjuge: crm.conjuge_email || "",
    celular_conjuge: crm.conjuge_celular ? maskCelular(crm.conjuge_celular) : "",
  };
  const temConjuge = ecTitular === "CA" || ecTitular === "UE";
  const next: Form = {
    ...prev,
    possui_conjuge: temConjuge,
    compoe_renda: temConjuge && (prev.compoe_renda || Number(crm.conjuge_renda) > 0),
    compoe_renda_conjuge:
      temConjuge && (prev.compoe_renda_conjuge || Number(crm.conjuge_renda) > 0),
    estado_civil: ecTitular,
    estado_civil_conjuge: temConjuge ? prev.estado_civil_conjuge || ecTitular : "",
  };
  for (const [k, v] of Object.entries(doCrm)) {
    const atual = (prev as any)[k];
    const ehEmailPadrao = k === "email_conjuge" && atual === EMAIL_PADRAO;
    if (!vazio(v) && (vazio(atual) || ehEmailPadrao)) (next as any)[k] = v;
  }
  if (vazio(next.email_conjuge)) next.email_conjuge = EMAIL_PADRAO;
  return next;
}

/** Indica se ainda há algum campo do cônjuge no CRM que falta no formulário. */
export function faltaConjugeDoCRM(prev: Form, crm: any): boolean {
  const proximo = patchPuxarConjugeCRM(prev, crm);
  return (
    proximo.nome_conjuge !== prev.nome_conjuge ||
    proximo.cpf_conjuge !== prev.cpf_conjuge ||
    proximo.renda_conjuge !== prev.renda_conjuge ||
    proximo.data_nascimento_conjuge !== prev.data_nascimento_conjuge ||
    proximo.email_conjuge !== prev.email_conjuge ||
    proximo.celular_conjuge !== prev.celular_conjuge ||
    proximo.possui_conjuge !== prev.possui_conjuge
  );
}

/** Inverte titular e cônjuge, preservando os demais campos. */
export function patchInverterPrincipal(prev: Form): Form {
  const next: Form = {
    ...prev,
    nome_cliente: prev.nome_conjuge ?? "",
    cpf_cnpj: prev.cpf_conjuge ?? "",
    renda_total: Number(prev.renda_conjuge) || 0,
    data_nascimento: prev.data_nascimento_conjuge ?? "",
    estado_civil: prev.estado_civil_conjuge || prev.estado_civil,
    sexo: prev.sexo_conjuge || prev.sexo,
    email: prev.email_conjuge || EMAIL_PADRAO,
    celular: prev.celular_conjuge ?? "",
    nome_conjuge: prev.nome_cliente ?? "",
    cpf_conjuge: prev.cpf_cnpj ?? "",
    renda_conjuge: Number(prev.renda_total) || 0,
    data_nascimento_conjuge: prev.data_nascimento ?? "",
    estado_civil_conjuge: prev.estado_civil || prev.estado_civil_conjuge,
    sexo_conjuge: prev.sexo || prev.sexo_conjuge,
    email_conjuge: prev.email || EMAIL_PADRAO,
    celular_conjuge: prev.celular ?? "",
  };

  // O cônjuge vive nos campos nativos do formulário, nunca na lista de
  // participantes — por isso inverter titular/cônjuge não mexe nos terceiros.
  return next;
}

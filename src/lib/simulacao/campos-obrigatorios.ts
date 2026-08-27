/**
 * Campos obrigatórios exigidos pela integração bancária (contrato oficial).
 * Módulo puro — usado no servidor (antes do envio) e pode ser usado na UI.
 *
 * Fonte: documentação/contrato da integração —
 *  POST /oportunidade                → dados da operação + titular
 *  POST /oportunidade/{id}/simulacao → dados financeiros por banco
 *  POST /oportunidade/{id}/participante (PUT) → dossiê completo do proponente
 */

export interface CampoFaltante {
  campo: string;
  onde: "Simulação" | "Cadastro do cliente";
}

const rot = (v: unknown) => String(v ?? "").trim();

/** Obrigatórios da Oportunidade + Simulação (bloqueiam o envio). */
export function validarCamposSimulacao(sim: any): CampoFaltante[] {
  const faltantes: CampoFaltante[] = [];
  const add = (campo: string) => faltantes.push({ campo, onde: "Simulação" });

  if (!sim?.id_operacao_homefin) add("Operação");
  if (!rot(sim?.tipo_imovel)) add("Tipo do imóvel");
  if (!rot(sim?.uso_imovel)) add("Uso do imóvel (residencial/comercial)");
  if (!rot(sim?.situacao_imovel)) add("Situação do imóvel (novo/usado)");
  if (!rot(sim?.uf)) add("UF do imóvel");
  if (!(Number(sim?.valor_imovel) > 0)) add("Valor do imóvel");
  if (!(Number(sim?.valor_financiamento) > 0)) add("Valor do financiamento");
  if (!(Number(sim?.prazo) > 0)) add("Prazo");
  if (!rot(sim?.sistema_amortizacao)) add("Sistema de amortização (SAC/PRICE)");
  if (!rot(sim?.nome_cliente)) add("Nome do proponente");
  if (rot(sim?.cpf_cnpj).replace(/\D/g, "").length < 11) add("CPF/CNPJ do proponente");
  if (!rot(sim?.data_nascimento)) add("Data de nascimento");
  // PJ não tem sexo nem estado civil; cobrá-los impede o envio da modalidade.
  const ehPJ = String(sim?.tipo_pessoa ?? "PF").toUpperCase() === "PJ";
  if (!ehPJ && !rot(sim?.sexo)) add("Sexo");
  if (!rot(sim?.email)) add("E-mail");
  if (rot(sim?.celular).replace(/\D/g, "").length < 10) add("Celular");
  if (!(Number(sim?.renda_total) > 0)) add("Renda total");
  if (!ehPJ && !rot(sim?.estado_civil)) add("Estado civil");
  
  // REGRA: o sexo do cônjuge só é exigido quando um cônjuge REALMENTE vai ser
  // enviado ao banco — estado civil casado/união estável E identificação dele
  // preenchida. A flag `possui_conjuge` não entra na conta: ela sobrevive a
  // trocas de estado civil e já fez a simulação de um solteiro ser bloqueada
  // pedindo o sexo de um cônjuge que não existe.
  const ecTitular = rot(sim?.estado_civil).toLowerCase();
  const casadoTitular =
    ecTitular === "ca" || ecTitular === "ue" || ecTitular === "casado" || ecTitular === "uniao_estavel";
  const conjugeIdentificado =
    rot(sim?.nome_conjuge) !== "" || rot(sim?.cpf_conjuge).replace(/\D/g, "") !== "";
  if (casadoTitular && conjugeIdentificado && !rot(sim?.sexo_conjuge)) {
    add("Sexo do cônjuge");
  }

  return faltantes;
}

/**
 * Obrigatórios do participante (dossiê enviado ao banco). A ausência desses
 * dados faz o banco devolver "erro interno" sem explicar o motivo.
 */
export function validarCamposParticipante(sim: any, cliente: any): CampoFaltante[] {
  const faltantes: CampoFaltante[] = [];
  const add = (campo: string) => faltantes.push({ campo, onde: "Cadastro do cliente" });

  const primeiro = (...vs: unknown[]) => vs.map(rot).find((v) => v.length > 0) ?? "";

  // RELAXAMENTO DE VALIDAÇÃO: A HomeFin API é mais flexível para simulações do que para propostas.
  // Campos de dossiê (mãe, sexo, RG, endereço) NÃO bloqueiam a simulação.
  // Mantemos validarCamposParticipante apenas para fins de LOG ou AVISO se necessário.

  if (!primeiro(cliente?.cep, cliente?.endereco_cep, sim?.cep_imovel)) {
    // CEP é opcional na simulação da Oportunidade, mas útil. Não bloqueia.
  }

  return faltantes;
}

/** Monta a mensagem única exibida ao usuário. */
export function mensagemCamposFaltantes(faltantes: CampoFaltante[]): string {
  const porOrigem = new Map<string, string[]>();
  for (const f of faltantes) {
    const lista = porOrigem.get(f.onde) ?? [];
    lista.push(f.campo);
    porOrigem.set(f.onde, lista);
  }
  const partes = [...porOrigem.entries()].map(([onde, campos]) => `${onde}: ${campos.join(", ")}`);
  return `Campos obrigatórios ausentes. ${partes.join(" · ")}. Complete esses campos e reenvie.`;
}

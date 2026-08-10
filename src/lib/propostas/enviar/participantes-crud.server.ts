/**
 * Gestão de participantes (proponentes/vendedores) da oportunidade e
 * listagem de usuários parceiros. Extraído de `enviar.server.ts`.
 *
 * Endpoints do provedor:
 *   POST   /oportunidade/{id}/participante          — incluir novo
 *   DELETE /oportunidade/{idOportunidade}/participante/{id} — remover
 *   GET    /usuarios-parceiros                       — listar usuários parceiros
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  chamarIntegracao,
  IntegracaoBancariaError,
  sanitizarMensagemErro,
} from "@/lib/simulacao/homefin.server";
import { soDigitosStr, sanitizarNumeroDocumento } from "./shared-utils";
import { toTitleCase } from "@/lib/utils";

export interface ParticipantePayload {
  nomeParticipante: string;
  cpfCnpj: string;
  tipoQualificacao?: "CO" | "VD" | "TI" | "CJ" | string; // Comprador / Vendedor / Titular / Cônjuge
  tipoPessoa?: "F" | "J";
  tipoSituacao?: "A" | "I";
  dataNascimento?: string;
  nomeMae?: string;
  tipoSexo?: "M" | "F";
  tipoEstadoCivil?: string;
  tipoRegimeCasamento?: string;
  tipoDocumentoIdentidade?: "RG" | "CNH";
  numeroDocumento?: string;
  dataExpedicao?: string;
  orgaoExpedidor?: string;
  ufExpedicao?: string;
  nomeProfissao?: string;
  nomeEmpresaProfissao?: string;
  renda?: number;
  email?: string;
  celular?: string;
  cep?: string;
  logradouro?: string;
  numeroLogradouro?: string;
  complementoLogradouro?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  utilizaFgts?: "S" | "N";
  fgAutorizacaoDados?: boolean;
  // Empresa (PJ)
  tipoEmpresa?: string;
  dataRegistroEmpresa?: string;
  faturamentoEmpresa?: number;
  patrimonioLiquidoEmpresa?: number;
  capitalSocialEmpresa?: number;
  // Cônjuge
  nomeConjuge?: string;
  cpfConjuge?: string;
  dataNascimentoConjuge?: string;
  tipoEstadoCivilConjuge?: string;
  tipoDocumentoIdentidadeConjuge?: string;
  numeroDocumentoConjuge?: string;
  dataExpedicaoConjuge?: string;
  orgaoExpedidorConjuge?: string;
  ufExpedicaoConjuge?: string;
  nomeProfissaoConjuge?: string;
  rendaConjuge?: number;
  nomeEmpresaProfissaoConjuge?: string;
  tipoSexoConjuge?: string;
}

export async function adicionarParticipanteImpl({
  propostaId,
  participante,
  supabase,
}: {
  propostaId: string;
  participante: ParticipantePayload;
  supabase: SupabaseClient<any, any, any>;
}): Promise<{ idParticipante: number | null }> {
  const { data: prop } = await supabase
    .from("propostas")
    .select("homefin_id_oportunidade, simulacao_id, correspondente_id")
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.homefin_id_oportunidade) {
    throw new Error("Proposta sem oportunidade vinculada.");
  }
  const cpfCnpj = soDigitosStr(participante.cpfCnpj);
  if (!cpfCnpj) throw new Error("CPF/CNPJ obrigatório para incluir participante.");

  // Deduplicação entre titular e cônjuge no mesmo payload
  const cpfConj = soDigitosStr(participante.cpfConjuge);
  if (cpfConj && cpfConj === cpfCnpj) {
    throw new Error(
      "O CPF do titular e do cônjuge não podem ser iguais. Por favor, corrija o cadastro.",
    );
  }

  // Deduplicação por CPF contra envolvidos já existentes
  const { data: envsExistentes } = await supabase
    .from("proposta_envolvidos")
    .select("cpf_cnpj, tipo_qualificacao")
    .eq("proposta_id", propostaId);

  const envolvidos = envsExistentes ?? [];
  const cpfsExistentes = envolvidos.map((e) => soDigitosStr(e.cpf_cnpj)).filter(Boolean);

  if (cpfsExistentes.includes(cpfCnpj)) {
    const jaEhConjuge = envolvidos.some(
      (e) => soDigitosStr(e.cpf_cnpj) === cpfCnpj && e.tipo_qualificacao === "CJ",
    );
    if (jaEhConjuge) {
      throw new Error(
        "Este participante já está cadastrado como cônjuge. Para torná-lo proponente, remova-o da seção de cônjuge primeiro.",
      );
    }
    throw new Error("Este CPF/CNPJ já está cadastrado nesta proposta.");
  }

  const payload = {
    tipoSituacao: participante.tipoSituacao ?? "A",
    tipoQualificacao: participante.tipoQualificacao ?? "CO",
    tipoPessoa: participante.tipoPessoa ?? (cpfCnpj.length > 11 ? "J" : "F"),
    ...participante,
    nomeParticipante: toTitleCase(participante.nomeParticipante),
    nomeMae: toTitleCase(participante.nomeMae),
    nomeProfissao: toTitleCase(participante.nomeProfissao),
    nomeEmpresaProfissao: toTitleCase(participante.nomeEmpresaProfissao),
    nomeConjuge: toTitleCase(participante.nomeConjuge),
    nomeProfissaoConjuge: toTitleCase(participante.nomeProfissaoConjuge),
    nomeEmpresaProfissaoConjuge: toTitleCase(participante.nomeEmpresaProfissaoConjuge),
    logradouro: toTitleCase(participante.logradouro),
    bairro: toTitleCase(participante.bairro),
    municipio: toTitleCase(participante.municipio),
    cpfCnpj,
    numeroDocumento: sanitizarNumeroDocumento(participante.numeroDocumento),
    numeroDocumentoConjuge: sanitizarNumeroDocumento(participante.numeroDocumentoConjuge),
    celular: soDigitosStr(participante.celular),
    cep: soDigitosStr(participante.cep),
    fgAutorizacaoDados: participante.fgAutorizacaoDados ?? true,
  };
  try {
    const resp = await chamarIntegracao<any>(
      `/oportunidade/${prop.homefin_id_oportunidade}/participante`,
      "POST",
      payload,
      {
        simulacao_id: prop.simulacao_id,
        proposta_id: propostaId,
        correspondente_id: prop.correspondente_id,
      },
    );
    const idParticipante =
      Number(resp?.idParticipante ?? resp?.data?.idParticipante ?? resp?.id ?? 0) || null;
    return { idParticipante };
  } catch (e) {
    if (e instanceof IntegracaoBancariaError) {
      throw new Error(sanitizarMensagemErro(e.message));
    }
    throw e;
  }
}

export async function removerParticipanteImpl({
  propostaId,
  idParticipante,
  supabase,
}: {
  propostaId: string;
  idParticipante: number;
  supabase: SupabaseClient<any, any, any>;
}): Promise<void> {
  const { data: prop } = await supabase
    .from("propostas")
    .select("homefin_id_oportunidade, simulacao_id, correspondente_id")
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.homefin_id_oportunidade) {
    throw new Error("Proposta sem oportunidade vinculada.");
  }
  try {
    await chamarIntegracao<any>(
      `/oportunidade/${prop.homefin_id_oportunidade}/participante/${idParticipante}`,
      "DELETE",
      undefined,
      {
        simulacao_id: prop.simulacao_id,
        proposta_id: propostaId,
        correspondente_id: prop.correspondente_id,
      },
    );
  } catch (e) {
    if (e instanceof IntegracaoBancariaError) {
      throw new Error(sanitizarMensagemErro(e.message));
    }
    throw e;
  }
}

export interface UsuarioParceiroBanco {
  idUsuarioParceiro: number;
  nomeUsuarioParceiro: string;
  cpfCnpj: string | null;
  nomeProprietario: string | null;
  emailProprietario: string | null;
  celularProprietario: string | null;
  nomeFaturamento: string | null;
  emailFaturamento: string | null;
  celularFaturamento: string | null;
  tipoSituacao: "A" | "I" | string;
}

export async function listarUsuariosParceirosImpl(): Promise<UsuarioParceiroBanco[]> {
  try {
    const resp = await chamarIntegracao<any>("/usuarios-parceiros", "GET", undefined, {});
    const arr: any[] = Array.isArray(resp) ? resp : (resp?.data ?? resp?.usuarios ?? []);
    return (arr ?? []).map((u) => ({
      idUsuarioParceiro: Number(u.idUsuarioParceiro),
      nomeUsuarioParceiro: String(u.nomeUsuarioParceiro ?? ""),
      cpfCnpj: u.cpfCnpj ?? null,
      nomeProprietario: u.nomeProprietario ?? null,
      emailProprietario: u.emailProprietario ?? null,
      celularProprietario: u.celularProprietario ?? null,
      nomeFaturamento: u.nomeFaturamento ?? null,
      emailFaturamento: u.emailFaturamento ?? null,
      celularFaturamento: u.celularFaturamento ?? null,
      tipoSituacao: u.tipoSituacao ?? "A",
    }));
  } catch (e) {
    if (e instanceof IntegracaoBancariaError) {
      throw new Error(sanitizarMensagemErro(e.message));
    }
    throw e;
  }
}

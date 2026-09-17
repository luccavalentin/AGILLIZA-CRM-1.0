/**
 * Envia à oportunidade da HomeFin o endereço do imóvel, o contato da vistoria
 * e o interveniente quitante (ver `imovel-oportunidade.ts`).
 *
 * Chamada ISOLADA (`PUT /oportunidade/{id}` só com esses campos): o PUT é
 * parcial — os 86 PUTs só com `tipoSituacao` preservaram o resto da
 * oportunidade —, e se o provedor recusar algum campo a proposta e os
 * documentos não são afetados. A resposta é conferida campo a campo, porque a
 * API devolve 200 mesmo quando descarta um valor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  conferirGravacao,
  montarDadosImovelOportunidade,
  ROTULOS_IMOVEL,
} from "./imovel-oportunidade";

export interface ResultadoDadosImovel {
  /** Rótulos do que será/foi enviado. */
  campos: { campo: string; rotulo: string; valor: string }[];
  semCampoNaApi: string[];
  enviado: boolean;
  confirmados: string[];
  naoConfirmados: string[];
  erro: string | null;
}

export async function dadosImovelOportunidadeImpl({
  propostaId,
  supabase,
  enviar,
}: {
  propostaId: string;
  supabase: SupabaseClient<any, any, any>;
  enviar: boolean;
}): Promise<ResultadoDadosImovel> {
  const { data: prop, error } = await supabase
    .from("propostas")
    .select(
      "id, cliente_id, correspondente_id, homefin_id_oportunidade, cep_imovel, endereco_imovel, numero_imovel, complemento_imovel, bairro_imovel, cidade_imovel, uf, iq_nome, iq_comentario",
    )
    .eq("id", propostaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prop) throw new Error("Proposta não encontrada.");

  let checklist: Record<string, unknown> = {};
  if (prop.cliente_id) {
    const { data: cli } = await supabase
      .from("clientes")
      .select("documentos_checklist")
      .eq("id", prop.cliente_id)
      .maybeSingle();
    checklist = ((cli as any)?.documentos_checklist ?? {}) as Record<string, unknown>;
  }

  const { payload, semCampoNaApi } = montarDadosImovelOportunidade(prop as any, checklist);
  const campos = Object.entries(payload).map(([campo, valor]) => ({
    campo,
    rotulo: ROTULOS_IMOVEL[campo] ?? campo,
    valor,
  }));
  const base: ResultadoDadosImovel = {
    campos,
    semCampoNaApi,
    enviado: false,
    confirmados: [],
    naoConfirmados: [],
    erro: null,
  };
  if (!enviar || campos.length === 0) return base;
  if (!prop.homefin_id_oportunidade) {
    return { ...base, erro: "Proposta ainda sem oportunidade no banco. Envie a proposta antes." };
  }

  const { chamarIntegracao, sanitizarMensagemErro } =
    await import("@/lib/simulacao/homefin.server");
  try {
    const resp = await chamarIntegracao<any>(
      `/oportunidade/${prop.homefin_id_oportunidade}`,
      "PUT",
      payload,
      { proposta_id: propostaId, correspondente_id: prop.correspondente_id },
    );
    const oportunidade = resp?.oportunidade ?? resp ?? {};
    const { confirmados, naoConfirmados } = conferirGravacao(payload, oportunidade);
    return { ...base, enviado: true, confirmados, naoConfirmados };
  } catch (e) {
    const bruto = e instanceof Error ? e.message : String(e);
    return { ...base, erro: sanitizarMensagemErro(bruto) || "O banco recusou os dados do imóvel." };
  }
}

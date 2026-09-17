/**
 * Espelho proposta ↔ CRM (servidor). As conversões de campo ficam em
 * `sincronizar-crm.ts`; aqui estão as leituras e gravações.
 *
 * Proposta → CRM (`espelharEnvolvidoNoCrm`): toda gravação de participante,
 * venha da conferência do Continuar proposta ou da proposta completa.
 *
 * CRM → proposta (`sincronizarPropostaComCrmImpl`): ao abrir a proposta.
 * Participantes (dados, documento, endereço), vendedores e imóvel/vistoria.
 * O gatilho `sync_cliente_derivados` já cobre nome, contato, nascimento,
 * estado civil, renda, mãe, profissão e sexo a cada alteração do cliente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  conjugeParaClienteCrm,
  envolvidoParaVendedorCrm,
  mesmoDocumento,
  vendedorCrmParaEnvolvido,
} from "./sincronizar-crm";

type Db = SupabaseClient<any, any, any>;

/** Grava no CRM o participante como ele ficou na proposta. */
export async function espelharEnvolvidoNoCrm({
  supabase,
  envolvido,
  antes,
}: {
  supabase: Db;
  envolvido: any;
  antes: any | null;
}): Promise<void> {
  if (!envolvido) return;
  if (envolvido.cliente_id) {
    const { sincronizarEnvolvidoParaCliente } = await import("./propostas.functions");
    await sincronizarEnvolvidoParaCliente(supabase, String(envolvido.cliente_id), envolvido);
    return;
  }
  const { data: prop } = await supabase
    .from("propostas")
    .select("cliente_id")
    .eq("id", envolvido.proposta_id)
    .maybeSingle();
  const clienteProposta = prop?.cliente_id ?? null;

  if (envolvido.tipo_qualificacao === "VD" && !envolvido.conjuge_de) {
    if (clienteProposta)
      await espelharVendedor(supabase, clienteProposta, antes ?? envolvido, envolvido);
    return;
  }
  if (envolvido.conjuge_de) {
    const { data: titular } = await supabase
      .from("proposta_envolvidos")
      .select("cliente_id, tipo_qualificacao")
      .eq("id", envolvido.conjuge_de)
      .maybeSingle();
    // Cônjuge do vendedor não tem colunas próprias no CRM.
    if (titular?.tipo_qualificacao === "VD") return;
    const clienteTitular = titular?.cliente_id ?? clienteProposta;
    const crm = conjugeParaClienteCrm(envolvido);
    if (clienteTitular && Object.keys(crm).length > 0) {
      await supabase
        .from("clientes")
        .update(crm as any)
        .eq("id", clienteTitular);
    }
  }
}

async function espelharVendedor(supabase: Db, clienteId: string, antes: any, depois: any) {
  const { data: vendedores } = await supabase
    .from("cliente_vendedores")
    .select("id, documento")
    .eq("cliente_id", clienteId);
  const alvo =
    ((vendedores ?? []) as any[]).find(
      (v) =>
        mesmoDocumento(v.documento, antes?.cpf_cnpj) ||
        mesmoDocumento(v.documento, depois?.cpf_cnpj),
    ) ?? null;
  const patch = envolvidoParaVendedorCrm(depois);
  if (Object.keys(patch).length === 0) return;
  if (alvo) {
    await supabase
      .from("cliente_vendedores")
      .update(patch as any)
      .eq("id", alvo.id);
  } else if (patch.nome) {
    await supabase.from("cliente_vendedores").insert({ cliente_id: clienteId, ...patch } as any);
  }
}

export interface ResultadoSincronizacaoCrm {
  participantes: number;
  vendedoresIncluidos: number;
  vendedoresAtualizados: number;
  vendedoresRemovidos: number;
  imovel: string[];
  /** Repasse à HomeFin, quando pedido e a proposta já tem oportunidade. */
  homefin: ResultadoEspelhoHomefin | null;
}

export interface ResultadoEspelhoHomefin {
  erros: { bloco: "participantes" | "vendedores" | "imovel"; mensagem: string }[];
  vendedoresPendentes: { nome: string; faltando: string[] }[];
}

/** Status em que a oportunidade já recebeu a proposta e aceita atualização. */
const STATUS_COM_OPORTUNIDADE_ATIVA = [
  "enviada_banco",
  "em_analise_credito",
  "credito_aprovado",
  "credito_condicionado",
  "aguardando_documentos",
  "engenharia_vistoria",
  "analise_juridica",
];

/**
 * Repassa à oportunidade o cadastro atual da proposta:
 * participantes (`PUT /oportunidade/{id}/participante/{id}`), vendedores
 * (participante VD) e imóvel/vistoria/IQ (`PUT /oportunidade/{id}`). Valores
 * (imóvel, financiamento, prazo) ficam de fora de propósito: mexem na
 * aprovação e só vão pela conferência, com confirmação.
 */
export async function espelharPropostaNaHomefin({
  supabase,
  propostaId,
}: {
  supabase: Db;
  propostaId: string;
}): Promise<ResultadoEspelhoHomefin | null> {
  const { data: prop } = await supabase
    .from("propostas")
    .select("*")
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.homefin_id_oportunidade) return null;
  if (!STATUS_COM_OPORTUNIDADE_ATIVA.includes(String(prop.status))) return null;

  const { sanitizarMensagemErro } = await import("@/lib/simulacao/homefin.server");
  const msg = (e: unknown) => sanitizarMensagemErro(e instanceof Error ? e.message : String(e));
  const out: ResultadoEspelhoHomefin = { erros: [], vendedoresPendentes: [] };

  const { data: bancos } = await supabase
    .from("proposta_bancos")
    .select("*")
    .eq("proposta_id", propostaId);
  const lista = (bancos ?? []) as any[];
  const aprovado = (b: any) => ["aprovada", "aprovado", "condicionado"].includes(b.status_banco);
  const pb =
    lista.find((b) => aprovado(b) && b.selecionado) ??
    lista.find(aprovado) ??
    lista.find((b) => b.selecionado) ??
    lista[0] ??
    null;

  try {
    const { garantirEnderecoParticipantes } = await import("./enviar.server");
    await garantirEnderecoParticipantes({
      prop,
      pb,
      idOportunidade: prop.homefin_id_oportunidade,
      ctx: {
        simulacao_id: prop.simulacao_id,
        proposta_id: prop.id,
        correspondente_id: prop.correspondente_id,
      },
      supabase,
    });
  } catch (e) {
    out.erros.push({ bloco: "participantes", mensagem: msg(e) });
  }

  try {
    const { sincronizarVendedoresHomefinImpl } = await import("./enviar.server");
    const v = await sincronizarVendedoresHomefinImpl({ propostaId, supabase });
    out.vendedoresPendentes = v.pendentes;
    for (const e of v.erros)
      out.erros.push({ bloco: "vendedores", mensagem: `${e.nome}: ${e.mensagem}` });
  } catch (e) {
    out.erros.push({ bloco: "vendedores", mensagem: msg(e) });
  }

  try {
    const { dadosImovelOportunidadeImpl } = await import("./enviar/imovel-oportunidade.server");
    const r = await dadosImovelOportunidadeImpl({ propostaId, supabase, enviar: true });
    if (r.erro) out.erros.push({ bloco: "imovel", mensagem: r.erro });
  } catch (e) {
    out.erros.push({ bloco: "imovel", mensagem: msg(e) });
  }

  if (out.erros.length > 0) {
    await supabase.from("proposta_historico").insert({
      proposta_id: propostaId,
      tipo_evento: "erro_envio",
      descricao: `Atualização cadastral não chegou à HomeFin: ${out.erros
        .map((e) => e.mensagem)
        .join(" · ")}`,
    } as any);
  }
  return out;
}

/**
 * Alteração cadastral feita no CRM → propostas abertas do cliente, e delas à
 * HomeFin. Chamada ao gravar cliente, endereço, vendedor, imóvel/IQ e contato
 * da vistoria. Nunca derruba a gravação no CRM.
 */
export async function propagarClienteParaPropostas({
  supabase,
  clienteId,
}: {
  supabase: Db;
  clienteId: string;
}): Promise<void> {
  try {
    const { data: propostas } = await supabase
      .from("propostas")
      .select("id")
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .not("homefin_id_oportunidade", "is", null)
      .in("status", STATUS_COM_OPORTUNIDADE_ATIVA as any);
    for (const p of (propostas ?? []) as any[]) {
      try {
        await sincronizarPropostaComCrmImpl({ supabase, propostaId: p.id, espelharHomefin: true });
      } catch (e) {
        console.error("[espelho-crm] proposta", p.id, e);
      }
    }
  } catch (e) {
    console.error("[espelho-crm] cliente", clienteId, e);
  }
}

const STATUS_FECHADOS = ["contrato_emitido", "cancelada", "credito_recusado", "registrado"];

/** Traz para a proposta o que mudou no CRM depois dela. */
export async function sincronizarPropostaComCrmImpl({
  supabase,
  propostaId,
  espelharHomefin = false,
}: {
  supabase: Db;
  propostaId: string;
  /** Repassa à HomeFin mesmo sem mudança local (o gatilho do CRM já pode tê-la aplicado). */
  espelharHomefin?: boolean;
}): Promise<ResultadoSincronizacaoCrm> {
  const r: ResultadoSincronizacaoCrm = {
    participantes: 0,
    vendedoresIncluidos: 0,
    vendedoresAtualizados: 0,
    vendedoresRemovidos: 0,
    imovel: [],
    homefin: null,
  };
  const { data: prop } = await supabase
    .from("propostas")
    .select("*")
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.cliente_id || STATUS_FECHADOS.includes(String(prop.status))) return r;

  // Participantes: dados, documento de identidade e endereço.
  const { ressincronizarDadosParticipantesImpl } = await import("./propostas.functions");
  const part = await ressincronizarDadosParticipantesImpl({
    supabase,
    data: { proposta_id: propostaId, crm_prevalece: true },
  });
  r.participantes = Number(part?.alterados ?? 0);

  // Vendedores: cadastro do CRM é a fonte.
  const [{ data: vendedores }, { data: envolvidosVd }, { data: cliente }] = await Promise.all([
    supabase.from("cliente_vendedores").select("*").eq("cliente_id", prop.cliente_id),
    supabase
      .from("proposta_envolvidos")
      .select("id, cpf_cnpj, nome, updated_at, homefin_id_participante")
      .eq("proposta_id", propostaId)
      .eq("tipo_qualificacao", "VD")
      .is("conjuge_de", null),
    supabase
      .from("clientes")
      .select(
        "updated_at, documentos_checklist, iq_nome, iq_comentario, imovel_cep, imovel_logradouro, imovel_numero, imovel_complemento, imovel_bairro, imovel_cidade, imovel_uf, imovel_tipo, imovel_uso, imovel_situacao",
      )
      .eq("id", prop.cliente_id)
      .maybeSingle(),
  ]);
  const vds = (vendedores ?? []) as any[];
  const envs = (envolvidosVd ?? []) as any[];
  for (const v of vds) {
    const env = envs.find(
      (e) =>
        mesmoDocumento(e.cpf_cnpj, v.documento) ||
        (!e.cpf_cnpj && String(e.nome ?? "").trim() === String(v.nome ?? "").trim()),
    );
    const linha = vendedorCrmParaEnvolvido(v);
    if (!env) {
      const { error } = await supabase
        .from("proposta_envolvidos")
        .insert({ proposta_id: propostaId, cliente_id: null, ...linha } as any);
      if (!error) r.vendedoresIncluidos++;
    } else if (new Date(v.updated_at ?? 0).getTime() > new Date(env.updated_at ?? 0).getTime()) {
      const { error } = await supabase
        .from("proposta_envolvidos")
        .update(linha as any)
        .eq("id", env.id);
      if (!error) r.vendedoresAtualizados++;
    }
  }
  // Vendedor excluído no CRM sai da proposta — só se nunca foi à HomeFin
  // (lá a exclusão de participante é outra operação e não é feita sozinha).
  for (const e of envs) {
    const noCrm = vds.some(
      (v) =>
        mesmoDocumento(e.cpf_cnpj, v.documento) ||
        (!e.cpf_cnpj && String(e.nome ?? "").trim() === String(v.nome ?? "").trim()),
    );
    if (!noCrm && !e.homefin_id_participante) {
      const { error } = await supabase.from("proposta_envolvidos").delete().eq("id", e.id);
      if (!error) r.vendedoresRemovidos++;
    }
  }

  // Imóvel e contato da vistoria: CRM mais novo que a proposta vence.
  const c = cliente as any;
  if (c && new Date(c.updated_at ?? 0).getTime() > new Date(prop.updated_at ?? 0).getTime()) {
    const checklist = (c.documentos_checklist ?? {}) as Record<string, any>;
    const doCrm: Record<string, unknown> = {
      cep_imovel: c.imovel_cep ? String(c.imovel_cep).replace(/\D/g, "") : null,
      endereco_imovel: c.imovel_logradouro,
      numero_imovel: c.imovel_numero,
      complemento_imovel: c.imovel_complemento,
      bairro_imovel: c.imovel_bairro,
      cidade_imovel: c.imovel_cidade,
      uf: c.imovel_uf,
      tipo_imovel: c.imovel_tipo,
      uso_imovel: c.imovel_uso,
      situacao_imovel: c.imovel_situacao,
      contato_avaliacao_nome: checklist.i_vistoria_nome,
      contato_avaliacao_telefone: checklist.i_vistoria_tel
        ? String(checklist.i_vistoria_tel).replace(/\D/g, "")
        : null,
      iq_nome: c.iq_nome,
      iq_comentario: c.iq_comentario,
    };
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(doCrm)) {
      if (v === null || v === undefined || String(v).trim() === "") continue;
      if (String(v) !== String(prop[k] ?? "")) patch[k] = v;
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("propostas")
        .update(patch as any)
        .eq("id", propostaId);
      if (!error) r.imovel = Object.keys(patch);
    }
  }

  const mudou =
    r.participantes + r.vendedoresIncluidos + r.vendedoresAtualizados + r.vendedoresRemovidos > 0 ||
    r.imovel.length > 0;
  if (espelharHomefin || mudou) {
    r.homefin = await espelharPropostaNaHomefin({ supabase, propostaId });
  }
  return r;
}

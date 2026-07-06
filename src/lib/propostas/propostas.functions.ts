import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  transicaoPermitida,
  STATUS_EDITAVEIS,
  STATUS_TERMINAIS,
  type PropostaStatus,
} from "./state-machine";

/** ===== Tipos de saída ===== */
export interface PropostaBancoResumo {
  nome_banco: string | null;
  status_banco: string | null;
}

export interface PropostaListaItem {
  id: string;
  numero_proposta: string;
  nome_cliente: string | null;
  nome_banco: string | null;
  produto: string | null;
  valor_financiamento: number | null;
  status: string;
  created_at: string;
  bancos: PropostaBancoResumo[];
}

export interface PropostaCompleta {
  proposta: any;
  bancos: any[];
  envolvidos: any[];
  documentos: any[];
  followups: any[];
  historico: any[];
}

async function correspondenteId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário sem correspondente vinculado.");
  return data as string;
}

/** Garante que a proposta ainda aceita edição de dados (rascunho / aguardando_documentos). */
async function assertPropostaEditavel(supabase: any, propostaId: string): Promise<void> {
  const { data: prop } = await supabase
    .from("propostas")
    .select("status")
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop) throw new Error("Proposta não encontrada.");
  if (!STATUS_EDITAVEIS.includes(prop.status as PropostaStatus)) {
    throw new Error("Esta proposta não pode mais ser editada no estado atual.");
  }
}

/** ===== Listagem ===== */
export const listarPropostas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        escopo: z.enum(["todas", "minhas"]).default("todas"),
        status: z.string().optional(),
        q: z.string().optional(),
        pagina: z.number().int().min(1).default(1),
        porPagina: z.number().int().min(1).max(100).default(30),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ itens: PropostaListaItem[]; total: number }> => {
    const { supabase, userId } = context;
    let query = supabase
      .from("propostas")
      .select(
        "id, numero_proposta, nome_cliente, nome_banco, produto, valor_financiamento, status, created_at",
        { count: "exact" },
      );

    if (data.escopo === "minhas") {
      query = query.or(`usuario_responsavel_id.eq.${userId},usuario_criador_id.eq.${userId}`);
    }
    if (data.status) query = query.eq("status", data.status as any);
    if (data.q) {
      const q = data.q.trim();
      query = query.or(
        `numero_proposta.ilike.%${q}%,nome_cliente.ilike.%${q}%,cpf_cnpj.ilike.%${q.replace(/\D/g, "")}%`,
      );
    }

    const from = (data.pagina - 1) * data.porPagina;
    query = query.order("created_at", { ascending: false }).range(from, from + data.porPagina - 1);

    const { data: itens, count, error } = await query;
    if (error) throw new Error(error.message);
    return { itens: (itens ?? []) as PropostaListaItem[], total: count ?? 0 };
  });

/** ===== Detalhe ===== */
export const obterProposta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<PropostaCompleta> => {
    const { supabase } = context;
    const { data: proposta, error } = await supabase
      .from("propostas")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!proposta) throw new Error("Proposta não encontrada.");

    const [bancos, envolvidos, documentos, followups, historico] = await Promise.all([
      supabase.from("proposta_bancos").select("*").eq("proposta_id", data.id).order("created_at"),
      supabase
        .from("proposta_envolvidos")
        .select("*")
        .eq("proposta_id", data.id)
        .order("created_at"),
      supabase
        .from("proposta_documentos")
        .select("*")
        .eq("proposta_id", data.id)
        .order("created_at"),
      supabase
        .from("proposta_followups")
        .select("*")
        .eq("proposta_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("proposta_historico")
        .select("*")
        .eq("proposta_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    return {
      proposta,
      bancos: bancos.data ?? [],
      envolvidos: envolvidos.data ?? [],
      documentos: documentos.data ?? [],
      followups: followups.data ?? [],
      historico: historico.data ?? [],
    };
  });

/** ===== Simulações elegíveis para virar proposta ===== */
export const listarSimulacoesElegiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ q: z.string().optional() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let query = supabase
      .from("simulacoes")
      .select(
        "id, numero_simulacao, nome_cliente, cpf_cnpj, produto, valor_imovel, valor_financiamento, prazo, status, cliente_id, simulacao_bancos(id, banco_id, nome_banco, status_banco, homefin_id_simulacao_banco, valor_parcela, taxa_juros_ano)",
      )
      .in("status", ["simulada", "parcialmente_simulada"]);
    if (data.q) {
      const q = data.q.trim();
      query = query.or(`numero_simulacao.ilike.%${q}%,nome_cliente.ilike.%${q}%`);
    }
    query = query.order("created_at", { ascending: false }).limit(30);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    // apenas com ao menos um banco simulado; marca as que já têm proposta
    const ids = (rows ?? []).map((r: any) => r.id);
    const { data: jaProposta } = await supabase
      .from("propostas")
      .select("id, simulacao_id")
      .neq("status", "cancelada")
      .in("simulacao_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const propostaPorSim = new Map<string, string>(
      (jaProposta ?? []).map((p: any) => [p.simulacao_id, p.id]),
    );
    return (rows ?? [])
      .map((r: any) => ({
        ...r,
        proposta_existente_id: propostaPorSim.get(r.id) ?? null,
        simulacao_bancos: (r.simulacao_bancos ?? []).filter(
          (b: any) => b.status_banco === "simulada",
        ),
      }))
      .filter((r: any) => r.simulacao_bancos.length > 0);
  });

/** ===== Criar proposta ===== */
export const criarProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        simulacao_id: z.string().uuid().optional(),
        banco_id: z.string().uuid().optional(),
        cliente_id: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ proposta_id: string; numero_proposta: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);

    let snapshot: Record<string, unknown> = {
      correspondente_id: corr,
      status: "rascunho",
      cliente_id: data.cliente_id ?? null,
      banco_id: data.banco_id ?? null,
      usuario_criador_id: userId,
      usuario_responsavel_id: userId,
    };
    let bancosSimulados: any[] = [];

    if (data.simulacao_id) {
      const { data: sim, error } = await supabase
        .from("simulacoes")
        .select("*, simulacao_bancos(*)")
        .eq("id", data.simulacao_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!sim) throw new Error("Simulação não encontrada.");

      bancosSimulados = (sim.simulacao_bancos ?? []).filter(
        (b: any) => b.status_banco === "simulada",
      );
      const bancoEscolhido = data.banco_id
        ? bancosSimulados.find((b: any) => b.banco_id === data.banco_id)
        : bancosSimulados[0];

      snapshot = {
        ...snapshot,
        simulacao_id: sim.id,
        cliente_id: sim.cliente_id ?? data.cliente_id ?? null,
        banco_id: bancoEscolhido?.banco_id ?? data.banco_id ?? null,
        nome_banco: bancoEscolhido?.nome_banco ?? null,
        produto: sim.produto,
        cpf_cnpj: sim.cpf_cnpj,
        nome_cliente: sim.nome_cliente,
        email: sim.email,
        celular: sim.celular,
        data_nascimento: sim.data_nascimento,
        renda_total: sim.renda_total,
        estado_civil: sim.estado_civil,
        possui_conjuge: sim.possui_conjuge,
        compoe_renda: sim.compoe_renda,
        utiliza_fgts: sim.utiliza_fgts === "S",
        id_operacao_homefin: sim.id_operacao_homefin,
        tipo_imovel: sim.tipo_imovel,
        uso_imovel: sim.uso_imovel,
        situacao_imovel: sim.situacao_imovel,
        uf: sim.uf,
        cep_imovel: sim.cep_imovel,
        valor_imovel: sim.valor_imovel,
        valor_financiamento: sim.valor_financiamento,
        prazo: sim.prazo,
        sistema_amortizacao: sim.sistema_amortizacao,
        financia_despesas_cartorarias: sim.fg_financiar_despesas,
        homefin_id_oportunidade: sim.homefin_id_oportunidade,
        homefin_id_simulacao: bancoEscolhido?.homefin_id_simulacao_banco ?? null,
        codigo_oportunidade_homefin: sim.codigo_oportunidade_homefin,
        consentimento_lgpd: sim.consentimento_lgpd,
        consentimento_scr: sim.consentimento_scr,
        analista_id: sim.analista_id,
        comercial_id: sim.comercial_id,
      };
    }

    const { data: inserted, error: insErr } = await supabase
      .from("propostas")
      .insert(snapshot as any)
      .select("id, numero_proposta")
      .single();
    if (insErr) throw new Error(insErr.message);

    // vincula bancos
    if (bancosSimulados.length > 0) {
      const linhas = bancosSimulados.map((b: any) => ({
        proposta_id: inserted.id,
        banco_id: b.banco_id,
        homefin_id_banco: b.homefin_id_banco,
        codigo_banco: b.codigo_banco,
        nome_banco: b.nome_banco,
        simulacao_banco_id: b.id,
        homefin_id_simulacao_banco: b.homefin_id_simulacao_banco,
        selecionado: b.banco_id === snapshot.banco_id,
        status_banco: "aguardando",
        valor_parcela: b.valor_parcela,
        taxa_juros_ano: b.taxa_juros_ano,
        prazo_pagamento_max: b.prazo_pagamento_max,
        valor_financiamento_max: b.valor_financiamento_max,
        codigo_indexador: b.codigo_indexador,
        valor_iof: b.valor_iof,
        sistema_amortizacao_banco: b.sistema_amortizacao_banco,
      }));
      await supabase.from("proposta_bancos").insert(linhas);
    }

    await supabase.from("proposta_historico").insert({
      proposta_id: inserted.id,
      tipo_evento: "criada",
      descricao: "Proposta criada",
      status_novo: "rascunho",
      ator_id: userId,
    });

    return { proposta_id: inserted.id, numero_proposta: inserted.numero_proposta };
  });

/** ===== Atualizar dados (apenas rascunho/aguardando_documentos) ===== */
export const atualizarDadosProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), patch: z.record(z.string(), z.unknown()) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: prop } = await supabase
      .from("propostas")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (!prop) throw new Error("Proposta não encontrada.");
    if (!STATUS_EDITAVEIS.includes(prop.status as PropostaStatus)) {
      throw new Error("A proposta não pode ser editada neste status.");
    }
    const patch = { ...data.patch };
    delete (patch as any).id;
    delete (patch as any).status;
    delete (patch as any).correspondente_id;
    const { error } = await supabase
      .from("propostas")
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ===== Selecionar banco vencedor ===== */
export const selecionarBancoProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ proposta_id: z.string().uuid(), proposta_banco_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // Seleção múltipla: a mesma proposta pode ser enviada a vários bancos.
    // Bloqueia apenas propostas em estado terminal.
    const { data: prop } = await supabase
      .from("propostas")
      .select("status")
      .eq("id", data.proposta_id)
      .maybeSingle();
    if (!prop) throw new Error("Proposta não encontrada.");
    if (STATUS_TERMINAIS.includes(prop.status as PropostaStatus)) {
      throw new Error("Esta proposta não pode mais ser alterada no estado atual.");
    }

    const { data: banco } = await supabase
      .from("proposta_bancos")
      .select("*")
      .eq("id", data.proposta_banco_id)
      .maybeSingle();
    if (!banco) throw new Error("Banco não encontrado.");

    // Um banco já enviado não pode ser desmarcado.
    const novoSelecionado = !banco.selecionado;
    if (!novoSelecionado && banco.status_banco === "enviada") {
      throw new Error("Este banco já foi enviado e não pode ser removido.");
    }

    await supabase
      .from("proposta_bancos")
      .update({ selecionado: novoSelecionado })
      .eq("id", data.proposta_banco_id);

    // Mantém o "banco principal" da proposta apontando para um banco selecionado
    // (usado em telas de resumo/PDF). Prioriza um já enviado, senão qualquer selecionado.
    const { data: selecionados } = await supabase
      .from("proposta_bancos")
      .select("banco_id, nome_banco, homefin_id_simulacao_banco, status_banco")
      .eq("proposta_id", data.proposta_id)
      .eq("selecionado", true);
    const principal =
      (selecionados ?? []).find((b: any) => b.status_banco === "enviada") ??
      (selecionados ?? [])[0] ??
      null;
    await supabase
      .from("propostas")
      .update({
        banco_id: principal?.banco_id ?? null,
        nome_banco: principal?.nome_banco ?? null,
        homefin_id_simulacao: principal?.homefin_id_simulacao_banco ?? null,
      })
      .eq("id", data.proposta_id);
    return { ok: true, selecionado: novoSelecionado };
  });

export const SITUACOES_BANCO = [
  "nao_enviado",
  "em_analise",
  "condicionado",
  "aprovado",
  "recusado",
  "cancelado",
] as const;

/** Define a situação de crédito de um banco específico dentro da proposta. */
export const definirSituacaoBanco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        proposta_banco_id: z.string().uuid(),
        situacao_banco: z.enum(SITUACOES_BANCO),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("proposta_bancos")
      .update({ situacao_banco: data.situacao_banco })
      .eq("id", data.proposta_banco_id)
      .eq("proposta_id", data.proposta_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ===== Envolvidos (compradores/vendedores) ===== */
export const adicionarEnvolvido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ proposta_id: z.string().uuid(), dados: z.record(z.string(), z.unknown()) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await assertPropostaEditavel(supabase, data.proposta_id);
    const { data: row, error } = await supabase
      .from("proposta_envolvidos")
      .insert({ proposta_id: data.proposta_id, ...data.dados } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** ===== Documentos ===== */
export const registrarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        nome_documento: z.string().min(1),
        tipo_documento: z.string().optional(),
        parte: z.string().optional(),
        storage_path: z.string().min(1),
        mime_type: z.string().optional(),
        tamanho_bytes: z.number().optional(),
        obrigatorio: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);
    const { data: row, error } = await supabase
      .from("proposta_documentos")
      .insert({
        proposta_id: data.proposta_id,
        correspondente_id: corr,
        nome_documento: data.nome_documento,
        tipo_documento: data.tipo_documento ?? null,
        parte: data.parte ?? null,
        storage_path: data.storage_path,
        mime_type: data.mime_type ?? null,
        tamanho_bytes: data.tamanho_bytes ?? null,
        obrigatorio: data.obrigatorio ?? false,
        status: "enviado",
        enviado_em: new Date().toISOString(),
        enviado_por: userId,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const removerDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: doc } = await context.supabase
      .from("proposta_documentos")
      .select("storage_path, proposta_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Documento não encontrado.");
    await assertPropostaEditavel(context.supabase, doc.proposta_id);
    if (doc?.storage_path) {
      await context.supabase.storage.from("documentos-proposta").remove([doc.storage_path]);
    }
    const { error } = await context.supabase.from("proposta_documentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** URL assinada de curta duração (5 min) para um documento. */
export const urlDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storage_path: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("documentos-proposta")
      .createSignedUrl(data.storage_path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

/** Salva dados do IQ (interveniente quitante). */
export const salvarIq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        iq_nome: z.string().max(200).optional(),
        iq_comentario: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertPropostaEditavel(context.supabase, data.proposta_id);
    const { error } = await context.supabase
      .from("propostas")
      .update({ iq_nome: data.iq_nome ?? null, iq_comentario: data.iq_comentario ?? null } as any)
      .eq("id", data.proposta_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerEnvolvido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: env } = await context.supabase
      .from("proposta_envolvidos")
      .select("proposta_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!env) throw new Error("Registro não encontrado.");
    await assertPropostaEditavel(context.supabase, env.proposta_id);
    const { error } = await context.supabase.from("proposta_envolvidos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ===== Follow-ups ===== */
export const adicionarFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        tipo: z.enum(["interno", "externo"]),
        titulo: z.string().trim().max(200).optional(),
        comentario: z.string().trim().min(1).max(4000),
        data_previsao: z.string().optional(),
        responsavel_id: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("proposta_followups").insert({
      proposta_id: data.proposta_id,
      tipo: data.tipo,
      titulo: data.titulo ?? null,
      comentario: data.comentario,
      data_previsao: data.data_previsao ?? null,
      responsavel_id: data.responsavel_id ?? null,
      autor_id: userId,
    });
    if (error) throw new Error(error.message);

    if (data.tipo === "externo") {
      try {
        const { enviarFollowupHomefinImpl } = await import("./enviar.server");
        await enviarFollowupHomefinImpl({
          propostaId: data.proposta_id,
          titulo: data.titulo ?? "",
          comentario: data.comentario,
          supabase,
        });
      } catch {
        /* falha externa não bloqueia o registro interno */
      }
    }
    return { ok: true };
  });

/** ===== Máquina de estados ===== */
export const moverStatusProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        novo_status: z.string(),
        motivo: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prop } = await supabase
      .from("propostas")
      .select("status")
      .eq("id", data.proposta_id)
      .maybeSingle();
    if (!prop) throw new Error("Proposta não encontrada.");

    const de = prop.status as PropostaStatus;
    const para = data.novo_status as PropostaStatus;
    if (!transicaoPermitida(de, para)) {
      throw new Error(`Transição inválida: ${de} → ${para}.`);
    }
    const patch: Record<string, unknown> = { status: para };
    if (para === "contrato_emitido") patch.contrato_emitido_em = new Date().toISOString();
    const { error } = await supabase
      .from("propostas")
      .update(patch as any)
      .eq("id", data.proposta_id);
    if (error) throw new Error(error.message);

    await supabase.from("proposta_historico").insert({
      proposta_id: data.proposta_id,
      tipo_evento: "status",
      descricao: data.motivo ?? null,
      status_anterior: de,
      status_novo: para,
      ator_id: userId,
    });
    return { ok: true };
  });

/** ===== Cancelamento ===== */
export const cancelarProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        motivo: z.string().trim().min(5, "Informe um motivo com pelo menos 5 caracteres."),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prop } = await supabase
      .from("propostas")
      .select("status, enviada_em")
      .eq("id", data.proposta_id)
      .maybeSingle();
    if (!prop) throw new Error("Proposta não encontrada.");
    if (prop.status === "cancelada") throw new Error("Proposta já está cancelada.");

    const { error } = await supabase
      .from("propostas")
      .update({ status: "cancelada", motivo_cancelamento: data.motivo })
      .eq("id", data.proposta_id);
    if (error) throw new Error(error.message);

    await supabase.from("proposta_historico").insert({
      proposta_id: data.proposta_id,
      tipo_evento: "cancelada",
      descricao: data.motivo,
      status_anterior: prop.status,
      status_novo: "cancelada",
      ator_id: userId,
    });

    if (prop.enviada_em) {
      try {
        const { cancelarPropostaHomefinImpl } = await import("./enviar.server");
        await cancelarPropostaHomefinImpl({ propostaId: data.proposta_id, supabase });
      } catch {
        /* falha externa não bloqueia o cancelamento local */
      }
    }
    return { ok: true };
  });

/** ===== Enviar / reenviar ao banco ===== */
export const enviarPropostaHomeFin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ proposta_id: z.string().uuid(), banco_id: z.string().uuid().optional() })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const ip =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      getRequestHeader("cf-connecting-ip") ??
      null;
    const { enviarPropostaImpl } = await import("./enviar.server");
    return enviarPropostaImpl({
      propostaId: data.proposta_id,
      userId,
      ip,
      supabase,
      bancoId: data.banco_id,
    });
  });

export const reenviarHomeFin = enviarPropostaHomeFin;

/** ===== Sincronizar andamento (polling — a API não tem webhook) ===== */
export const sincronizarProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ proposta_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { sincronizarPropostaImpl } = await import("./enviar.server");
    return sincronizarPropostaImpl({ propostaId: data.proposta_id, userId, supabase });
  });

/** Exclui uma proposta (e registros dependentes via cascata). */
export const excluirProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: prop } = await context.supabase
      .from("propostas")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (!prop) throw new Error("Proposta não encontrada.");
    if (!["rascunho", "erro_envio"].includes(prop.status)) {
      throw new Error(
        "Só é possível excluir propostas em rascunho ou com erro de envio. Cancele a proposta.",
      );
    }
    const { error } = await context.supabase.from("propostas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

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
import { estadoCivilCrmParaCodigo, regimeCasamentoCrmParaCodigo } from "./dominios";

/** ===== Tipos de saída ===== */
export interface PropostaBancoResumo {
  nome_banco: string | null;
  status_banco: string | null;
}

export interface PropostaListaItem {
  id: string;
  numero_proposta: string;
  numero_proposta_banco: string | null;
  nome_cliente: string | null;
  cpf_cnpj: string | null;
  nome_banco: string | null;
  produto: string | null;
  valor_financiamento: number | null;
  status: string;
  detalhe_status_atual: string | null;
  status_atualizado_em: string | null;
  ultima_sincronizacao_em: string | null;
  created_at: string;
  responsavel_id: string | null;
  nome_responsavel: string | null;
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
        responsavel: z.string().uuid().optional(),
        q: z.string().optional(),
        data_inicio: z.string().optional(),
        data_fim: z.string().optional(),
        pagina: z.number().int().min(1).default(1),
        porPagina: z.number().int().min(1).max(500).default(30),
        apenas_excluidas: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ itens: PropostaListaItem[]; total: number }> => {
    const { supabase, userId } = context;
    let query = supabase
      .from("propostas")
      .select(
        "id, numero_proposta, numero_proposta_banco, nome_cliente, cpf_cnpj, nome_banco, produto, valor_financiamento, status, detalhe_status_atual, status_atualizado_em, ultima_sincronizacao_em, created_at, usuario_responsavel_id, usuario_criador_id, deleted_at, deleted_by, deleted_motivo",
        { count: "exact" },
      );

    if (data.apenas_excluidas) query = query.not("deleted_at", "is", null);
    else query = query.is("deleted_at", null);

    if (data.escopo === "minhas") {
      query = query.or(`usuario_responsavel_id.eq.${userId},usuario_criador_id.eq.${userId}`);
    }
    if (data.responsavel) {
      query = query.or(
        `usuario_responsavel_id.eq.${data.responsavel},usuario_criador_id.eq.${data.responsavel}`,
      );
    }
    if (data.status) query = query.eq("status", data.status as any);
    if (data.data_inicio) query = query.gte("created_at", data.data_inicio);
    if (data.data_fim) query = query.lte("created_at", data.data_fim);
    if (data.q) {
      const q = data.q.trim();
      query = query.or(
        `numero_proposta.ilike.%${q}%,numero_proposta_banco.ilike.%${q}%,nome_cliente.ilike.%${q}%,cpf_cnpj.ilike.%${q.replace(/\D/g, "")}%`,
      );
    }

    const from = (data.pagina - 1) * data.porPagina;
    query = query.order("created_at", { ascending: false }).range(from, from + data.porPagina - 1);

    const { data: itens, count, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (itens ?? []) as any[];
    const ids = rows.map((r) => r.id);
    const bancosPorProp = new Map<string, PropostaBancoResumo[]>();
    if (ids.length) {
      const { data: bancos } = await supabase
        .from("proposta_bancos")
        .select("proposta_id, nome_banco, status_banco")
        .in("proposta_id", ids)
        .order("nome_banco", { ascending: true });
      for (const b of bancos ?? []) {
        const lista = bancosPorProp.get((b as any).proposta_id) ?? [];
        lista.push({ nome_banco: (b as any).nome_banco, status_banco: (b as any).status_banco });
        bancosPorProp.set((b as any).proposta_id, lista);
      }
    }

    // Resolve nomes dos responsáveis (para exibir o "dono" no escopo Todas).
    const donoIds = Array.from(
      new Set(
        rows
          .map((r) => r.usuario_responsavel_id ?? r.usuario_criador_id)
          .filter((v): v is string => Boolean(v)),
      ),
    );
    const nomesDono = new Map<string, string>();
    if (donoIds.length) {
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", donoIds);
      for (const p of perfis ?? []) nomesDono.set((p as any).id, (p as any).nome ?? "");
    }

    const lista = rows.map((r) => {
      const responsavel_id = r.usuario_responsavel_id ?? r.usuario_criador_id ?? null;
      return {
        ...r,
        responsavel_id,
        nome_responsavel: responsavel_id ? (nomesDono.get(responsavel_id) ?? null) : null,
        bancos: bancosPorProp.get(r.id) ?? [],
      };
    });
    return { itens: lista as PropostaListaItem[], total: count ?? 0 };
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

    // Anexa o detalhamento (raw_response) da simulação de origem a cada banco,
    // permitindo gerar o extrato detalhado (parcelas, CET, CESH) na proposta.
    const bancosProp = (bancos.data ?? []) as any[];
    const simBancoIds = bancosProp
      .map((b) => b.simulacao_banco_id)
      .filter((v): v is string => Boolean(v));
    if (simBancoIds.length) {
      const { data: simBancos } = await supabase
        .from("simulacao_bancos")
        .select("id, raw_response")
        .in("id", simBancoIds);
      const rawPorId = new Map<string, any>(
        (simBancos ?? []).map((s: any) => [s.id, s.raw_response]),
      );
      for (const b of bancosProp) {
        if (b.simulacao_banco_id && b.raw_response == null) {
          b.raw_response = rawPorId.get(b.simulacao_banco_id) ?? null;
        }
      }
    }

    return {
      proposta,
      bancos: bancosProp,
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.cliente_id) {
      const { data: clienteValido, error: clienteErr } = await supabase
        .from("clientes")
        .select("id")
        .eq("id", data.cliente_id)
        .eq("correspondente_id", corr)
        .maybeSingle();
      if (clienteErr) throw new Error(clienteErr.message);
      if (!clienteValido) throw new Error("Cliente não encontrado para este correspondente.");
    }

    let snapshot: Record<string, unknown> = {
      correspondente_id: corr,
      status: "rascunho",
      cliente_id: data.cliente_id ?? null,
      banco_id: data.banco_id ?? null,
      usuario_criador_id: userId,
      usuario_responsavel_id: userId,
    };
    let bancosSimulados: any[] = [];
    let bancosParaVincular: any[] = [];

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

      if (data.banco_id && !bancoEscolhido) {
        throw new Error("Banco da simulação não encontrado ou ainda não simulado.");
      }
      if (!data.banco_id && bancosSimulados.length > 1) {
        throw new Error("Escolha um banco específico para enviar a aprovação.");
      }
      bancosParaVincular = bancoEscolhido ? [bancoEscolhido] : bancosSimulados;

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

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("propostas")
      .insert(snapshot as any)
      .select("id, numero_proposta")
      .single();
    if (insErr) throw new Error(insErr.message);

    // vincula bancos
    if (bancosParaVincular.length > 0) {
      const linhas = bancosParaVincular.map((b: any) => ({
        proposta_id: inserted.id,
        banco_id: b.banco_id,
        homefin_id_banco: b.homefin_id_banco,
        codigo_banco: b.codigo_banco,
        nome_banco: b.nome_banco,
        simulacao_banco_id: b.id,
        homefin_id_simulacao_banco: b.homefin_id_simulacao_banco,
        selecionado: true,
        status_banco: "aguardando",
        valor_parcela: b.valor_parcela,
        taxa_juros_ano: b.taxa_juros_ano,
        prazo_pagamento_max: b.prazo_pagamento_max,
        valor_financiamento_max: b.valor_financiamento_max,
        codigo_indexador: b.codigo_indexador,
        valor_iof: b.valor_iof,
        sistema_amortizacao_banco: b.sistema_amortizacao_banco,
      }));
      const { error: bancosErr } = await supabaseAdmin.from("proposta_bancos").insert(linhas);
      if (bancosErr) throw new Error(bancosErr.message);
    }

    // Preenche o participante titular a partir do cadastro completo do cliente,
    // trazendo os campos exigidos pelos bancos (documento, filiação, profissão, banco).
    const clienteId = snapshot.cliente_id as string | null;
    if (clienteId) {
      const { data: cli } = await supabase
          .from("clientes")
        .select("*")
        .eq("id", clienteId)
        .maybeSingle();
      if (cli) {
        const { data: end } = await supabase
          .from("cliente_enderecos")
          .select("*")
          .eq("cliente_id", clienteId)
          .limit(1)
          .maybeSingle();
        const c = cli as any;
        const e = (end ?? {}) as any;
        const { data: insTit, error: titularErr } = await supabaseAdmin.from("proposta_envolvidos").insert({
          proposta_id: inserted.id,
          cliente_id: clienteId,
          tipo_qualificacao: "CO",
          tipo_pessoa: c.tipo_pessoa === "PJ" ? "J" : "F",
          nome: c.nome,
          cpf_cnpj: c.documento,
          data_nascimento: c.data_nascimento,
          nome_mae: c.mae,
          tipo_sexo: c.sexo ? String(c.sexo).trim().charAt(0).toUpperCase() : c.sexo,
          estado_civil: estadoCivilCrmParaCodigo(c.estado_civil) || null,
          regime_casamento: regimeCasamentoCrmParaCodigo(c.regime_casamento) || null,
          tipo_documento_identidade: c.tipo_documento_identidade,
          numero_documento: c.numero_documento,
          data_expedicao: c.data_expedicao,
          orgao_expedidor: c.orgao_expedidor,
          uf_expedicao: c.uf_expedicao,
          profissao: c.profissao,
          empresa: c.empresa,
          renda: c.renda_total_declarada,
          agencia: c.agencia,
          conta_corrente: c.conta_corrente,
          digito_conta: c.digito_conta,
          email: c.email,
          celular: c.telefone_celular,
          cep: e.cep ?? null,
          logradouro: e.logradouro ?? null,
          numero_logradouro: e.numero ?? null,
          complemento: e.complemento ?? null,
          bairro: e.bairro ?? null,
          municipio: e.cidade ?? null,
          uf: e.uf ?? c.uf_interesse ?? null,
          utiliza_fgts: c.utiliza_fgts ?? false,
          fg_autorizacao_dados: c.fg_autorizacao_dados ?? false,
          dados: { pai: c.pai ?? null, nacionalidade: c.nacionalidade ?? null, naturalidade: c.naturalidade ?? null, banco_conta: c.banco_conta ?? null },
        } as any).select("id").maybeSingle();
        if (titularErr) throw new Error(titularErr.message);

        // Cônjuge/coproponente já cadastrado na ficha do cliente entra como
        // envolvido vinculado ao titular (conjuge_de), para o formulário já vir preenchido.
        const ehCasado = ["casado", "uniao_estavel"].includes(String(c.estado_civil ?? ""));
        if (insTit?.id && ehCasado && (c.conjuge_nome || c.conjuge_cpf)) {
          const { error: conjugeErr } = await supabaseAdmin.from("proposta_envolvidos").insert({
            proposta_id: inserted.id,
            conjuge_de: insTit.id,
            tipo_qualificacao: "TI",
            tipo_pessoa: "F",
            nome: c.conjuge_nome,
            cpf_cnpj: c.conjuge_cpf,
            data_nascimento: c.conjuge_data_nascimento,
            nome_mae: c.conjuge_nome_mae,
            tipo_sexo: c.conjuge_sexo ? String(c.conjuge_sexo).trim().charAt(0).toUpperCase() : c.conjuge_sexo,
            estado_civil: estadoCivilCrmParaCodigo(c.estado_civil) || null,
            regime_casamento: regimeCasamentoCrmParaCodigo(c.regime_casamento) || null,
            tipo_documento_identidade: c.conjuge_tipo_documento_identidade,
            numero_documento: c.conjuge_numero_documento,
            data_expedicao: c.conjuge_data_expedicao,
            orgao_expedidor: c.conjuge_orgao_expedidor,
            uf_expedicao: c.conjuge_uf_expedicao,
            profissao: c.conjuge_profissao,
            empresa: c.conjuge_empresa,
            renda: c.conjuge_renda,
            agencia: c.conjuge_agencia,
            conta_corrente: c.conjuge_conta_corrente,
            digito_conta: c.conjuge_digito_conta,
            email: c.conjuge_email,
            celular: c.conjuge_celular,
            cep: e.cep ?? null,
            logradouro: e.logradouro ?? null,
            numero_logradouro: e.numero ?? null,
            complemento: e.complemento ?? null,
            bairro: e.bairro ?? null,
            municipio: e.cidade ?? null,
            uf: e.uf ?? c.uf_interesse ?? null,
            dados: { nacionalidade: c.conjuge_nacionalidade ?? null, banco_conta: c.conjuge_banco_conta ?? null },
          } as any);
          if (conjugeErr) throw new Error(conjugeErr.message);
        }
      }

      // Vendedores do imóvel cadastrados no cliente entram como envolvidos (VD).
      const { data: vendedores } = await supabase
        .from("cliente_vendedores")
        .select("*")
        .eq("cliente_id", clienteId);
      if ((vendedores ?? []).length > 0) {
        const linhasVend = (vendedores ?? []).map((v: any) => ({
          proposta_id: inserted.id,
          cliente_id: null,
          tipo_qualificacao: "VD",
          tipo_pessoa: v.tipo_pessoa === "PJ" ? "J" : "F",
          nome: v.nome,
          cpf_cnpj: v.documento,
          data_nascimento: v.data_nascimento,
          nome_mae: v.mae,
          tipo_sexo: v.sexo ? String(v.sexo).trim().charAt(0).toUpperCase() : v.sexo,
          estado_civil: estadoCivilCrmParaCodigo(v.estado_civil) || null,
          regime_casamento: regimeCasamentoCrmParaCodigo(v.regime_casamento) || null,
          tipo_documento_identidade: v.tipo_documento_identidade,
          numero_documento: v.numero_documento,
          data_expedicao: v.data_expedicao,
          orgao_expedidor: v.orgao_expedidor,
          uf_expedicao: v.uf_expedicao,
          profissao: v.profissao,
          empresa: v.empresa,
          renda: v.renda_total_declarada,
          agencia: v.agencia,
          conta_corrente: v.conta_corrente,
          digito_conta: v.digito_conta,
          email: v.email,
          celular: v.telefone_celular,
          cep: v.cep,
          logradouro: v.logradouro,
          numero_logradouro: v.numero,
          complemento: v.complemento,
          bairro: v.bairro,
          municipio: v.cidade,
          uf: v.uf,
          utiliza_fgts: v.utiliza_fgts ?? false,
          fg_autorizacao_dados: v.fg_autorizacao_dados ?? false,
          dados: {
            pai: v.pai ?? null,
            nacionalidade: v.nacionalidade ?? null,
            naturalidade: v.naturalidade ?? null,
            banco_conta: v.banco_conta ?? null,
          },
        }));
        const { error: vendedoresErr } = await supabaseAdmin
          .from("proposta_envolvidos")
          .insert(linhasVend as any);
        if (vendedoresErr) throw new Error(vendedoresErr.message);
      }
    }



    const { error: histErr } = await supabaseAdmin.from("proposta_historico").insert({
      proposta_id: inserted.id,
      tipo_evento: "criada",
      descricao: "Proposta criada",
      status_novo: "rascunho",
      ator_id: userId,
    });
    if (histErr) throw new Error(histErr.message);

    return { proposta_id: inserted.id, numero_proposta: inserted.numero_proposta };
  });

/**
 * Dados do cônjuge já cadastrados na ficha do cliente (CRM), mapeados para o
 * formato do formulário de envolvido. Usado para pré-preencher o bloco do
 * cônjuge quando a proposta ainda não tem o coproponente cadastrado.
 */
export const obterConjugeCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<Record<string, string | number | null> | null> => {
    const { supabase } = context;
    const { data: cli } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", data.cliente_id)
      .maybeSingle();
    if (!cli) return null;
    const c = cli as any;
    const casado = ["casado", "uniao_estavel"].includes(String(c.estado_civil ?? ""));
    if (!casado || (!c.conjuge_nome && !c.conjuge_cpf)) return null;
    return {
      tipo_qualificacao: "TI",
      tipo_pessoa: "F",
      nome: c.conjuge_nome,
      cpf_cnpj: c.conjuge_cpf,
      data_nascimento: c.conjuge_data_nascimento,
      nome_mae: c.conjuge_nome_mae,
      tipo_sexo: c.conjuge_sexo ? String(c.conjuge_sexo).trim().charAt(0).toUpperCase() : c.conjuge_sexo,
      estado_civil: estadoCivilCrmParaCodigo(c.estado_civil) || null,
      regime_casamento: regimeCasamentoCrmParaCodigo(c.regime_casamento) || null,
      tipo_documento_identidade: c.conjuge_tipo_documento_identidade,
      numero_documento: c.conjuge_numero_documento,
      orgao_expedidor: c.conjuge_orgao_expedidor,
      uf_expedicao: c.conjuge_uf_expedicao,
      data_expedicao: c.conjuge_data_expedicao,
      profissao: c.conjuge_profissao,
      empresa: c.conjuge_empresa,
      renda: c.conjuge_renda,
      email: c.conjuge_email,
      celular: c.conjuge_celular,
    };
  });

/** ===== Bancos de uma proposta (para replicar) ===== */

export const listarBancosDaProposta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ proposta_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: prop } = await supabase
      .from("propostas")
      .select("id, numero_proposta, nome_cliente, produto, valor_financiamento")
      .eq("id", data.proposta_id)
      .maybeSingle();
    if (!prop) throw new Error("Proposta não encontrada.");
    const { data: bancos } = await supabase
      .from("proposta_bancos")
      .select("id, banco_id, nome_banco, valor_parcela, taxa_juros_ano, selecionado")
      .eq("proposta_id", data.proposta_id)
      .order("nome_banco");
    return { proposta: prop, bancos: bancos ?? [] };
  });

/** ===== Replicar uma proposta existente ===== */
export const replicarProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        banco_ids: z.array(z.string().uuid()).default([]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ proposta_id: string; numero_proposta: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);

    const { data: origem, error: origErr } = await supabase
      .from("propostas")
      .select("*")
      .eq("id", data.proposta_id)
      .maybeSingle();
    if (origErr) throw new Error(origErr.message);
    if (!origem) throw new Error("Proposta de origem não encontrada.");

    // Campos que não devem ser copiados (identidade / estado / vínculos externos).
    const naoCopiar = new Set([
      "id",
      "numero_proposta",
      "created_at",
      "updated_at",
      "status",
      "enviada_em",
      "motivo_cancelamento",
      "simulacao_id",
      "homefin_id_oportunidade",
      "homefin_id_simulacao",
      "codigo_oportunidade_homefin",
    ]);
    const snapshot: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(origem)) {
      if (!naoCopiar.has(k)) snapshot[k] = v;
    }
    snapshot.correspondente_id = corr;
    snapshot.status = "rascunho";
    snapshot.usuario_criador_id = userId;
    snapshot.usuario_responsavel_id = userId;

    // Bancos selecionados (default: todos os da origem). Calculado antes do
    // insert para garantir que o banco marcado exista entre os replicados.
    const { data: bancosOrigem } = await supabase
      .from("proposta_bancos")
      .select("*")
      .eq("proposta_id", data.proposta_id);
    const filtrados = (bancosOrigem ?? []).filter((b: any) =>
      data.banco_ids.length ? data.banco_ids.includes(b.banco_id) : true,
    );

    // Se o banco selecionado da origem não estiver entre os replicados,
    // adota o primeiro banco filtrado como selecionado.
    const bancoSelecionado =
      filtrados.find((b: any) => b.banco_id === snapshot.banco_id) ?? filtrados[0] ?? null;
    snapshot.banco_id = bancoSelecionado?.banco_id ?? null;
    snapshot.nome_banco = bancoSelecionado?.nome_banco ?? null;

    const { data: inserted, error: insErr } = await supabase
      .from("propostas")
      .insert(snapshot as any)
      .select("id, numero_proposta")
      .single();
    if (insErr) throw new Error(insErr.message);

    if (filtrados.length > 0) {
      const linhas = filtrados.map((b: any) => ({
        proposta_id: inserted.id,
        banco_id: b.banco_id,
        homefin_id_banco: b.homefin_id_banco,
        codigo_banco: b.codigo_banco,
        nome_banco: b.nome_banco,
        simulacao_banco_id: b.simulacao_banco_id,
        homefin_id_simulacao_banco: b.homefin_id_simulacao_banco,
        selecionado: bancoSelecionado != null && b.banco_id === bancoSelecionado.banco_id,
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

    // Envolvidos (sem ids externos/homefin).
    const { data: envolvidosOrigem } = await supabase
      .from("proposta_envolvidos")
      .select("*")
      .eq("proposta_id", data.proposta_id);
    if ((envolvidosOrigem ?? []).length > 0) {
      const naoCopiarEnv = new Set([
        "id",
        "proposta_id",
        "created_at",
        "updated_at",
        "homefin_id_participante",
      ]);
      const linhasEnv = (envolvidosOrigem ?? []).map((e: any) => {
        const linha: Record<string, unknown> = { proposta_id: inserted.id };
        for (const [k, v] of Object.entries(e)) {
          if (!naoCopiarEnv.has(k)) linha[k] = v;
        }
        return linha;
      });
      await supabase.from("proposta_envolvidos").insert(linhasEnv as any);
    }

    await supabase.from("proposta_historico").insert({
      proposta_id: inserted.id,
      tipo_evento: "criada",
      descricao: `Proposta replicada de ${origem.numero_proposta}`,
      status_novo: "rascunho",
      ator_id: userId,
    });

    try {
      const { registrarAuditoria } = await import("@/lib/admin/audit.server");
      await registrarAuditoria({
        supabase,
        userId,
        correspondenteId: corr,
        acao: "proposta.replicar",
        entidade: "propostas",
        entidadeId: inserted.id,
        payloadNovo: { origem_id: data.proposta_id, origem_numero: origem.numero_proposta },
      });
    } catch {
      /* auditoria best-effort */
    }

    return { proposta_id: inserted.id, numero_proposta: inserted.numero_proposta };
  });

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
    // Seleção única: marca apenas o banco principal desta proposta.
    // O envio é feito pelo botão da linha, não por múltipla seleção.
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

    await supabase
      .from("proposta_bancos")
      .update({ selecionado: false })
      .eq("proposta_id", data.proposta_id)
      .neq("id", data.proposta_banco_id);
    await supabase
      .from("proposta_bancos")
      .update({ selecionado: true })
      .eq("id", data.proposta_banco_id);

    // Mantém o "banco principal" da proposta apontando para um banco selecionado
    // (usado em telas de resumo/PDF). Prioriza um já enviado, senão qualquer selecionado.
    await supabase
      .from("propostas")
      .update({
        banco_id: banco.banco_id ?? null,
        nome_banco: banco.nome_banco ?? null,
        homefin_id_simulacao: banco.homefin_id_simulacao_banco ?? null,
      })
      .eq("id", data.proposta_id);
    return { ok: true, selecionado: true };
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

/**
 * Espelha os dados de um participante (envolvido) vinculado a um cliente de volta
 * para o cadastro do cliente, garantindo que proposta e CRM fiquem sincronizados.
 * Só escreve valores presentes, para nunca apagar dados já existentes no cliente.
 */
async function sincronizarEnvolvidoParaCliente(
  supabase: any,
  clienteId: string,
  dados: Record<string, unknown>,
) {
  const ESTADO_CIVIL_MAP: Record<string, string> = {
    S: "solteiro",
    CA: "casado",
    VI: "viuvo",
    DI: "divorciado",
    SL: "separado",
    UE: "uniao_estavel",
  };
  const REGIME_MAP: Record<string, string> = {
    CP: "comunhao_parcial",
    CU: "comunhao_universal",
    PA: "participacao_final",
    SC: "separacao_total",
    SO: "separacao_obrigatoria",
  };
  const has = (k: string) => dados[k] !== undefined && dados[k] !== null && dados[k] !== "";
  const patch: Record<string, unknown> = {};
  if (has("nome")) patch.nome = dados.nome;
  if (has("cpf_cnpj")) patch.documento = String(dados.cpf_cnpj).replace(/\D/g, "");
  if (has("data_nascimento")) patch.data_nascimento = dados.data_nascimento;
  if (has("nome_mae")) patch.mae = dados.nome_mae;
  if (has("tipo_sexo")) patch.sexo = dados.tipo_sexo;
  if (has("estado_civil")) patch.estado_civil = ESTADO_CIVIL_MAP[String(dados.estado_civil)] ?? undefined;
  if (has("regime_casamento")) patch.regime_casamento = REGIME_MAP[String(dados.regime_casamento)] ?? undefined;
  if (has("tipo_documento_identidade")) patch.tipo_documento_identidade = dados.tipo_documento_identidade;
  if (has("numero_documento")) patch.numero_documento = dados.numero_documento;
  if (has("orgao_expedidor")) patch.orgao_expedidor = dados.orgao_expedidor;
  if (has("uf_expedicao")) patch.uf_expedicao = dados.uf_expedicao;
  if (has("data_expedicao")) patch.data_expedicao = dados.data_expedicao;
  if (has("profissao")) patch.profissao = dados.profissao;
  if (has("empresa")) patch.empresa = dados.empresa;
  if (has("renda")) patch.renda_total_declarada = dados.renda;
  if (has("email")) patch.email = String(dados.email).toLowerCase();
  if (has("celular")) patch.telefone_celular = String(dados.celular).replace(/\D/g, "");
  if (dados.utiliza_fgts !== undefined) patch.utiliza_fgts = Boolean(dados.utiliza_fgts);
  if (dados.fg_autorizacao_dados !== undefined)
    patch.fg_autorizacao_dados = Boolean(dados.fg_autorizacao_dados);
  // Remove chaves que ficaram undefined após o mapeamento de enum.
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];
  if (Object.keys(patch).length > 0) {
    await supabase.from("clientes").update(patch as any).eq("id", clienteId);
  }

  // Endereço: grava no endereço principal do cliente.
  const enderecoPatch: Record<string, unknown> = {};
  if (has("cep")) enderecoPatch.cep = String(dados.cep).replace(/\D/g, "");
  if (has("logradouro")) enderecoPatch.logradouro = dados.logradouro;
  if (has("numero_logradouro")) enderecoPatch.numero = dados.numero_logradouro;
  if (has("complemento")) enderecoPatch.complemento = dados.complemento;
  if (has("bairro")) enderecoPatch.bairro = dados.bairro;
  if (has("municipio")) enderecoPatch.cidade = dados.municipio;
  if (has("uf")) enderecoPatch.uf = dados.uf;
  if (Object.keys(enderecoPatch).length > 0) {
    const { data: end } = await supabase
      .from("cliente_enderecos")
      .select("id")
      .eq("cliente_id", clienteId)
      .limit(1)
      .maybeSingle();
    if (end?.id) {
      await supabase.from("cliente_enderecos").update(enderecoPatch as any).eq("id", end.id);
    } else {
      await supabase
        .from("cliente_enderecos")
        .insert({ cliente_id: clienteId, principal: true, ...enderecoPatch } as any);
    }
  }
}

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
      .select("id, cliente_id")
      .single();
    if (error) throw new Error(error.message);
    if (row.cliente_id) {
      await sincronizarEnvolvidoParaCliente(supabase, row.cliente_id as string, data.dados);
    }
    return { id: row.id };
  });

/** Atualiza os dados complementares de um envolvido/participante. */
export const atualizarEnvolvido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ id: z.string().uuid(), dados: z.record(z.string(), z.unknown()) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: env } = await supabase
      .from("proposta_envolvidos")
      .select("proposta_id, cliente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!env) throw new Error("Registro não encontrado.");
    await assertPropostaEditavel(supabase, env.proposta_id);
    const { error } = await supabase
      .from("proposta_envolvidos")
      .update({ ...data.dados } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (env.cliente_id) {
      await sincronizarEnvolvidoParaCliente(supabase, env.cliente_id as string, data.dados);
    }
    return { ok: true };
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
    const deStatus = prop.status as PropostaStatus;
    if (deStatus === "cancelada") throw new Error("Proposta já está cancelada.");
    if (!transicaoPermitida(deStatus, "cancelada")) {
      throw new Error(
        `Uma proposta no status "${deStatus}" não pode ser cancelada.`,
      );
    }

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
      // Notifica o banco do cancelamento em background — o cancelamento local
      // já está persistido e não deve esperar a integração (que pode demorar).
      const notificarBanco = (async () => {
        try {
          const { cancelarPropostaHomefinImpl } = await import("./enviar.server");
          await cancelarPropostaHomefinImpl({ propostaId: data.proposta_id, supabase });
        } catch {
          /* falha externa não bloqueia o cancelamento local */
        }
      })();
      const waitUntil = (globalThis as any)?.ctx?.waitUntil ?? (globalThis as any)?.waitUntil;
      if (typeof waitUntil === "function") waitUntil(notificarBanco);
      else await notificarBanco;
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

/** ===== Enviar documentos do cadastro ao banco (upload + inclusão) ===== */
export const enviarDocumentosBanco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        documento_ids: z.array(z.string().uuid()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { enviarDocumentosBancoImpl } = await import("./enviar.server");
    return enviarDocumentosBancoImpl({
      propostaId: data.proposta_id,
      userId,
      supabase,
      documentoIds: data.documento_ids,
    });
  });



/** Exclui uma proposta (e registros dependentes via cascata). Registra um
 * snapshot completo na auditoria antes de apagar — nada se perde nos Logs. */
export const excluirProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        motivo: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    // Snapshot completo (proposta + registros dependentes) para os Logs.
    const [
      { data: prop },
      { data: bancos },
      { data: envolvidos },
      { data: documentos },
      { data: followups },
      { data: historico },
    ] = await Promise.all([
      supabase.from("propostas").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("proposta_bancos").select("*").eq("proposta_id", data.id),
      supabase.from("proposta_envolvidos").select("*").eq("proposta_id", data.id),
      supabase.from("proposta_documentos").select("*").eq("proposta_id", data.id),
      supabase.from("proposta_followups").select("*").eq("proposta_id", data.id),
      supabase.from("proposta_historico").select("*").eq("proposta_id", data.id),
    ]);
    if (!prop) throw new Error("Proposta não encontrada.");

    let correspondente: string | null = null;
    try {
      correspondente = await correspondenteId(supabase, userId);
    } catch {
      /* ignora — auditoria via RPC não depende do correspondente */
    }

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: correspondente,
      acao: "proposta.excluir",
      entidade: "propostas",
      entidadeId: data.id,
      payloadAnterior: {
        proposta: prop,
        bancos: bancos ?? [],
        envolvidos: envolvidos ?? [],
        documentos: documentos ?? [],
        followups: followups ?? [],
        historico: historico ?? [],
        motivo: data.motivo ?? null,
      },
      payloadNovo: null,
    });

    // Exclui e confirma que a linha realmente saiu. Com RLS, um DELETE pode
    // "passar" sem erro afetando 0 linhas — o que deixava a proposta viva no
    // painel/kanban mesmo após a mensagem de sucesso. Usamos .select() para
    // saber quantas linhas foram removidas.
    const { data: removidas, error } = await supabase
      .from("propostas")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw error;

    if (!removidas || removidas.length === 0) {
      // A política de RLS bloqueou o DELETE (usuário sem papel adequado ou
      // fora do escopo). Como já validamos que a proposta existe e pertence ao
      // correspondente do usuário, e a exclusão exige papel admin/correspondente,
      // reforçamos com o cliente administrativo do servidor.
      if (!correspondente || prop.correspondente_id !== correspondente) {
        throw new Error("Você não tem permissão para excluir esta proposta.");
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: errAdmin } = await supabaseAdmin
        .from("propostas")
        .delete()
        .eq("id", data.id)
        .eq("correspondente_id", correspondente);
      if (errAdmin) throw errAdmin;
    }

    // Se o cliente ficou sem simulações/propostas, recua a esteira para o
    // cadastro para não deixar um vínculo inexistente no painel/kanban.
    try {
      const { recuarEsteiraSeOrfao } = await import("@/lib/crm/clientes.functions");
      await recuarEsteiraSeOrfao(supabase, (prop as any).cliente_id);
    } catch {
      /* não bloqueia a exclusão */
    }
    return { ok: true };

  });

/** ===== Cadastrar cliente (CRM) a partir dos dados da proposta =====
 * Usado quando a simulação foi feita "direta" (sem cliente no CRM) e enviada à
 * aprovação: cria o cadastro do cliente com os dados já preenchidos na proposta
 * e vincula a proposta (e a simulação de origem) ao novo cliente. */
export const cadastrarClienteDaProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ proposta_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ cliente_id: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);

    const { data: prop, error } = await supabase
      .from("propostas")
      .select(
        "id, cliente_id, simulacao_id, nome_cliente, cpf_cnpj, email, celular, data_nascimento, estado_civil, renda_total, uf, utiliza_fgts",
      )
      .eq("id", data.proposta_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prop) throw new Error("Proposta não encontrada.");
    if (prop.cliente_id) return { cliente_id: prop.cliente_id as string };
    if (!prop.nome_cliente || !prop.cpf_cnpj) {
      throw new Error("Faltam nome e documento na proposta para criar o cadastro.");
    }

    // Mapeia o código de estado civil (swagger) de volta para o valor do CRM.
    const CODIGO_PARA_CRM: Record<string, string> = {
      S: "solteiro",
      CA: "casado",
      UE: "uniao_estavel",
      DI: "divorciado",
      VI: "viuvo",
      SL: "solteiro",
    };
    const civilRaw = (prop.estado_civil ?? "").toString();
    const estadoCivil =
      CODIGO_PARA_CRM[civilRaw] ??
      (["solteiro", "casado", "uniao_estavel", "divorciado", "viuvo"].includes(civilRaw)
        ? civilRaw
        : "solteiro");

    const documento = String(prop.cpf_cnpj).replace(/\D/g, "");
    const tipoPessoa = documento.length > 11 ? "PJ" : "PF";

    const { data: novo, error: insErr } = await supabase
      .from("clientes")
      .insert({
        correspondente_id: corr,
        numero_cliente: "",
        tipo_pessoa: tipoPessoa,
        nome: prop.nome_cliente,
        documento,
        data_nascimento: prop.data_nascimento || null,
        estado_civil: estadoCivil,
        email: (prop.email ?? "").toString().toLowerCase() || null,
        telefone_celular: prop.celular ?? null,
        renda_total_declarada: prop.renda_total ?? null,
        uf_interesse: prop.uf ?? null,
        utiliza_fgts: Boolean(prop.utiliza_fgts),
        origem: "direto",
        responsavel_id: userId,
        criador_id: userId,
      } as any)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Vincula a proposta e a simulação de origem ao novo cadastro.
    await supabase.from("propostas").update({ cliente_id: novo.id }).eq("id", prop.id);
    if (prop.simulacao_id) {
      await supabase
        .from("simulacoes")
        .update({ cliente_id: novo.id })
        .eq("id", prop.simulacao_id);
    }

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corr,
      acao: "cliente.criar",
      entidade: "clientes",
      entidadeId: novo.id,
      payloadNovo: { nome: prop.nome_cliente, origem: "proposta_direta" },
    });

    return { cliente_id: novo.id };
  });

/**
 * Retorna os dados da proposta mapeados para pré-preencher o formulário de
 * cadastro do CRM. Usado quando a simulação foi feita direta (sem cliente).
 */
export const getPrefillCadastroProposta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ proposta_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: prop, error } = await supabase
      .from("propostas")
      .select(
        "id, cliente_id, nome_cliente, cpf_cnpj, email, celular, data_nascimento, estado_civil, renda_total, uf, utiliza_fgts",
      )
      .eq("id", data.proposta_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prop) throw new Error("Proposta não encontrada.");

    const CODIGO_PARA_CRM: Record<string, string> = {
      S: "solteiro",
      CA: "casado",
      UE: "uniao_estavel",
      DI: "divorciado",
      VI: "viuvo",
      SL: "solteiro",
    };
    const civilRaw = (prop.estado_civil ?? "").toString();
    const estadoCivil =
      CODIGO_PARA_CRM[civilRaw] ??
      (["solteiro", "casado", "uniao_estavel", "divorciado", "viuvo"].includes(civilRaw)
        ? civilRaw
        : "solteiro");
    const documento = String(prop.cpf_cnpj ?? "").replace(/\D/g, "");
    const tipoPessoa = documento.length > 11 ? "PJ" : "PF";

    return {
      ja_vinculado: Boolean(prop.cliente_id),
      cliente_id: (prop.cliente_id as string) ?? null,
      valores: {
        tipo_pessoa: tipoPessoa,
        nome: prop.nome_cliente ?? "",
        documento,
        data_nascimento: prop.data_nascimento ?? "",
        estado_civil: estadoCivil,
        email: (prop.email ?? "").toString().toLowerCase(),
        telefone_celular: prop.celular ?? "",
        renda_total_declarada: prop.renda_total != null ? String(prop.renda_total) : "",
        uf_interesse: prop.uf ?? "",
        utiliza_fgts: Boolean(prop.utiliza_fgts),
        origem: "direto",
      },
    };
  });

/**
 * Vincula um cliente já cadastrado a uma proposta (e à simulação de origem),
 * usado após criar o cadastro pela tela do CRM a partir de uma proposta direta.
 */
export const vincularClienteAProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ proposta_id: z.string().uuid(), cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { data: prop, error } = await supabase
      .from("propostas")
      .select("id, simulacao_id")
      .eq("id", data.proposta_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prop) throw new Error("Proposta não encontrada.");

    const { data: cli, error: cliErr } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", data.cliente_id)
      .maybeSingle();
    if (cliErr) throw new Error(cliErr.message);
    if (!cli) throw new Error("Cliente não encontrado.");

    const { data: end } = await supabase
      .from("cliente_enderecos")
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .limit(1)
      .maybeSingle();

    await supabase.from("propostas").update({ cliente_id: data.cliente_id }).eq("id", prop.id);
    if (prop.simulacao_id) {
      await supabase
        .from("simulacoes")
        .update({ cliente_id: data.cliente_id })
        .eq("id", prop.simulacao_id);
    }

    const c = cli as any;
    const e = (end ?? {}) as any;
    const titular = {
      proposta_id: prop.id,
      cliente_id: data.cliente_id,
      tipo_qualificacao: "CO",
      tipo_pessoa: c.tipo_pessoa === "PJ" ? "J" : "F",
      nome: c.nome,
      cpf_cnpj: c.documento,
      data_nascimento: c.data_nascimento,
      nome_mae: c.mae,
      tipo_sexo: c.sexo ? String(c.sexo).trim().charAt(0).toUpperCase() : c.sexo,
      estado_civil: estadoCivilCrmParaCodigo(c.estado_civil) || null,
      regime_casamento: regimeCasamentoCrmParaCodigo(c.regime_casamento) || null,
      tipo_documento_identidade: c.tipo_documento_identidade,
      numero_documento: c.numero_documento,
      data_expedicao: c.data_expedicao,
      orgao_expedidor: c.orgao_expedidor,
      uf_expedicao: c.uf_expedicao,
      profissao: c.profissao,
      empresa: c.empresa,
      renda: c.renda_total_declarada,
      agencia: c.agencia,
      conta_corrente: c.conta_corrente,
      digito_conta: c.digito_conta,
      email: c.email,
      celular: c.telefone_celular,
      cep: e.cep ?? null,
      logradouro: e.logradouro ?? null,
      numero_logradouro: e.numero ?? null,
      complemento: e.complemento ?? null,
      bairro: e.bairro ?? null,
      municipio: e.cidade ?? null,
      uf: e.uf ?? c.uf_interesse ?? null,
      utiliza_fgts: c.utiliza_fgts ?? false,
      fg_autorizacao_dados: c.fg_autorizacao_dados ?? false,
      dados: {
        pai: c.pai ?? null,
        nacionalidade: c.nacionalidade ?? null,
        naturalidade: c.naturalidade ?? null,
        banco_conta: c.banco_conta ?? null,
      },
    };

    const { data: envExistente } = await supabase
      .from("proposta_envolvidos")
      .select("id")
      .eq("proposta_id", prop.id)
      .eq("tipo_qualificacao", "CO")
      .limit(1)
      .maybeSingle();
    let titularId = (envExistente as any)?.id as string | undefined;
    if (titularId) {
      const { error: updErr } = await supabase
        .from("proposta_envolvidos")
        .update(titular as any)
        .eq("id", titularId);
      if (updErr) throw new Error(updErr.message);
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("proposta_envolvidos")
        .insert(titular as any)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      titularId = (ins as any).id;
    }

    const ehCasado = ["casado", "uniao_estavel"].includes(String(c.estado_civil ?? ""));
    if (titularId && ehCasado && (c.conjuge_nome || c.conjuge_cpf)) {
      const conjuge = {
        proposta_id: prop.id,
        conjuge_de: titularId,
        tipo_qualificacao: "TI",
        tipo_pessoa: "F",
        nome: c.conjuge_nome,
        cpf_cnpj: c.conjuge_cpf,
        data_nascimento: c.conjuge_data_nascimento,
        nome_mae: c.conjuge_nome_mae,
        tipo_sexo: c.conjuge_sexo ? String(c.conjuge_sexo).trim().charAt(0).toUpperCase() : c.conjuge_sexo,
        estado_civil: estadoCivilCrmParaCodigo(c.estado_civil) || null,
        regime_casamento: regimeCasamentoCrmParaCodigo(c.regime_casamento) || null,
        tipo_documento_identidade: c.conjuge_tipo_documento_identidade,
        numero_documento: c.conjuge_numero_documento,
        data_expedicao: c.conjuge_data_expedicao,
        orgao_expedidor: c.conjuge_orgao_expedidor,
        uf_expedicao: c.conjuge_uf_expedicao,
        profissao: c.conjuge_profissao,
        empresa: c.conjuge_empresa,
        renda: c.conjuge_renda,
        agencia: c.conjuge_agencia,
        conta_corrente: c.conjuge_conta_corrente,
        digito_conta: c.conjuge_digito_conta,
        email: c.conjuge_email,
        celular: c.conjuge_celular,
        cep: e.cep ?? null,
        logradouro: e.logradouro ?? null,
        numero_logradouro: e.numero ?? null,
        complemento: e.complemento ?? null,
        bairro: e.bairro ?? null,
        municipio: e.cidade ?? null,
        uf: e.uf ?? c.uf_interesse ?? null,
        utiliza_fgts: false,
        fg_autorizacao_dados: c.fg_autorizacao_dados ?? false,
        dados: { nacionalidade: c.conjuge_nacionalidade ?? null, banco_conta: c.conjuge_banco_conta ?? null },
      };
      const { data: conjExistente } = await supabase
        .from("proposta_envolvidos")
        .select("id")
        .eq("proposta_id", prop.id)
        .eq("conjuge_de", titularId)
        .limit(1)
        .maybeSingle();
      if ((conjExistente as any)?.id) {
        const { error: conjUpdErr } = await supabase
          .from("proposta_envolvidos")
          .update(conjuge as any)
          .eq("id", (conjExistente as any).id);
        if (conjUpdErr) throw new Error(conjUpdErr.message);
      } else {
        const { error: conjInsErr } = await supabase
          .from("proposta_envolvidos")
          .insert(conjuge as any);
        if (conjInsErr) throw new Error(conjInsErr.message);
      }
    }
    return { ok: true };
  });


/** ===== Participantes da oportunidade (provedor bancário) ===== */
const participanteSchema = z.object({
  proposta_id: z.string().uuid(),
  nomeParticipante: z.string().trim().min(2).max(120),
  cpfCnpj: z.string().trim().min(11).max(20),
  tipoQualificacao: z.string().trim().max(4).optional(),
  tipoPessoa: z.enum(["F", "J"]).optional(),
  dataNascimento: z.string().optional(),
  nomeMae: z.string().trim().max(120).optional(),
  tipoSexo: z.enum(["M", "F"]).optional(),
  tipoEstadoCivil: z.string().trim().max(4).optional(),
  tipoRegimeCasamento: z.string().trim().max(4).optional(),
  tipoDocumentoIdentidade: z.enum(["RG", "CNH"]).optional(),
  numeroDocumento: z.string().trim().max(30).optional(),
  dataExpedicao: z.string().optional(),
  orgaoExpedidor: z.string().trim().max(20).optional(),
  ufExpedicao: z.string().trim().max(2).optional(),
  nomeProfissao: z.string().trim().max(120).optional(),
  nomeEmpresaProfissao: z.string().trim().max(120).optional(),
  renda: z.number().nonnegative().optional(),
  email: z.string().email().optional(),
  celular: z.string().trim().max(20).optional(),
  cep: z.string().trim().max(9).optional(),
  logradouro: z.string().trim().max(200).optional(),
  numeroLogradouro: z.string().trim().max(20).optional(),
  complementoLogradouro: z.string().trim().max(80).optional(),
  bairro: z.string().trim().max(80).optional(),
  municipio: z.string().trim().max(80).optional(),
  uf: z.string().trim().max(2).optional(),
  utilizaFgts: z.enum(["S", "N"]).optional(),
});

export const adicionarParticipanteProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => participanteSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { adicionarParticipanteImpl } = await import("./enviar.server");
    const { proposta_id, ...participante } = data;
    return await adicionarParticipanteImpl({
      propostaId: proposta_id,
      participante,
      supabase,
    });
  });

export const removerParticipanteProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        idParticipante: z.number().int().positive(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { removerParticipanteImpl } = await import("./enviar.server");
    await removerParticipanteImpl({
      propostaId: data.proposta_id,
      idParticipante: data.idParticipante,
      supabase,
    });
    return { ok: true };
  });

/** Listagem de usuários parceiros do provedor bancário (admin/gestor). */
export const listarUsuariosParceiros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin" as any,
    });
    const { data: isGestor } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "gestor" as any,
    });
    if (!isAdmin && !isGestor) {
      throw new Error("Acesso restrito.");
    }
    const { listarUsuariosParceirosImpl } = await import("./enviar.server");
    return await listarUsuariosParceirosImpl();
  });

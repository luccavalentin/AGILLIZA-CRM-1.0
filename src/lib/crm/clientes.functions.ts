import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { mascararDocumento } from "@/lib/crm/documento";

type TipoPessoa = Database["public"]["Enums"]["tipo_pessoa"];
type EstadoCivil = Database["public"]["Enums"]["cliente_estado_civil"];

async function temPii(supabase: any, userId: string): Promise<boolean> {
  const { data: tudo } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  if (tudo) return true;
  return Boolean(
    await supabase
      .rpc("usuario_tem_permissao", {
        _user_id: userId,
        _modulo: "crm.clientes",
        _acao: "pii:view",
      })
      .then((r: any) => r.data),
  );
}

/** Verifica papel amplo (admin/correspondente) ou permissão específica do módulo. */
async function podeAcao(
  supabase: any,
  userId: string,
  modulo: string,
  acao: string,
): Promise<boolean> {
  const { data: tudo } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  if (tudo) return true;
  return Boolean(
    await supabase
      .rpc("usuario_tem_permissao", { _user_id: userId, _modulo: modulo, _acao: acao })
      .then((r: any) => r.data),
  );
}

export interface ClienteListaItem {
  id: string;
  numero_cliente: string;
  nome: string;
  documento: string;
  documento_masc: boolean;
  telefone_celular: string | null;
  email: string | null;
  etapa_codigo: string | null;
  etapa_nome: string | null;
  ultima_atualizacao: string | null;
  responsavel_nome: string | null;
  ativo: boolean;
  portal_acesso_ativo: boolean;
}

const listarSchema = z.object({
  q: z.string().optional(),
  etapa: z.string().optional(),
  responsavel: z.string().optional(),
  portal: z.enum(["ativo", "inativo"]).optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
  escopo: z.enum(["minhas", "geral"]).optional(),
  pagina: z.number().int().min(1).default(1),
  porPagina: z.number().int().min(1).max(100).default(20),
});

/** Lista paginada de clientes (RLS aplica escopo). */
export const listarClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listarSchema.parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ itens: ClienteListaItem[]; total: number; podePii: boolean }> => {
      const { supabase, userId } = context;
      const podePii = await temPii(supabase, userId);
      const from = (data.pagina - 1) * data.porPagina;
      const to = from + data.porPagina - 1;

      let query = supabase
        .from("clientes")
        .select(
          data.etapa
            ? "id, numero_cliente, nome, documento, telefone_celular, email, ativo, portal_acesso_ativo, responsavel:profiles!clientes_responsavel_id_fkey(nome), cliente_pipeline!inner(ultima_atualizacao_em, pipeline_stages!inner(codigo, nome))"
            : "id, numero_cliente, nome, documento, telefone_celular, email, ativo, portal_acesso_ativo, responsavel:profiles!clientes_responsavel_id_fkey(nome), cliente_pipeline(ultima_atualizacao_em, pipeline_stages(codigo, nome))",
          { count: "exact" },
        )
        .order("created_at", { ascending: false });

      // Filtro de etapa aplicado na própria query (antes da paginação),
      // para que a contagem e a paginação fiquem corretas.
      if (data.etapa) {
        query = query.eq("cliente_pipeline.pipeline_stages.codigo", data.etapa);
      }

      if (data.escopo === "minhas") {
        // "Minhas" inclui clientes onde eu sou responsável/criador OU vinculado
        // como parceiro (imobiliária, corretor, comercial) via cliente_parceiros.
        const { data: vinc } = await supabase
          .from("cliente_parceiros")
          .select("cliente_id")
          .eq("parceiro_id", userId);
        const ids = Array.from(new Set((vinc ?? []).map((v: any) => v.cliente_id).filter(Boolean)));
        const partes = [`responsavel_id.eq.${userId}`, `criador_id.eq.${userId}`];
        if (ids.length) partes.push(`id.in.(${ids.join(",")})`);
        query = query.or(partes.join(","));
      }
      if (data.responsavel) {
        query = query.eq("responsavel_id", data.responsavel);
      }
      if (data.portal) {
        query = query.eq("portal_acesso_ativo", data.portal === "ativo");
      }
      if (data.status) {
        query = query.eq("ativo", data.status === "ativo");
      }

      query = query.range(from, to);

      if (data.q && data.q.trim()) {
        const term = data.q.trim();
        const dig = term.replace(/\D/g, "");
        const ors = [`nome.ilike.%${term}%`, `email.ilike.%${term}%`];
        if (dig) ors.push(`documento.ilike.%${dig}%`);
        query = query.or(ors.join(","));
      }

      const { data: rows, count, error } = await query;
      if (error) throw error;

      let itens = (rows ?? []).map(
        (r: any): ClienteListaItem => ({
          id: r.id,
          numero_cliente: r.numero_cliente,
          nome: r.nome,
          documento: podePii ? r.documento : mascararDocumento(r.documento ?? ""),
          documento_masc: !podePii,
          telefone_celular: r.telefone_celular,
          email: r.email,
          etapa_codigo: r.cliente_pipeline?.pipeline_stages?.codigo ?? null,
          etapa_nome: r.cliente_pipeline?.pipeline_stages?.nome ?? null,
          ultima_atualizacao: r.cliente_pipeline?.ultima_atualizacao_em ?? null,
          responsavel_nome: r.responsavel?.nome ?? null,
          ativo: r.ativo,
          portal_acesso_ativo: r.portal_acesso_ativo,
        }),
      );

      

      return { itens, total: count ?? itens.length, podePii };
    },
  );

/** Estatísticas rápidas de clientes para KPIs (respeita RLS). */
export const estatisticasClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ escopo: z.enum(["minhas", "geral"]).optional() }).parse(d ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      total: number;
      portal_ativo: number;
      em_andamento: number;
      cadastro_completo: number;
    }> => {
      const { supabase, userId } = context;
      let orMinhas: string | null = null;
      if (data?.escopo === "minhas") {
        const { data: vinc } = await supabase
          .from("cliente_parceiros")
          .select("cliente_id")
          .eq("parceiro_id", userId);
        const ids = Array.from(new Set((vinc ?? []).map((v: any) => v.cliente_id).filter(Boolean)));
        const partes = [`responsavel_id.eq.${userId}`, `criador_id.eq.${userId}`];
        if (ids.length) partes.push(`id.in.(${ids.join(",")})`);
        orMinhas = partes.join(",");
      }
      let q = supabase
        .from("clientes")
        .select(
          "id, portal_acesso_ativo, cliente_pipeline(pipeline_stages(codigo, ordem))",
          { count: "exact" },
        )
        .eq("ativo", true);
      if (orMinhas) q = q.or(orMinhas);
      const { data: rows, count } = await q;
      const list = (rows ?? []) as any[];
      const portal_ativo = list.filter((r) => r.portal_acesso_ativo).length;
      const em_andamento = list.filter((r) => {
        const cod = r.cliente_pipeline?.pipeline_stages?.codigo;
        return cod && cod !== "cadastro_basico" && cod !== "contrato_emitido";
      }).length;
      const cadastro_completo = list.filter((r) => {
        const ord = r.cliente_pipeline?.pipeline_stages?.ordem ?? 0;
        return ord >= 4;
      }).length;
      return {
        total: count ?? list.length,
        portal_ativo,
        em_andamento,
        cadastro_completo,
      };
    },
  );

/** Lista etapas do pipeline para filtros (ordenadas). */
export const listarEtapasPipeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ codigo: string; nome: string }[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("pipeline_stages")
      .select("codigo, nome, ordem")
      .order("ordem");
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ codigo: r.codigo, nome: r.nome }));
  });



const clienteInputSchema = z.object({
  tipo_pessoa: z.enum(["PF", "PJ"]),
  nome: z.string().min(2, "Informe o nome completo."),
  documento: z.string().min(11, "Documento inválido."),
  documento_secundario: z.string().optional().nullable(),
  data_nascimento: z.string().min(1, "Informe a data."),
  estado_civil: z.enum(["solteiro", "casado", "uniao_estavel", "divorciado", "viuvo"]),
  regime_casamento: z
    .enum([
      "comunhao_parcial",
      "comunhao_universal",
      "separacao_total",
      "participacao_final",
      "nao_aplicavel",
    ])
    .optional()
    .nullable(),
  mae: z.string().optional().nullable(),
  pai: z.string().optional().nullable(),
  sexo: z.string().optional().nullable(),
  nacionalidade: z.string().optional().nullable(),
  naturalidade: z.string().optional().nullable(),
  tipo_documento_identidade: z.string().optional().nullable(),
  numero_documento: z.string().optional().nullable(),
  orgao_expedidor: z.string().optional().nullable(),
  uf_expedicao: z.string().optional().nullable(),
  data_expedicao: z.string().optional().nullable(),
  profissao: z.string().optional().nullable(),
  empresa: z.string().optional().nullable(),
  banco_conta: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta_corrente: z.string().optional().nullable(),
  digito_conta: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido."),
  telefone_celular: z.string().min(10, "Celular inválido."),
  renda_total_declarada: z.number().nonnegative(),
  uf_interesse: z.string().length(2).optional().nullable(),
  utiliza_fgts: z.boolean().optional().default(false),
  fg_autorizacao_dados: z.boolean().optional().default(false),
  origem: z.enum(["direto", "parceiro", "indicacao", "importacao"]).default("direto"),
  // Dados do cônjuge (exigidos pela API quando o estado civil é casado/união estável).
  conjuge_nome: z.string().optional().nullable(),
  conjuge_cpf: z.string().optional().nullable(),
  conjuge_data_nascimento: z.string().optional().nullable(),
  conjuge_nome_mae: z.string().optional().nullable(),
  conjuge_sexo: z.string().optional().nullable(),
  conjuge_nacionalidade: z.string().optional().nullable(),
  conjuge_tipo_documento_identidade: z.string().optional().nullable(),
  conjuge_numero_documento: z.string().optional().nullable(),
  conjuge_orgao_expedidor: z.string().optional().nullable(),
  conjuge_uf_expedicao: z.string().optional().nullable(),
  conjuge_data_expedicao: z.string().optional().nullable(),
  conjuge_profissao: z.string().optional().nullable(),
  conjuge_empresa: z.string().optional().nullable(),
  conjuge_renda: z.number().nonnegative().optional().nullable(),
  conjuge_email: z.string().optional().nullable(),
  conjuge_celular: z.string().optional().nullable(),
  // Dados bancários do cônjuge (opcionais).
  conjuge_banco_conta: z.string().optional().nullable(),
  conjuge_agencia: z.string().optional().nullable(),
  conjuge_conta_corrente: z.string().optional().nullable(),
  conjuge_digito_conta: z.string().optional().nullable(),
});


export type ClienteInput = z.infer<typeof clienteInputSchema>;

/** Cria cliente no ecossistema do usuário; entra automaticamente em cadastro_basico via trigger. */
export const criarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clienteInputSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.correspondente_id) throw new Error("Ecossistema não encontrado.");

    // Valida a permissão de criação do usuário (mesma regra usada pelo RLS) e
    // grava via cliente administrativo, evitando conflitos de política durante
    // o insert/update. O escopo já está validado pelo correspondente acima.
    const { data: podeCriar } = await supabase.rpc("usuario_tem_permissao", {
      _user_id: userId,
      _modulo: "crm.clientes",
      _acao: "create",
    });
    if (!podeCriar) throw new Error("Você não tem permissão para cadastrar clientes.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


    // Campos comuns entre criação e atualização.
    const campos = {
      tipo_pessoa: data.tipo_pessoa,
      nome: data.nome,
      documento: data.documento,
      documento_secundario: data.documento_secundario ?? null,
      data_nascimento: data.data_nascimento,
      estado_civil: data.estado_civil,
      regime_casamento: data.regime_casamento ?? null,
      mae: data.mae ?? null,
      pai: data.pai ?? null,
      sexo: data.sexo ?? null,
      nacionalidade: data.nacionalidade ?? null,
      naturalidade: data.naturalidade ?? null,
      tipo_documento_identidade: data.tipo_documento_identidade ?? null,
      numero_documento: data.numero_documento ?? null,
      orgao_expedidor: data.orgao_expedidor ?? null,
      uf_expedicao: data.uf_expedicao ?? null,
      data_expedicao: data.data_expedicao || null,
      profissao: data.profissao ?? null,
      empresa: data.empresa ?? null,
      banco_conta: data.banco_conta ?? null,
      agencia: data.agencia ?? null,
      conta_corrente: data.conta_corrente ?? null,
      digito_conta: data.digito_conta ?? null,
      email: data.email.toLowerCase(),
      telefone_celular: data.telefone_celular,
      renda_total_declarada: data.renda_total_declarada,
      uf_interesse: data.uf_interesse ?? null,
      utiliza_fgts: data.utiliza_fgts ?? false,
      fg_autorizacao_dados: data.fg_autorizacao_dados ?? false,
      origem: data.origem,
      conjuge_nome: data.conjuge_nome ?? null,
      conjuge_cpf: data.conjuge_cpf ?? null,
      conjuge_data_nascimento: data.conjuge_data_nascimento || null,
      conjuge_nome_mae: data.conjuge_nome_mae ?? null,
      conjuge_sexo: data.conjuge_sexo ?? null,
      conjuge_nacionalidade: data.conjuge_nacionalidade ?? null,
      conjuge_tipo_documento_identidade: data.conjuge_tipo_documento_identidade ?? null,
      conjuge_numero_documento: data.conjuge_numero_documento ?? null,
      conjuge_orgao_expedidor: data.conjuge_orgao_expedidor ?? null,
      conjuge_uf_expedicao: data.conjuge_uf_expedicao ?? null,
      conjuge_data_expedicao: data.conjuge_data_expedicao || null,
      conjuge_profissao: data.conjuge_profissao ?? null,
      conjuge_empresa: data.conjuge_empresa ?? null,
      conjuge_renda: data.conjuge_renda ?? null,
      conjuge_email: data.conjuge_email ?? null,
      conjuge_celular: data.conjuge_celular ?? null,
      conjuge_banco_conta: data.conjuge_banco_conta ?? null,
      conjuge_agencia: data.conjuge_agencia ?? null,
      conjuge_conta_corrente: data.conjuge_conta_corrente ?? null,
      conjuge_digito_conta: data.conjuge_digito_conta ?? null,
    };

    // Se já existe um cliente com o mesmo documento neste ecossistema, reaproveita
    // o cadastro existente (evita violar a constraint clientes_doc_unico e efetivamente
    // "vincula" o cliente já cadastrado, atualizando os campos informados).
    const { data: existente } = await supabaseAdmin
      .from("clientes")
      .select("id, responsavel_id, criador_id")
      .eq("correspondente_id", me.correspondente_id)
      .eq("documento", data.documento)
      .maybeSingle();
    if (existente?.id) {
      // Só reaproveita se o solicitante tiver permissão de edição
      // (evita que um criador sobrescreva silenciosamente o cadastro de outro).
      const podeEditar = await podeAcao(supabase, userId, "crm.clientes", "edit");
      if (!podeEditar) {
        throw new Error(
          "Já existe um cliente com este documento e você não tem permissão para editá-lo. Peça ao responsável para atualizar o cadastro.",
        );
      }
      const { error: upErr } = await supabaseAdmin
        .from("clientes")
        .update(campos)
        .eq("id", existente.id);
      if (upErr) throw upErr;
      const { registrarAuditoria } = await import("@/lib/admin/audit.server");
      await registrarAuditoria({
        supabase,
        userId,
        correspondenteId: me.correspondente_id,
        acao: "cliente.atualizar",
        entidade: "clientes",
        entidadeId: existente.id,
        payloadNovo: { motivo: "reaproveitamento_por_documento", nome: data.nome },
      });
      await supabaseAdmin.from("cliente_historico").insert({
        cliente_id: existente.id,
        tipo: "sistema",
        descricao: "Dados atualizados via novo cadastro com o mesmo documento.",
        ator_id: userId,
      });
      return { id: existente.id };
    }

    const { data: novo, error } = await supabaseAdmin
      .from("clientes")
      .insert({
        correspondente_id: me.correspondente_id,
        numero_cliente: "",
        tipo_pessoa: data.tipo_pessoa,
        nome: data.nome,
        documento: data.documento,
        documento_secundario: data.documento_secundario ?? null,
        data_nascimento: data.data_nascimento,
        estado_civil: data.estado_civil,
        regime_casamento: data.regime_casamento ?? null,
        mae: data.mae ?? null,
        pai: data.pai ?? null,
        sexo: data.sexo ?? null,
        nacionalidade: data.nacionalidade ?? null,
        naturalidade: data.naturalidade ?? null,
        tipo_documento_identidade: data.tipo_documento_identidade ?? null,
        numero_documento: data.numero_documento ?? null,
        orgao_expedidor: data.orgao_expedidor ?? null,
        uf_expedicao: data.uf_expedicao ?? null,
        data_expedicao: data.data_expedicao || null,
        profissao: data.profissao ?? null,
        empresa: data.empresa ?? null,
        banco_conta: data.banco_conta ?? null,
        agencia: data.agencia ?? null,
        conta_corrente: data.conta_corrente ?? null,
        digito_conta: data.digito_conta ?? null,
        email: data.email.toLowerCase(),
        telefone_celular: data.telefone_celular,
        renda_total_declarada: data.renda_total_declarada,
        uf_interesse: data.uf_interesse ?? null,
        utiliza_fgts: data.utiliza_fgts ?? false,
        fg_autorizacao_dados: data.fg_autorizacao_dados ?? false,
        origem: data.origem,
        conjuge_nome: data.conjuge_nome ?? null,
        conjuge_cpf: data.conjuge_cpf ?? null,
        conjuge_data_nascimento: data.conjuge_data_nascimento || null,
        conjuge_nome_mae: data.conjuge_nome_mae ?? null,
        conjuge_sexo: data.conjuge_sexo ?? null,
        conjuge_nacionalidade: data.conjuge_nacionalidade ?? null,
        conjuge_tipo_documento_identidade: data.conjuge_tipo_documento_identidade ?? null,
        conjuge_numero_documento: data.conjuge_numero_documento ?? null,
        conjuge_orgao_expedidor: data.conjuge_orgao_expedidor ?? null,
        conjuge_uf_expedicao: data.conjuge_uf_expedicao ?? null,
        conjuge_data_expedicao: data.conjuge_data_expedicao || null,
        conjuge_profissao: data.conjuge_profissao ?? null,
        conjuge_empresa: data.conjuge_empresa ?? null,
        conjuge_renda: data.conjuge_renda ?? null,
        conjuge_email: data.conjuge_email ?? null,
        conjuge_celular: data.conjuge_celular ?? null,
        conjuge_banco_conta: data.conjuge_banco_conta ?? null,
        conjuge_agencia: data.conjuge_agencia ?? null,
        conjuge_conta_corrente: data.conjuge_conta_corrente ?? null,
        conjuge_digito_conta: data.conjuge_digito_conta ?? null,
        responsavel_id: userId,
        criador_id: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: me.correspondente_id,
      acao: "cliente.criar",
      entidade: "clientes",
      entidadeId: novo.id,
      payloadNovo: { nome: data.nome, tipo_pessoa: data.tipo_pessoa },
    });
    return { id: novo.id };
  });

/** Atualiza dados do cliente. */
export const atualizarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clienteInputSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { id, ...campos } = data;
    const { error } = await supabase
      .from("clientes")
      .update({
        tipo_pessoa: campos.tipo_pessoa,
        nome: campos.nome,
        documento: campos.documento,
        documento_secundario: campos.documento_secundario ?? null,
        data_nascimento: campos.data_nascimento,
        estado_civil: campos.estado_civil,
        regime_casamento: campos.regime_casamento ?? null,
        mae: campos.mae ?? null,
        pai: campos.pai ?? null,
        sexo: campos.sexo ?? null,
        nacionalidade: campos.nacionalidade ?? null,
        naturalidade: campos.naturalidade ?? null,
        tipo_documento_identidade: campos.tipo_documento_identidade ?? null,
        numero_documento: campos.numero_documento ?? null,
        orgao_expedidor: campos.orgao_expedidor ?? null,
        uf_expedicao: campos.uf_expedicao ?? null,
        data_expedicao: campos.data_expedicao || null,
        profissao: campos.profissao ?? null,
        empresa: campos.empresa ?? null,
        banco_conta: campos.banco_conta ?? null,
        agencia: campos.agencia ?? null,
        conta_corrente: campos.conta_corrente ?? null,
        digito_conta: campos.digito_conta ?? null,
        email: campos.email.toLowerCase(),
        telefone_celular: campos.telefone_celular,
        renda_total_declarada: campos.renda_total_declarada,
        uf_interesse: campos.uf_interesse ?? null,
        utiliza_fgts: campos.utiliza_fgts ?? false,
        fg_autorizacao_dados: campos.fg_autorizacao_dados ?? false,
        origem: campos.origem,
        conjuge_nome: campos.conjuge_nome ?? null,
        conjuge_cpf: campos.conjuge_cpf ?? null,
        conjuge_data_nascimento: campos.conjuge_data_nascimento || null,
        conjuge_nome_mae: campos.conjuge_nome_mae ?? null,
        conjuge_sexo: campos.conjuge_sexo ?? null,
        conjuge_nacionalidade: campos.conjuge_nacionalidade ?? null,
        conjuge_tipo_documento_identidade: campos.conjuge_tipo_documento_identidade ?? null,
        conjuge_numero_documento: campos.conjuge_numero_documento ?? null,
        conjuge_orgao_expedidor: campos.conjuge_orgao_expedidor ?? null,
        conjuge_uf_expedicao: campos.conjuge_uf_expedicao ?? null,
        conjuge_data_expedicao: campos.conjuge_data_expedicao || null,
        conjuge_profissao: campos.conjuge_profissao ?? null,
        conjuge_empresa: campos.conjuge_empresa ?? null,
        conjuge_renda: campos.conjuge_renda ?? null,
        conjuge_email: campos.conjuge_email ?? null,
        conjuge_celular: campos.conjuge_celular ?? null,
        conjuge_banco_conta: campos.conjuge_banco_conta ?? null,
        conjuge_agencia: campos.conjuge_agencia ?? null,
        conjuge_conta_corrente: campos.conjuge_conta_corrente ?? null,
        conjuge_digito_conta: campos.conjuge_digito_conta ?? null,
      })
      .eq("id", id);
    if (error) throw error;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corr ?? null,
      acao: "cliente.atualizar",
      entidade: "clientes",
      entidadeId: id,
      payloadNovo: { nome: campos.nome },
    });
    return { ok: true };
  });

export interface ClienteDetalhe {
  cliente: Database["public"]["Tables"]["clientes"]["Row"];
  podePii: boolean;
  etapa_codigo: string | null;
  responsavel_nome: string | null;
}

/** Detalhe completo do cliente. */
export const getCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClienteDetalhe> => {
    const { supabase, userId } = context;
    const podePii = await temPii(supabase, userId);
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select(
        "*, responsavel:profiles!clientes_responsavel_id_fkey(nome), cliente_pipeline(pipeline_stages(codigo))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!cliente) throw new Error("Cliente não encontrado.");
    if (!podePii) {
      const c = cliente as any;
      if (c.documento) c.documento = mascararDocumento(c.documento);
      if (c.documento_secundario)
        c.documento_secundario = mascararDocumento(c.documento_secundario);
    }
    return {
      cliente: cliente as any,
      podePii,
      etapa_codigo: (cliente as any).cliente_pipeline?.pipeline_stages?.codigo ?? null,
      responsavel_nome: (cliente as any).responsavel?.nome ?? null,
    };
  });

export interface PainelStage {
  codigo: string;
  nome: string;
  ordem: number;
  clientes: {
    id: string;
    nome: string;
    numero_cliente: string;
    vistoria_agendada_em: string | null;
    vistoria_concluida_em: string | null;
    pipeline_atualizado_em: string | null;
    contrato_emitido_em: string | null;
    numero_proposta: string | null;
    proposta_id: string | null;
    proposta_status: string | null;
    nome_banco: string | null;
    numero_simulacao: string | null;
    simulacao_id: string | null;
    simulacao_status: string | null;
    total_propostas: number;
    total_simulacoes: number;
    responsavel_nome: string | null;
    imobiliaria_nome: string | null;
    corretor_nome: string | null;
    analista_nome: string | null;
  }[];
}


/** Kanban da esteira: etapas com clientes posicionados (RLS aplica escopo). */
export const listarPainel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          desde: z.string().optional(),
          ate: z.string().optional(),
          escopo: z.enum(["minhas", "geral"]).optional(),
        })
        .optional()
        .parse(d) ?? {},
  )
  .handler(async ({ data, context }): Promise<PainelStage[]> => {
    const { supabase, userId } = context;
    const desde = data?.desde ? new Date(data.desde).getTime() : null;
    const ate = data?.ate ? new Date(`${data.ate}T23:59:59.999`).getTime() : null;
    const soMinhas = data?.escopo === "minhas";

    // Etapas + (quando "minhas") ids de clientes onde eu sou parceiro (imob/corretor).
    const [stagesRes, parceirosVinc] = await Promise.all([
      supabase.from("pipeline_stages").select("codigo, nome, ordem").order("ordem"),
      soMinhas
        ? supabase.from("cliente_parceiros").select("cliente_id").eq("parceiro_id", userId)
        : Promise.resolve({ data: [] as { cliente_id: string }[] }),
    ]);
    if (stagesRes.error) throw stagesRes.error;
    const stages = stagesRes.data ?? [];
    const idsPorParceria = new Set(
      ((parceirosVinc.data as { cliente_id: string }[] | null) ?? []).map((r) => r.cliente_id),
    );

    // Uma única query: cliente + responsável + analista + pipeline + propostas + simulações + parceiros.
    // Reduz round-trips do Worker→Supabase de ~4 para 1 no caminho crítico.
    const sel = (s: string): string => s;
    let q = supabase
      .from("clientes")
      .select(
        sel(`id, nome, numero_cliente, responsavel_id, criador_id,
             vistoria_agendada_em, vistoria_concluida_em, contrato_emitido_em,
             responsavel:profiles!clientes_responsavel_id_fkey(nome),
             analista:profiles!clientes_criador_id_fkey(nome),
             cliente_pipeline(ultima_atualizacao_em, pipeline_stages(codigo)),
             propostas!propostas_cliente_id_fkey(id, numero_proposta, status, nome_banco, created_at, deleted_at),
             simulacoes!simulacoes_cliente_id_fkey(id, numero_simulacao, status, created_at, deleted_at),
             cliente_parceiros!cliente_parceiros_cliente_id_fkey(tipo_vinculo, parceiro:profiles!cliente_parceiros_parceiro_id_fkey(nome))`),
      )
      .eq("ativo", true)
      .is("contrato_arquivado_em", null);
    if (soMinhas) {
      const partes: string[] = [
        `responsavel_id.eq.${userId}`,
        `criador_id.eq.${userId}`,
      ];
      if (idsPorParceria.size > 0) {
        partes.push(`id.in.(${Array.from(idsPorParceria).join(",")})`);
      }
      q = q.or(partes.join(","));
    }
    const { data: rows, error: e2 } = await q.order("nome").returns<any[]>();
    if (e2) throw e2;

    const filtradas = (rows ?? []).filter((r: any) => {
      if (!desde && !ate) return true;
      const atualizado = r.cliente_pipeline?.ultima_atualizacao_em;
      if (!atualizado) return false;
      const t = new Date(atualizado).getTime();
      if (desde && t < desde) return false;
      if (ate && t > ate) return false;
      return true;
    });

    const cmpDesc = (a: string | null, b: string | null) =>
      (b ?? "").localeCompare(a ?? "");

    return stages.map((s) => ({
      codigo: s.codigo,
      nome: s.nome,
      ordem: s.ordem,
      clientes: filtradas
        .filter((r: any) => r.cliente_pipeline?.pipeline_stages?.codigo === s.codigo)
        .map((r: any) => {
          const propostas = ((r.propostas ?? []) as any[])
            .filter((p) => p.deleted_at == null)
            .sort((a, b) => cmpDesc(a.created_at, b.created_at));
          const simulacoes = ((r.simulacoes ?? []) as any[])
            .filter((sm) => sm.deleted_at == null)
            .sort((a, b) => cmpDesc(a.created_at, b.created_at));
          const prop = propostas[0] ?? null;
          const sim = simulacoes[0] ?? null;
          const parceiros = (r.cliente_parceiros ?? []) as any[];
          const imob = parceiros.find((v) => v.tipo_vinculo === "imobiliaria");
          const corr = parceiros.find((v) => v.tipo_vinculo === "corretor");
          return {
            id: r.id,
            nome: r.nome,
            numero_cliente: r.numero_cliente,
            vistoria_agendada_em: r.vistoria_agendada_em ?? null,
            vistoria_concluida_em: r.vistoria_concluida_em ?? null,
            pipeline_atualizado_em: r.cliente_pipeline?.ultima_atualizacao_em ?? null,
            contrato_emitido_em: r.contrato_emitido_em ?? null,
            numero_proposta: prop?.numero_proposta ?? null,
            proposta_id: prop?.id ?? null,
            proposta_status: prop?.status ?? null,
            nome_banco: prop?.nome_banco ?? null,
            numero_simulacao: sim?.numero_simulacao ?? null,
            simulacao_id: sim?.id ?? null,
            simulacao_status: sim?.status ?? null,
            total_propostas: propostas.length,
            total_simulacoes: simulacoes.length,
            responsavel_nome: r.responsavel?.nome ?? null,
            imobiliaria_nome: imob?.parceiro?.nome ?? null,
            corretor_nome: corr?.parceiro?.nome ?? null,
            analista_nome: r.analista?.nome ?? null,
          };
        }),
    }));
  });


export const getPipelineStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pipeline_stages")
      .select("id, ordem, codigo, nome, mensagem_cliente")
      .order("ordem");
    if (error) throw error;
    return data ?? [];
  });

/** Posição atual do cliente na esteira. */
export const getClientePipeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("cliente_pipeline")
      .select("ultima_atualizacao_em, pipeline_stages(codigo, ordem, nome)")
      .eq("cliente_id", data.cliente_id)
      .maybeSingle();
    if (error) throw error;
    return {
      codigo: (row as any)?.pipeline_stages?.codigo ?? "cadastro_basico",
      ordem: (row as any)?.pipeline_stages?.ordem ?? 1,
      atualizado: (row as any)?.ultima_atualizacao_em ?? null,
    };
  });

/** Salva endereço principal (dispara avanço para cadastro_completo). */
export const salvarEndereco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        cep: z.string().optional().nullable(),
        logradouro: z.string().optional().nullable(),
        numero: z.string().optional().nullable(),
        complemento: z.string().optional().nullable(),
        bairro: z.string().optional().nullable(),
        cidade: z.string().optional().nullable(),
        uf: z.string().max(2).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { data: existente } = await supabase
      .from("cliente_enderecos")
      .select("id")
      .eq("cliente_id", data.cliente_id)
      .eq("principal", true)
      .maybeSingle();
    const payload = {
      cep: data.cep ?? null,
      logradouro: data.logradouro ?? null,
      numero: data.numero ?? null,
      complemento: data.complemento ?? null,
      bairro: data.bairro ?? null,
      cidade: data.cidade ?? null,
      uf: data.uf ?? null,
    };
    if (existente) {
      const { error } = await supabase
        .from("cliente_enderecos")
        .update(payload)
        .eq("id", existente.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("cliente_enderecos")
        .insert({ cliente_id: data.cliente_id, principal: true, ...payload });
      if (error) throw error;
    }
    return { ok: true };
  });

export const getEndereco = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("cliente_enderecos")
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .eq("principal", true)
      .maybeSingle();
    return row ?? null;
  });

// ----------------------------------------------------------------------------
// Vendedores do imóvel (um cliente/imóvel pode ter vários)
// ----------------------------------------------------------------------------
const vendedorSchema = z.object({
  id: z.string().uuid().optional(),
  cliente_id: z.string().uuid(),
  tipo_pessoa: z.enum(["PF", "PJ"]).default("PF"),
  nome: z.string().trim().min(1, "Informe o nome do vendedor."),
  documento: z.string().optional().nullable(),
  documento_secundario: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  estado_civil: z.string().optional().nullable(),
  regime_casamento: z.string().optional().nullable(),
  mae: z.string().optional().nullable(),
  pai: z.string().optional().nullable(),
  sexo: z.string().optional().nullable(),
  nacionalidade: z.string().optional().nullable(),
  naturalidade: z.string().optional().nullable(),
  tipo_documento_identidade: z.string().optional().nullable(),
  numero_documento: z.string().optional().nullable(),
  orgao_expedidor: z.string().optional().nullable(),
  uf_expedicao: z.string().optional().nullable(),
  data_expedicao: z.string().optional().nullable(),
  profissao: z.string().optional().nullable(),
  empresa: z.string().optional().nullable(),
  banco_conta: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta_corrente: z.string().optional().nullable(),
  digito_conta: z.string().optional().nullable(),
  conjuge_banco_conta: z.string().optional().nullable(),
  conjuge_agencia: z.string().optional().nullable(),
  conjuge_conta_corrente: z.string().optional().nullable(),
  conjuge_digito_conta: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  telefone_celular: z.string().optional().nullable(),
  renda_total_declarada: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  utiliza_fgts: z.boolean().default(false),
  fg_autorizacao_dados: z.boolean().default(false),
});

export const listarVendedores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("cliente_vendedores")
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const salvarVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => vendedorSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; id: string }> => {
    const { supabase } = context;
    const norm = (v: string | null | undefined) =>
      v != null && String(v).trim() !== "" ? String(v).trim() : null;
    const { id, cliente_id, renda_total_declarada, ...rest } = data;
    const payload: Record<string, unknown> = {
      cliente_id,
      tipo_pessoa: data.tipo_pessoa,
      nome: data.nome.trim(),
      renda_total_declarada:
        renda_total_declarada != null && String(renda_total_declarada).trim() !== ""
          ? Number(String(renda_total_declarada).replace(/\./g, "").replace(",", "."))
          : null,
      utiliza_fgts: data.utiliza_fgts,
      fg_autorizacao_dados: data.fg_autorizacao_dados,
    };
    for (const [k, v] of Object.entries(rest)) {
      if (["tipo_pessoa", "nome", "utiliza_fgts", "fg_autorizacao_dados"].includes(k)) continue;
      payload[k] = norm(v as string | null | undefined);
    }
    if (id) {
      const { error } = await supabase.from("cliente_vendedores").update(payload as any).eq("id", id);
      if (error) throw error;
      return { ok: true, id };
    }
    const { data: inserted, error } = await supabase
      .from("cliente_vendedores")
      .insert(payload as any)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id };
  });

export const removerVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("cliente_vendedores")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Registra interação manual (nenhum disparo automático). */
export const registrarInteracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        canal: z.enum([
          "ligacao",
          "whatsapp",
          "email",
          "reuniao",
          "presencial",
          "followup",
          "outro",
        ]),
        resultado: z.string().optional().nullable(),
        observacao: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("cliente_interacoes").insert({
      cliente_id: data.cliente_id,
      canal: data.canal,
      responsavel_id: userId,
      resultado: data.resultado ?? null,
      observacao: data.observacao ?? null,
    });
    if (error) throw error;
    await supabase.from("cliente_historico").insert({
      cliente_id: data.cliente_id,
      tipo: "interacao",
      descricao: `Contato registrado (${data.canal})`,
      ator_id: userId,
    });
    return { ok: true };
  });

export const listarInteracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("cliente_interacoes")
      .select("*, responsavel:profiles!cliente_interacoes_responsavel_id_fkey(nome)")
      .eq("cliente_id", data.cliente_id)
      .order("ocorrido_em", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const listarHistorico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("cliente_historico")
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return rows ?? [];
  });

/** Registra documento (o upload ao bucket é feito no client). */
export const anexarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        categoria: z.enum(["comprador", "conjuge", "vendedor", "vendedor_conjuge", "imovel", "outros"]),
        pasta_id: z.string().uuid().optional().nullable(),
        tipo_documento: z.string().min(1),
        nome_arquivo: z.string().min(1),
        storage_path: z.string().min(1),
        mime_type: z.string().optional().nullable(),
        tamanho_bytes: z.number().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("cliente_documentos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", data.cliente_id)
      .eq("categoria", data.categoria)
      .eq("tipo_documento", data.tipo_documento);
    const { error } = await supabase.from("cliente_documentos").insert({
      cliente_id: data.cliente_id,
      categoria: data.categoria,
      pasta_id: data.pasta_id ?? null,
      tipo_documento: data.tipo_documento,
      nome_arquivo: data.nome_arquivo,
      storage_path: data.storage_path,
      mime_type: data.mime_type ?? null,
      tamanho_bytes: data.tamanho_bytes ?? null,
      versao: (count ?? 0) + 1,
      status: "recebido",
      enviado_por: userId,
    });
    if (error) throw error;
    await supabase.from("cliente_historico").insert({
      cliente_id: data.cliente_id,
      tipo: "documento",
      descricao: `Documento anexado: ${data.nome_arquivo}`,
      ator_id: userId,
    });
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: null,
      acao: "documento.anexar",
      entidade: "cliente_documentos",
      entidadeId: data.cliente_id,
      descricao: `anexou o documento "${data.nome_arquivo}"`,
      payloadNovo: { nome_arquivo: data.nome_arquivo, tipo: data.tipo_documento },
    });
    return { ok: true };
  });

export const listarDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("cliente_documentos")
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const lista = (rows ?? []) as any[];
    const ids = Array.from(
      new Set(lista.map((r) => r.enviado_por).filter((v): v is string => !!v)),
    );
    const nomes = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, nome")
        .in("id", ids);
      for (const p of (profs ?? []) as { id: string; nome: string | null }[]) {
        if (p.nome) nomes.set(p.id, p.nome);
      }
    }
    return lista.map((r) => ({
      ...r,
      enviado_por_nome: r.enviado_por ? (nomes.get(r.enviado_por) ?? null) : null,
    }));
  });

/** Aprova/reprova documento. */
export const revisarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["aprovado", "reprovado"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    if (!(await podeAcao(supabase, userId, "crm.clientes", "edit"))) {
      throw new Error("Você não tem permissão para revisar documentos.");
    }
    const { error } = await supabase
      .from("cliente_documentos")
      .update({ status: data.status, aprovado_por: userId, aprovado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** URL assinada (5 min) para baixar documento. */
export const urlDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ storage_path: z.string() }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    // Confirma que o path pertence a um documento visível ao usuário (RLS aplicada na leitura).
    const { data: doc } = await context.supabase
      .from("cliente_documentos")
      .select("id")
      .eq("storage_path", data.storage_path)
      .maybeSingle();
    if (!doc) throw new Error("Documento não encontrado.");
    const { data: signed, error } = await context.supabase.storage
      .from("cliente-documentos")
      .createSignedUrl(data.storage_path, 300);
    if (error || !signed) throw error ?? new Error("Falha ao gerar link.");
    return { url: signed.signedUrl };
  });

/** Edita metadados do documento (categoria/tipo). */
export const editarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        categoria: z.enum([
          "comprador",
          "conjuge",
          "vendedor",
          "vendedor_conjuge",
          "imovel",
          "outros",
        ]),
        pasta_id: z.string().uuid().optional().nullable(),
        tipo_documento: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    if (!(await podeAcao(supabase, userId, "crm.clientes", "edit"))) {
      throw new Error("Você não tem permissão para editar documentos.");
    }
    const patch: Record<string, unknown> = {
      categoria: data.categoria,
      tipo_documento: data.tipo_documento,
    };
    if (data.pasta_id !== undefined) patch.pasta_id = data.pasta_id;
    const { error } = await supabase.from("cliente_documentos").update(patch as any).eq("id", data.id);
    if (error) throw error;
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: null,
      acao: "documento.editar",
      entidade: "cliente_documentos",
      entidadeId: data.id,
      descricao: `editou o documento "${data.tipo_documento}"`,
      payloadNovo: { tipo: data.tipo_documento },
    });
    return { ok: true };
  });

/** Exclui documento (registro + arquivo no storage). */
export const excluirDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    if (!(await podeAcao(supabase, userId, "crm.clientes", "edit"))) {
      throw new Error("Você não tem permissão para excluir documentos.");
    }
    const { data: doc } = await supabase
      .from("cliente_documentos")
      .select("id, cliente_id, storage_path, nome_arquivo")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Documento não encontrado.");
    if (doc.storage_path) {
      await supabase.storage.from("cliente-documentos").remove([doc.storage_path]);
    }
    const { error } = await supabase.from("cliente_documentos").delete().eq("id", data.id);
    if (error) throw error;
    await supabase.from("cliente_historico").insert({
      cliente_id: doc.cliente_id,
      tipo: "documento",
      descricao: `Documento excluído: ${doc.nome_arquivo}`,
      ator_id: userId,
    });
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: null,
      acao: "documento.excluir",
      entidade: "cliente_documentos",
      entidadeId: doc.cliente_id,
      descricao: `excluiu o documento "${doc.nome_arquivo}"`,
      payloadAnterior: { nome_arquivo: doc.nome_arquivo },
    });
    return { ok: true };
  });

/** Move etapa manualmente (respeita regra de não retroceder). */
export const moverEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        codigo_destino: z.string(),
        observacao: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("cliente_pipeline_avancar_para", {
      _cliente_id: data.cliente_id,
      _codigo_destino: data.codigo_destino,
      _acao: "manual",
      _obs: data.observacao ?? undefined,
    });
    if (error) throw error;
    return { ok: true };
  });

/** Define a etapa da esteira para qualquer posição (avança ou volta). */
export const definirEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        codigo_destino: z.string(),
        observacao: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("cliente_pipeline_definir", {
      _cliente_id: data.cliente_id,
      _codigo_destino: data.codigo_destino,
      _obs: data.observacao ?? undefined,
    });
    if (error) throw error;
    return { ok: true };
  });

/**
 * Reseta a etapa do cliente para o cadastro base quando ele NÃO possui mais
 * simulações nem propostas. Usado após excluir simulação/proposta para que o
 * cliente não fique "preso" numa etapa avançada exibindo um vínculo inexistente.
 */
export async function recuarEsteiraSeOrfao(
  supabase: any,
  clienteId: string | null | undefined,
): Promise<void> {
  if (!clienteId) return;
  const [{ count: sims }, { count: props }] = await Promise.all([
    supabase
      .from("simulacoes")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId)
      .is("deleted_at", null),
    supabase
      .from("propostas")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId)
      .is("deleted_at", null),
  ]);
  const temSims = (sims ?? 0) > 0;
  const temProps = (props ?? 0) > 0;

  const { data: atual } = await supabase
    .from("cliente_pipeline")
    .select("pipeline_stages(codigo)")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  const codigo = (atual as any)?.pipeline_stages?.codigo as string | undefined;
  if (!codigo) return;

  // Etapas que só fazem sentido enquanto existe uma proposta ativa vinculada
  // (crédito e todo o fluxo pós-crédito: docs/engenharia/jurídico/contrato).
  const etapasProposta = new Set([
    "credito_enviado",
    "credito_aprovado",
    "coleta_documentos",
    "engenharia_vistoria",
    "analise_juridica",
    "contrato_emitido",
  ]);
  // Etapa que só faz sentido enquanto existe uma simulação vinculada.
  const etapaSimulacao = "simulacao";

  let destino: string | null = null;
  if (etapasProposta.has(codigo) && !temProps) {
    // A proposta que levou o cliente até aqui foi excluída: recua para a
    // simulação (se ainda houver) ou para o cadastro.
    destino = temSims ? "simulacao" : "cadastro_completo";
  } else if (codigo === etapaSimulacao && !temSims && !temProps) {
    destino = "cadastro_completo";
  }
  if (!destino || destino === codigo) return;

  // Se estava em "contrato_emitido" e a proposta foi excluída, limpa também
  // a marca do contrato no cadastro do cliente — o vínculo deixou de existir.
  if (codigo === "contrato_emitido") {
    await supabase
      .from("clientes")
      .update({ contrato_emitido_em: null, contrato_arquivado_em: null })
      .eq("id", clienteId);
  }

  await supabase.rpc("cliente_pipeline_definir", {
    _cliente_id: clienteId,
    _codigo_destino: destino,
    _obs: "Retorno automático: simulação/proposta vinculada foi excluída.",
  });
}


/**
 * Remove, direto do painel, o vínculo de simulação/aprovação de um cliente que
 * aparece numa etapa avançada apontando para registros já excluídos. Apaga as
 * simulações e propostas restantes do cliente e recua a esteira para o cadastro.
 */
export const limparVinculoEsteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // Usa o cliente administrativo para garantir a exclusão completa mesmo quando
    // as simulações/propostas foram originadas por outro analista/escopo — o
    // objetivo é limpar de vez o vínculo da esteira.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const agora = new Date().toISOString();
    const motivo = "Vínculo removido pelo painel do CRM.";

    // Soft delete das propostas ativas do cliente (preserva histórico e permite
    // restauração na aba "Excluídas"). Não apagamos comissões/recebíveis: eles
    // permanecem vinculados e voltam a valer caso a proposta seja restaurada.
    const { error: eProp } = await supabaseAdmin
      .from("propostas")
      .update({ deleted_at: agora, deleted_by: userId, deleted_motivo: motivo })
      .eq("cliente_id", data.cliente_id)
      .is("deleted_at", null);
    if (eProp) throw eProp;

    // Soft delete das simulações ativas do cliente pelo mesmo motivo.
    const { error: eSim } = await supabaseAdmin
      .from("simulacoes")
      .update({ deleted_at: agora, deleted_by: userId, deleted_motivo: motivo } as any)
      .eq("cliente_id", data.cliente_id)
      .is("deleted_at", null);
    if (eSim) throw eSim;

    const { error } = await context.supabase.rpc("cliente_pipeline_definir", {
      _cliente_id: data.cliente_id,
      _codigo_destino: "cadastro_completo",
      _obs: "Vínculo de simulação/aprovação removido manualmente pelo painel.",
    });
    if (error) throw error;
    return { ok: true };
  });






/**
 * Define as datas de vistoria (agendamento e/ou conclusão) da operação do
 * cliente. Como ficam na ficha do cliente, valem para todos os processos e
 * envolvidos ligados a essa operação e são exibidas também no portal do cliente.
 */
export const definirDatasVistoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        vistoria_agendada_em: z.string().date().nullable().optional(),
        vistoria_concluida_em: z.string().date().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const patch: { vistoria_agendada_em?: string | null; vistoria_concluida_em?: string | null } =
      {};
    if (data.vistoria_agendada_em !== undefined)
      patch.vistoria_agendada_em = data.vistoria_agendada_em;
    if (data.vistoria_concluida_em !== undefined)
      patch.vistoria_concluida_em = data.vistoria_concluida_em;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("clientes")
      .update(patch)
      .eq("id", data.cliente_id);
    if (error) throw error;
    return { ok: true };
  });

/** Busca de clientes para combobox (Etapa 04). */
export const buscarClientesCRM = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string() }).parse(d))

  .handler(async ({ data, context }) => {
    const term = data.q.trim();
    if (!term) return [];
    const dig = term.replace(/\D/g, "");
    const ors = [`nome.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (dig) ors.push(`documento.ilike.%${dig}%`);
    const { data: rows, error } = await context.supabase
      .from("clientes")
      .select(
        "id, nome, documento, email, telefone_celular, data_nascimento, estado_civil, renda_total_declarada, uf_interesse",
      )
      .or(ors.join(","))
      .eq("ativo", true)
      .order("nome")
      .limit(10);
    if (error) throw error;
    return rows ?? [];
  });

/** Exclui um cliente (e seus registros dependentes via cascata). */
export const excluirCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const cid = data.id;

    // Permite excluir se: (a) tem permissão explícita no módulo, OU
    // (b) é o próprio criador do cliente. A RLS do banco já autoriza o criador,
    // mas fazíamos aqui uma checagem restrita a admin/gestor que barrava
    // analistas/comerciais de excluírem seus próprios cadastros.
    const permitido = await podeAcao(supabase, userId, "crm.clientes", "delete");
    if (!permitido) {
      const { data: dono } = await supabase
        .from("clientes")
        .select("criador_id")
        .eq("id", cid)
        .maybeSingle();
      if (!dono || (dono as any).criador_id !== userId) {
        throw new Error("Você só pode excluir clientes que você cadastrou.");
      }
    }

    // Usa o cliente administrativo para remover cliente e dependências mesmo
    // quando a RLS restringiria o DELETE em cascata.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


    // Propostas do cliente -> limpa comissões/recebíveis vinculados antes.
    const { data: props } = await supabaseAdmin
      .from("propostas")
      .select("id")
      .eq("cliente_id", cid);
    const propIds = (props ?? []).map((p: any) => p.id);
    if (propIds.length > 0) {
      await supabaseAdmin.from("comissoes").delete().in("proposta_id", propIds);
      await supabaseAdmin.from("financial_receivables").delete().in("proposta_id", propIds);
    }

    // Remove todos os registros dependentes que referenciam este cliente.
    const tabelasDependentes = [
      "cliente_app_acessos",
      "cliente_app_mensagens",
      "cliente_app_notificacoes",
      "cliente_documento_pastas",
      "cliente_documentos",
      "cliente_enderecos",
      "cliente_historico",
      "cliente_imoveis",
      "cliente_interacoes",
      "cliente_parceiros",
      "cliente_pipeline",
      "cliente_pipeline_historico",
      "cliente_portal_acessos",
      "cliente_vendedores",
      "crm_chat_cliente_etiquetas",
      "crm_chat_meta",
      "demandas",
      "proposta_envolvidos",
      "propostas",
      "scan_ia_leituras",
      "simulacoes",
      "tasks",
    ] as const;
    for (const tabela of tabelasDependentes) {
      await supabaseAdmin.from(tabela as any).delete().eq("cliente_id", cid);
    }

    const { error } = await supabaseAdmin.from("clientes").delete().eq("id", cid);
    if (error) throw error;

    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corr ?? null,
      acao: "cliente.excluir",
      entidade: "clientes",
      entidadeId: data.id,
    });
    return { ok: true };
  });

/** Habilita/desabilita o acesso do cliente ao portal (persiste no cadastro). */
export const definirAcessoPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cliente_id: z.string().uuid(), ativo: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; ativo: boolean }> => {
    const { error } = await context.supabase
      .from("clientes")
      .update({ portal_acesso_ativo: data.ativo })
      .eq("id", data.cliente_id);
    if (error) throw error;
    return { ok: true, ativo: data.ativo };
  });

export interface VinculoParceiro {
  id: string;
  parceiro_id: string;
  tipo_vinculo: string;
  nome: string | null;
  email: string | null;
  created_at: string;
}

/** Tipos de vínculo de atendimento disponíveis. */
export const TIPOS_VINCULO = [
  { valor: "imobiliaria", rotulo: "Imobiliária" },
  { valor: "corretor", rotulo: "Corretor" },
  { valor: "comercial_agilliza", rotulo: "Comercial Agilliza" },
] as const;

export type TipoVinculo = (typeof TIPOS_VINCULO)[number]["valor"];

/**
 * Mapeia cada tipo de vínculo de atendimento para o slug de "tipo de pessoa"
 * correspondente (profiles.tipo_pessoa). Assim cada campo lista somente os
 * usuários cadastrados naquele tipo de pessoa.
 */
export const TIPO_VINCULO_PESSOA: Record<TipoVinculo, string[]> = {
  imobiliaria: ["imobiliaria"],
  corretor: ["corretor"],
  // "Comercial Agilliza" lista somente os usuários marcados com o tipo de
  // pessoa "comercial" — não a equipe interna inteira. Parceiros externos
  // (imobiliária/corretor) continuam nos seus próprios campos.
  comercial_agilliza: ["comercial"],
};

/**
 * Verifica se um usuário/parceiro pertence a algum dos tipos aceitos por um
 * campo de vínculo. Considera tanto o tipo principal (`tipo_pessoa`) quanto os
 * tipos adicionais marcados na pessoa (`tipos_pessoa`), pois uma pessoa pode ter
 * mais de um tipo (ex.: Gestão + Comercial).
 */
export function parceiroAtendeTipos(
  parceiro: { tipo_pessoa?: string | null; tipos_pessoa?: string[] | null },
  tiposAceitos: string[],
): boolean {
  const seus = new Set<string>();
  if (parceiro.tipo_pessoa) seus.add(parceiro.tipo_pessoa);
  for (const t of parceiro.tipos_pessoa ?? []) if (t) seus.add(t);
  return tiposAceitos.some((t) => seus.has(t));
}

/** Lista os parceiros/usuários vinculados a um cliente. */
export const listarVinculosCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<VinculoParceiro[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("cliente_parceiros")
      .select("id, parceiro_id, tipo_vinculo, created_at")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const lista = rows ?? [];
    if (lista.length === 0) return [];
    const ids = lista.map((r: any) => r.parceiro_id);
    const { data: perfis } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", ids);
    const mapa = new Map((perfis ?? []).map((p: any) => [p.id, p]));
    return lista.map((r: any) => ({
      id: r.id,
      parceiro_id: r.parceiro_id,
      tipo_vinculo: r.tipo_vinculo ?? "corretor",
      nome: mapa.get(r.parceiro_id)?.nome ?? null,
      email: mapa.get(r.parceiro_id)?.email ?? null,
      created_at: r.created_at,
    }));
  });

/** Lista usuários do sistema disponíveis para vincular (mesmo correspondente). */
export const listarParceirosDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<
      {
        id: string;
        nome: string | null;
        email: string | null;
        tipo_pessoa: string | null;
        tipos_pessoa: string[] | null;
      }[]
    > => {
      const { supabase, userId } = context;
      const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
      let query = supabase
        .from("profiles")
        .select("id, nome, email, tipo_pessoa, tipos_pessoa")
        .order("nome");
      if (corr) query = query.eq("correspondente_id", corr);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data ?? []) as any;
    },
  );


/** Cria um vínculo de atendimento entre o cliente e um usuário/parceiro. */
export const vincularParceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        parceiro_id: z.string().uuid(),
        tipo_vinculo: z
          .enum(["imobiliaria", "corretor", "comercial_agilliza"])
          .default("corretor"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    if (!corr) throw new Error("Sem correspondente.");
    const { error } = await supabase.from("cliente_parceiros").insert({
      cliente_id: data.cliente_id,
      parceiro_id: data.parceiro_id,
      tipo_vinculo: data.tipo_vinculo,
      correspondente_id: corr,
    });
    if (error) {
      if ((error as any).code === "23505") throw new Error("Este usuário já está vinculado neste tipo.");
      throw error;
    }
    return { ok: true };
  });

/** Remove um vínculo de atendimento. */
export const desvincularParceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    if (!corr) throw new Error("Sem correspondente.");
    const { error } = await supabase
      .from("cliente_parceiros")
      .delete()
      .eq("id", data.id)
      .eq("correspondente_id", corr);
    if (error) throw error;
    return { ok: true };
  });

export interface ClienteNegocios {
  simulacoes: Array<{
    id: string;
    numero_simulacao: string | null;
    produto: string | null;
    status: string | null;
    valor_financiamento: number | null;
    created_at: string;
    bancos: string[];
  }>;
  propostas: Array<{
    id: string;
    numero_proposta: string | null;
    nome_banco: string | null;
    produto: string | null;
    status: string | null;
    valor_financiamento: number | null;
    created_at: string;
  }>;
}

/** Lista as simulações e propostas vinculadas a um cliente (RLS aplica escopo). */
export const getClienteNegocios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClienteNegocios> => {
    const { supabase } = context;

    const [{ data: sims }, { data: props }] = await Promise.all([
      supabase
        .from("simulacoes")
        .select("id, numero_simulacao, produto, status, valor_financiamento, created_at")
        .eq("cliente_id", data.cliente_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("propostas")
        .select("id, numero_proposta, nome_banco, produto, status, valor_financiamento, created_at")
        .eq("cliente_id", data.cliente_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    // Busca os bancos selecionados de cada simulação para exibir logos/cores.
    const simIds = (sims ?? []).map((s: any) => s.id as string);
    const bancosPorSim: Record<string, string[]> = {};
    if (simIds.length > 0) {
      const { data: bancos } = await supabase
        .from("simulacao_bancos")
        .select("simulacao_id, nome_banco, selecionado")
        .in("simulacao_id", simIds)
        .eq("selecionado", true);
      for (const b of (bancos ?? []) as any[]) {
        const nome = (b.nome_banco ?? "").toString().trim();
        if (!nome) continue;
        const arr = (bancosPorSim[b.simulacao_id] ??= []);
        if (!arr.includes(nome)) arr.push(nome);
      }
    }

    return {
      simulacoes: ((sims ?? []) as any[]).map((s) => ({
        ...s,
        bancos: bancosPorSim[s.id] ?? [],
      })) as ClienteNegocios["simulacoes"],
      propostas: (props ?? []) as ClienteNegocios["propostas"],
    };
  });


/** Dados do cadastro usados para pré-marcar o checklist de documentação. */
export const getChecklistDados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cli, error } = await supabase
      .from("clientes")
      .select(
        "tipo_pessoa, estado_civil, profissao, email, telefone_celular, conjuge_nome, conjuge_profissao, conjuge_email, conjuge_celular, agencia, conta_corrente, banco_conta, utiliza_fgts, documentos_checklist",
      )
      .eq("id", data.cliente_id)
      .maybeSingle();
    if (error) throw error;
    const { data: vendedores } = await supabase
      .from("cliente_vendedores")
      .select(
        "id, tipo_pessoa, nome, estado_civil, profissao, email, telefone_celular, banco_conta, agencia, conta_corrente",
      )
      .eq("cliente_id", data.cliente_id);
    return { cliente: cli ?? null, vendedores: vendedores ?? [] };
  });

/** Persiste o estado manual do checklist e (opcionalmente) o uso de FGTS. */
export const salvarChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        checklist: z.record(z.string(), z.any()),
        utiliza_fgts: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    if (!(await podeAcao(supabase, userId, "crm.clientes", "edit"))) {
      throw new Error("Você não tem permissão para editar o checklist.");
    }
    const patch: Record<string, unknown> = { documentos_checklist: data.checklist };
    if (typeof data.utiliza_fgts === "boolean") patch.utiliza_fgts = data.utiliza_fgts;
    const { error } = await supabase.from("clientes").update(patch as never).eq("id", data.cliente_id);
    if (error) throw error;
    return { ok: true };
  });

/** Salva os dados do imóvel (exigidos pela integração bancária) e do interveniente quitante (IQ) no cadastro do cliente. */
export const salvarImovelIq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        imovel_tipo: z.string().max(10).optional().nullable(),
        imovel_uso: z.string().max(10).optional().nullable(),
        imovel_situacao: z.string().max(10).optional().nullable(),
        imovel_valor: z.number().nonnegative().optional().nullable(),
        imovel_cep: z.string().max(20).optional().nullable(),
        imovel_logradouro: z.string().max(200).optional().nullable(),
        imovel_numero: z.string().max(20).optional().nullable(),
        imovel_complemento: z.string().max(120).optional().nullable(),
        imovel_bairro: z.string().max(120).optional().nullable(),
        imovel_cidade: z.string().max(120).optional().nullable(),
        imovel_uf: z.string().max(2).optional().nullable(),
        iq_nome: z.string().max(200).optional().nullable(),
        iq_comentario: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    if (!(await podeAcao(supabase, userId, "crm.clientes", "edit"))) {
      throw new Error("Você não tem permissão para editar o cliente.");
    }
    const { cliente_id, ...patch } = data;
    const { error } = await supabase
      .from("clientes")
      .update(patch as never)
      .eq("id", cliente_id);
    if (error) throw error;
    return { ok: true };
  });

export interface ContratoEmitido {
  cliente_id: string;
  numero_cliente: string | null;
  nome_cliente: string | null;
  proposta_id: string | null;
  numero_proposta: string | null;
  nome_banco: string | null;
  valor_financiamento: number | null;
  contrato_emitido_em: string | null;
  contrato_arquivado_em: string | null;
}

/**
 * Define (ou limpa) a data de emissão do contrato de um cliente. A data é
 * escolhida pelo usuário no painel; quando ela chega (hoje ou já passou),
 * o contrato passa a aparecer na pasta de contratos emitidos.
 */
export const definirDataContratoEmitido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        contrato_emitido_em: z.string().date().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("clientes")
      .update({ contrato_emitido_em: data.contrato_emitido_em })
      .eq("id", data.cliente_id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Arquiva (ou desarquiva) o contrato de um cliente. Ao arquivar, o cliente sai
 * do quadro da esteira e passa a viver apenas na pasta de contratos emitidos.
 */
export const arquivarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        arquivar: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("clientes")
      .update({ contrato_arquivado_em: data.arquivar ? new Date().toISOString() : null })
      .eq("id", data.cliente_id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Arquivo dos contratos emitidos: clientes cuja data de emissão definida pelo
 * usuário já chegou (hoje ou anterior), mais recentes primeiro. Enriquecido
 * com dados da proposta mais recente do cliente (RLS aplica o escopo).
 */
export const listarContratosEmitidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContratoEmitido[]> => {
    const { supabase } = context;
    const { data: clientes, error } = await supabase
      .from("clientes")
      .select("id, nome, numero_cliente, contrato_emitido_em, contrato_arquivado_em")
      .not("contrato_arquivado_em", "is", null)
      .order("contrato_arquivado_em", { ascending: false });
    if (error) throw error;
    const lista = clientes ?? [];
    if (lista.length === 0) return [];
    const ids = lista.map((c) => c.id);
    const { data: propostas } = await supabase
      .from("propostas")
      .select("id, cliente_id, numero_proposta, nome_banco, valor_financiamento, created_at")
      .in("cliente_id", ids)
      .order("created_at", { ascending: false });
    const propostasLista = propostas ?? [];
    type PropostaResumo = (typeof propostasLista)[number];
    const porCliente = new Map<string, PropostaResumo>();
    for (const p of propostasLista) {
      if (p.cliente_id && !porCliente.has(p.cliente_id)) porCliente.set(p.cliente_id, p);
    }
    return lista.map((c) => {
      const p = porCliente.get(c.id);
      return {
        cliente_id: c.id,
        numero_cliente: c.numero_cliente ?? null,
        nome_cliente: c.nome ?? null,
        proposta_id: p?.id ?? null,
        numero_proposta: p?.numero_proposta ?? null,
        nome_banco: p?.nome_banco ?? null,
        valor_financiamento: p?.valor_financiamento ?? null,
        contrato_emitido_em: c.contrato_emitido_em ?? null,
        contrato_arquivado_em: c.contrato_arquivado_em ?? null,
      };
    });
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type TipoPessoa = Database["public"]["Enums"]["tipo_pessoa"];
type EstadoCivil = Database["public"]["Enums"]["cliente_estado_civil"];

async function temPii(supabase: any, userId: string): Promise<boolean> {
  const { data: tudo } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  if (tudo) return true;
  return Boolean(await supabase.rpc("usuario_tem_permissao", {
    _user_id: userId,
    _modulo: "crm.clientes",
    _acao: "pii:view",
  }).then((r: any) => r.data));
}

/** Verifica papel amplo (admin/correspondente) ou permissão específica do módulo. */
async function podeAcao(supabase: any, userId: string, modulo: string, acao: string): Promise<boolean> {
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
  pagina: z.number().int().min(1).default(1),
  porPagina: z.number().int().min(1).max(100).default(20),
});

/** Lista paginada de clientes (RLS aplica escopo). */
export const listarClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listarSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ itens: ClienteListaItem[]; total: number; podePii: boolean }> => {
    const { supabase, userId } = context;
    const podePii = await temPii(supabase, userId);
    const from = (data.pagina - 1) * data.porPagina;
    const to = from + data.porPagina - 1;

    let query = supabase
      .from("clientes")
      .select(
        "id, numero_cliente, nome, documento, telefone_celular, email, ativo, portal_acesso_ativo, responsavel:profiles!clientes_responsavel_id_fkey(nome), cliente_pipeline(ultima_atualizacao_em, pipeline_stages(codigo, nome))",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.q && data.q.trim()) {
      const term = data.q.trim();
      const dig = term.replace(/\D/g, "");
      const ors = [`nome.ilike.%${term}%`, `email.ilike.%${term}%`];
      if (dig) ors.push(`documento.ilike.%${dig}%`);
      query = query.or(ors.join(","));
    }

    const { data: rows, count, error } = await query;
    if (error) throw error;

    let itens = (rows ?? []).map((r: any): ClienteListaItem => ({
      id: r.id,
      numero_cliente: r.numero_cliente,
      nome: r.nome,
      documento: r.documento,
      documento_masc: !podePii,
      telefone_celular: r.telefone_celular,
      email: r.email,
      etapa_codigo: r.cliente_pipeline?.pipeline_stages?.codigo ?? null,
      etapa_nome: r.cliente_pipeline?.pipeline_stages?.nome ?? null,
      ultima_atualizacao: r.cliente_pipeline?.ultima_atualizacao_em ?? null,
      responsavel_nome: r.responsavel?.nome ?? null,
      ativo: r.ativo,
      portal_acesso_ativo: r.portal_acesso_ativo,
    }));

    if (data.etapa) itens = itens.filter((i) => i.etapa_codigo === data.etapa);

    return { itens, total: count ?? itens.length, podePii };
  });

const clienteInputSchema = z.object({
  tipo_pessoa: z.enum(["PF", "PJ"]),
  nome: z.string().min(2, "Informe o nome completo."),
  documento: z.string().min(11, "Documento inválido."),
  documento_secundario: z.string().optional().nullable(),
  data_nascimento: z.string().min(1, "Informe a data."),
  estado_civil: z.enum(["solteiro", "casado", "uniao_estavel", "divorciado", "viuvo"]),
  regime_casamento: z
    .enum(["comunhao_parcial", "comunhao_universal", "separacao_total", "participacao_final", "nao_aplicavel"])
    .optional()
    .nullable(),
  mae: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido."),
  telefone_celular: z.string().min(10, "Celular inválido."),
  renda_total_declarada: z.number().nonnegative(),
  uf_interesse: z.string().length(2).optional().nullable(),
  origem: z.enum(["direto", "parceiro", "indicacao", "importacao"]).default("direto"),
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

    const { data: novo, error } = await supabase
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
        email: data.email.toLowerCase(),
        telefone_celular: data.telefone_celular,
        renda_total_declarada: data.renda_total_declarada,
        uf_interesse: data.uf_interesse ?? null,
        origem: data.origem,
        responsavel_id: userId,
        criador_id: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: novo.id };
  });

/** Atualiza dados do cliente. */
export const atualizarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clienteInputSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
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
        email: campos.email.toLowerCase(),
        telefone_celular: campos.telefone_celular,
        renda_total_declarada: campos.renda_total_declarada,
        uf_interesse: campos.uf_interesse ?? null,
        origem: campos.origem,
      })
      .eq("id", id);
    if (error) throw error;
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
      .select("*, responsavel:profiles!clientes_responsavel_id_fkey(nome), cliente_pipeline(pipeline_stages(codigo))")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!cliente) throw new Error("Cliente não encontrado.");
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
  clientes: { id: string; nome: string; numero_cliente: string }[];
}

/** Kanban da esteira: etapas com clientes posicionados (RLS aplica escopo). */
export const listarPainel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ desde: z.string().optional(), ate: z.string().optional() }).optional().parse(d) ?? {},
  )
  .handler(async ({ data, context }): Promise<PainelStage[]> => {
    const { supabase } = context;
    const desde = data?.desde ? new Date(data.desde).getTime() : null;
    const ate = data?.ate ? new Date(`${data.ate}T23:59:59.999`).getTime() : null;
    const { data: stages, error: e1 } = await supabase
      .from("pipeline_stages")
      .select("codigo, nome, ordem")
      .order("ordem");
    if (e1) throw e1;
    const { data: rows, error: e2 } = await supabase
      .from("clientes")
      .select("id, nome, numero_cliente, cliente_pipeline(ultima_atualizacao_em, pipeline_stages(codigo))")
      .eq("ativo", true)
      .order("nome");
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
    return (stages ?? []).map((s) => ({
      codigo: s.codigo,
      nome: s.nome,
      ordem: s.ordem,
      clientes: filtradas
        .filter((r: any) => r.cliente_pipeline?.pipeline_stages?.codigo === s.codigo)
        .map((r: any) => ({ id: r.id, nome: r.nome, numero_cliente: r.numero_cliente })),
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
      const { error } = await supabase.from("cliente_enderecos").update(payload).eq("id", existente.id);
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

/** Registra interação manual (nenhum disparo automático). */
export const registrarInteracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        canal: z.enum(["ligacao", "whatsapp", "email", "reuniao", "presencial", "followup", "outro"]),
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
        categoria: z.enum(["comprador", "conjuge", "vendedor", "imovel", "outros"]),
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
    return rows ?? [];
  });

/** Aprova/reprova documento. */
export const revisarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["aprovado", "reprovado"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
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

/** Move etapa manualmente (respeita regra de não retroceder). */
export const moverEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cliente_id: z.string().uuid(), codigo_destino: z.string(), observacao: z.string().optional() }).parse(d),
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
    const { error } = await context.supabase.from("clientes").delete().eq("id", data.id);
    if (error) throw error;
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
  nome: string | null;
  email: string | null;
  created_at: string;
}

/** Lista os parceiros/usuários vinculados a um cliente. */
export const listarVinculosCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<VinculoParceiro[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("cliente_parceiros")
      .select("id, parceiro_id, created_at")
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
      nome: mapa.get(r.parceiro_id)?.nome ?? null,
      email: mapa.get(r.parceiro_id)?.email ?? null,
      created_at: r.created_at,
    }));
  });

/** Lista usuários do sistema disponíveis para vincular (mesmo correspondente). */
export const listarParceirosDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; nome: string | null; email: string | null }[]> => {
    const { supabase, userId } = context;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    let query = supabase.from("profiles").select("id, nome, email").order("nome");
    if (corr) query = query.eq("correspondente_id", corr);
    const { data, error } = await query.limit(500);
    if (error) throw error;
    return (data ?? []) as any;
  });

/** Cria um vínculo de atendimento entre o cliente e um usuário/parceiro. */
export const vincularParceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cliente_id: z.string().uuid(), parceiro_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    if (!corr) throw new Error("Sem correspondente.");
    const { error } = await supabase
      .from("cliente_parceiros")
      .insert({ cliente_id: data.cliente_id, parceiro_id: data.parceiro_id, correspondente_id: corr });
    if (error) {
      if ((error as any).code === "23505") throw new Error("Este usuário já está vinculado.");
      throw error;
    }
    return { ok: true };
  });

/** Remove um vínculo de atendimento. */
export const desvincularParceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("cliente_parceiros").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * RH · Fases 2-5 (submódulos operacionais)
 * Documentos, ocorrências, férias, benefícios, alterações salariais,
 * adiantamentos, descontos, holerites.
 * Todas as funções escopadas por correspondente via RLS.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Tipos compartilhados
// ============================================================

export type OcorrenciaTipo =
  | "falta"
  | "atestado"
  | "advertencia"
  | "licenca"
  | "suspensao"
  | "elogio"
  | "outro";

export type FeriasStatus =
  | "planejada"
  | "aprovada"
  | "em_curso"
  | "concluida"
  | "cancelada";

export type LancamentoStatus = "previsto" | "descontado" | "pago" | "cancelado";

export interface FuncionarioResumo {
  id: string;
  nome: string;
  numero: string;
  cargo: string | null;
  salario_atual: number;
}

async function funcResumo(supabase: any, ids: string[]) {
  if (ids.length === 0) return new Map<string, FuncionarioResumo>();
  const { data } = await supabase
    .from("rh_funcionarios")
    .select("id, nome, numero, salario_atual, rh_cargos(nome)")
    .in("id", ids);
  const map = new Map<string, FuncionarioResumo>();
  (data ?? []).forEach((r: any) =>
    map.set(r.id, {
      id: r.id,
      nome: r.nome,
      numero: r.numero,
      cargo: r.rh_cargos?.nome ?? null,
      salario_atual: Number(r.salario_atual ?? 0),
    }),
  );
  return map;
}

/** Lista simplificada de funcionários ativos para pickers. */
export const listarFuncionariosAtivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FuncionarioResumo[]> => {
    const { data, error } = await context.supabase
      .from("rh_funcionarios")
      .select("id, nome, numero, salario_atual, rh_cargos(nome)")
      .is("deletado_em", null)
      .neq("status", "desligado")
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      numero: r.numero,
      cargo: r.rh_cargos?.nome ?? null,
      salario_atual: Number(r.salario_atual ?? 0),
    }));
  });

async function correspondenteId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  const cid = data?.correspondente_id as string | undefined;
  if (!cid) throw new Error("Correspondente do usuário não encontrado.");
  return cid;
}

// ============================================================
// DOCUMENTOS DO FUNCIONÁRIO
// ============================================================

export interface RhDocumento {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  tipo: string;
  descricao: string | null;
  arquivo_path: string;
  arquivo_nome: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  validade: string | null;
  ativo: boolean;
  created_at: string;
}

export const listarDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid().optional(),
        tipo: z.string().optional(),
        somente_vencidos: z.boolean().optional(),
      })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<RhDocumento[]> => {
    let q = context.supabase
      .from("rh_documentos")
      .select(
        `id, funcionario_id, tipo, descricao, arquivo_path, arquivo_nome,
         mime_type, tamanho_bytes, validade, ativo, created_at,
         rh_funcionarios(nome)`,
      )
      .eq("ativo", true)
      .order("created_at", { ascending: false });
    if (data.funcionario_id) q = q.eq("funcionario_id", data.funcionario_id);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.somente_vencidos) q = q.lte("validade", new Date().toISOString().slice(0, 10));
    const { data: rows, error } = await q.limit(1000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      funcionario_id: r.funcionario_id,
      funcionario_nome: r.rh_funcionarios?.nome ?? "—",
      tipo: r.tipo,
      descricao: r.descricao,
      arquivo_path: r.arquivo_path,
      arquivo_nome: r.arquivo_nome,
      mime_type: r.mime_type,
      tamanho_bytes: r.tamanho_bytes,
      validade: r.validade,
      ativo: r.ativo,
      created_at: r.created_at,
    }));
  });

export const registrarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid(),
        tipo: z.string().min(1),
        descricao: z.string().optional().nullable(),
        arquivo_path: z.string().min(1),
        arquivo_nome: z.string().min(1),
        mime_type: z.string().optional().nullable(),
        tamanho_bytes: z.number().optional().nullable(),
        validade: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("rh_documentos")
      .insert({
        correspondente_id: cid,
        funcionario_id: data.funcionario_id,
        tipo: data.tipo,
        descricao: data.descricao || null,
        arquivo_path: data.arquivo_path,
        arquivo_nome: data.arquivo_nome,
        mime_type: data.mime_type || null,
        tamanho_bytes: data.tamanho_bytes || null,
        validade: data.validade || null,
        uploaded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const excluirDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rh_documentos")
      .update({ ativo: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const gerarUrlAssinada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ path: z.string().min(1), expira_em: z.number().default(300) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("rh-documentos")
      .createSignedUrl(data.path, data.expira_em);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

// ============================================================
// OCORRÊNCIAS
// ============================================================

export interface RhOcorrencia {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  tipo: OcorrenciaTipo;
  data_inicio: string;
  data_fim: string | null;
  dias: number | null;
  cid: string | null;
  justificativa: string | null;
  abonada: boolean;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  created_at: string;
}

export const listarOcorrencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid().optional(),
        tipo: z.string().optional(),
        desde: z.string().optional(),
        ate: z.string().optional(),
      })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<RhOcorrencia[]> => {
    let q = context.supabase
      .from("rh_ocorrencias")
      .select(
        `id, funcionario_id, tipo, data_inicio, data_fim, dias, cid, justificativa,
         abonada, arquivo_path, arquivo_nome, created_at, rh_funcionarios(nome)`,
      )
      .order("data_inicio", { ascending: false });
    if (data.funcionario_id) q = q.eq("funcionario_id", data.funcionario_id);
    if (data.tipo) q = q.eq("tipo", data.tipo as OcorrenciaTipo);
    if (data.desde) q = q.gte("data_inicio", data.desde);
    if (data.ate) q = q.lte("data_inicio", data.ate);
    const { data: rows, error } = await q.limit(1000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      funcionario_id: r.funcionario_id,
      funcionario_nome: r.rh_funcionarios?.nome ?? "—",
      tipo: r.tipo,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      dias: r.dias,
      cid: r.cid,
      justificativa: r.justificativa,
      abonada: r.abonada,
      arquivo_path: r.arquivo_path,
      arquivo_nome: r.arquivo_nome,
      created_at: r.created_at,
    }));
  });

export const registrarOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        funcionario_id: z.string().uuid(),
        tipo: z.enum([
          "falta",
          "atestado",
          "advertencia",
          "licenca",
          "suspensao",
          "elogio",
          "outro",
        ]),
        data_inicio: z.string(),
        data_fim: z.string().optional().nullable(),
        dias: z.number().optional().nullable(),
        cid: z.string().optional().nullable(),
        justificativa: z.string().optional().nullable(),
        abonada: z.boolean().default(false),
        arquivo_path: z.string().optional().nullable(),
        arquivo_nome: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const payload = {
      correspondente_id: cid,
      funcionario_id: data.funcionario_id,
      tipo: data.tipo,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim || null,
      dias: data.dias ?? null,
      cid: data.cid || null,
      justificativa: data.justificativa || null,
      abonada: data.abonada,
      arquivo_path: data.arquivo_path || null,
      arquivo_nome: data.arquivo_nome || null,
      criado_por: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("rh_ocorrencias")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("rh_ocorrencias")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const excluirOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rh_ocorrencias")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// FÉRIAS
// ============================================================

export interface RhFerias {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  data_inicio: string | null;
  data_fim: string | null;
  dias_gozados: number;
  abono_dias: number;
  adiantar_13o: boolean;
  status: FeriasStatus;
  observacoes: string | null;
  created_at: string;
}

export const listarFerias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid().optional(),
        status: z.string().optional(),
      })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<RhFerias[]> => {
    let q = context.supabase
      .from("rh_ferias")
      .select(
        `id, funcionario_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim,
         data_inicio, data_fim, dias_gozados, abono_dias, adiantar_13o, status,
         observacoes, created_at, rh_funcionarios(nome)`,
      )
      .order("periodo_aquisitivo_inicio", { ascending: false });
    if (data.funcionario_id) q = q.eq("funcionario_id", data.funcionario_id);
    if (data.status) q = q.eq("status", data.status as FeriasStatus);
    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      funcionario_id: r.funcionario_id,
      funcionario_nome: r.rh_funcionarios?.nome ?? "—",
      periodo_aquisitivo_inicio: r.periodo_aquisitivo_inicio,
      periodo_aquisitivo_fim: r.periodo_aquisitivo_fim,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      dias_gozados: r.dias_gozados,
      abono_dias: r.abono_dias,
      adiantar_13o: r.adiantar_13o,
      status: r.status,
      observacoes: r.observacoes,
      created_at: r.created_at,
    }));
  });

export const salvarFerias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        funcionario_id: z.string().uuid(),
        periodo_aquisitivo_inicio: z.string(),
        periodo_aquisitivo_fim: z.string(),
        data_inicio: z.string().optional().nullable(),
        data_fim: z.string().optional().nullable(),
        dias_gozados: z.number().min(1).max(30).default(30),
        abono_dias: z.number().min(0).max(10).default(0),
        adiantar_13o: z.boolean().default(false),
        status: z.enum([
          "planejada",
          "aprovada",
          "em_curso",
          "concluida",
          "cancelada",
        ]),
        observacoes: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const payload = {
      correspondente_id: cid,
      funcionario_id: data.funcionario_id,
      periodo_aquisitivo_inicio: data.periodo_aquisitivo_inicio,
      periodo_aquisitivo_fim: data.periodo_aquisitivo_fim,
      data_inicio: data.data_inicio || null,
      data_fim: data.data_fim || null,
      dias_gozados: data.dias_gozados,
      abono_dias: data.abono_dias,
      adiantar_13o: data.adiantar_13o,
      status: data.status,
      observacoes: data.observacoes || null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("rh_ferias")
        .update({
          ...payload,
          aprovado_por: data.status === "aprovada" ? context.userId : null,
          aprovado_em: data.status === "aprovada" ? new Date().toISOString() : null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);

      // Refletir status no funcionário
      if (data.status === "em_curso") {
        await context.supabase
          .from("rh_funcionarios")
          .update({ status: "ferias" })
          .eq("id", data.funcionario_id);
      } else if (data.status === "concluida") {
        await context.supabase
          .from("rh_funcionarios")
          .update({ status: "ativo" })
          .eq("id", data.funcionario_id);
      }
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("rh_ferias")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

// ============================================================
// BENEFÍCIOS
// ============================================================

export interface RhBeneficioTipo {
  id: string;
  nome: string;
  descricao: string | null;
  valor_padrao: number;
  desconto_padrao: number;
  natureza: string;
  ativo: boolean;
}

export interface RhFuncionarioBeneficio {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  tipo_id: string;
  tipo_nome: string;
  valor: number;
  desconto: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean;
  observacoes: string | null;
}

export const listarBeneficiosTipos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RhBeneficioTipo[]> => {
    const { data, error } = await context.supabase
      .from("rh_beneficios_tipos")
      .select("id, nome, descricao, valor_padrao, desconto_padrao, natureza, ativo")
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as RhBeneficioTipo[];
  });

export const salvarBeneficioTipo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nome: z.string().min(1),
        descricao: z.string().optional().nullable(),
        valor_padrao: z.number().min(0).default(0),
        desconto_padrao: z.number().min(0).default(0),
        natureza: z.string().default("beneficio"),
        ativo: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    if (data.id) {
      const { error } = await context.supabase
        .from("rh_beneficios_tipos")
        .update({
          nome: data.nome,
          descricao: data.descricao || null,
          valor_padrao: data.valor_padrao,
          desconto_padrao: data.desconto_padrao,
          natureza: data.natureza,
          ativo: data.ativo,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("rh_beneficios_tipos")
      .insert({ correspondente_id: cid, ...data })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const listarBeneficiosDoFuncionario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ funcionario_id: z.string().uuid().optional() })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<RhFuncionarioBeneficio[]> => {
    let q = context.supabase
      .from("rh_funcionario_beneficios")
      .select(
        `id, funcionario_id, tipo_id, valor, desconto, vigencia_inicio, vigencia_fim,
         ativo, observacoes, rh_funcionarios(nome), rh_beneficios_tipos(nome)`,
      )
      .order("vigencia_inicio", { ascending: false });
    if (data.funcionario_id) q = q.eq("funcionario_id", data.funcionario_id);
    const { data: rows, error } = await q.limit(1000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      funcionario_id: r.funcionario_id,
      funcionario_nome: r.rh_funcionarios?.nome ?? "—",
      tipo_id: r.tipo_id,
      tipo_nome: r.rh_beneficios_tipos?.nome ?? "—",
      valor: Number(r.valor ?? 0),
      desconto: Number(r.desconto ?? 0),
      vigencia_inicio: r.vigencia_inicio,
      vigencia_fim: r.vigencia_fim,
      ativo: r.ativo,
      observacoes: r.observacoes,
    }));
  });

export const vincularBeneficio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        funcionario_id: z.string().uuid(),
        tipo_id: z.string().uuid(),
        valor: z.number().min(0),
        desconto: z.number().min(0).default(0),
        vigencia_inicio: z.string(),
        vigencia_fim: z.string().optional().nullable(),
        ativo: z.boolean().default(true),
        observacoes: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    if (data.id) {
      const { error } = await context.supabase
        .from("rh_funcionario_beneficios")
        .update({
          tipo_id: data.tipo_id,
          valor: data.valor,
          desconto: data.desconto,
          vigencia_inicio: data.vigencia_inicio,
          vigencia_fim: data.vigencia_fim || null,
          ativo: data.ativo,
          observacoes: data.observacoes || null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("rh_funcionario_beneficios")
      .insert({ correspondente_id: cid, ...data })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

// ============================================================
// ALTERAÇÕES SALARIAIS
// ============================================================

export interface RhAlteracaoSalarial {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  salario_anterior: number;
  salario_novo: number;
  motivo: string | null;
  tipo: string | null;
  vigencia: string;
  created_at: string;
}

export const listarAlteracoesSalariais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ funcionario_id: z.string().uuid().optional() })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<RhAlteracaoSalarial[]> => {
    let q = context.supabase
      .from("rh_alteracoes_salariais")
      .select(
        `id, funcionario_id, salario_anterior, salario_novo, motivo, tipo,
         vigencia, created_at, rh_funcionarios(nome)`,
      )
      .order("vigencia", { ascending: false });
    if (data.funcionario_id) q = q.eq("funcionario_id", data.funcionario_id);
    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      funcionario_id: r.funcionario_id,
      funcionario_nome: r.rh_funcionarios?.nome ?? "—",
      salario_anterior: Number(r.salario_anterior ?? 0),
      salario_novo: Number(r.salario_novo ?? 0),
      motivo: r.motivo,
      tipo: r.tipo,
      vigencia: r.vigencia,
      created_at: r.created_at,
    }));
  });

export const registrarAlteracaoSalarial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid(),
        salario_novo: z.number().min(0),
        motivo: z.string().optional().nullable(),
        tipo: z.string().optional().nullable(),
        vigencia: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const { data: func } = await context.supabase
      .from("rh_funcionarios")
      .select("salario_atual")
      .eq("id", data.funcionario_id)
      .maybeSingle();
    const anterior = Number(func?.salario_atual ?? 0);
    const { data: row, error } = await context.supabase
      .from("rh_alteracoes_salariais")
      .insert({
        correspondente_id: cid,
        funcionario_id: data.funcionario_id,
        salario_anterior: anterior,
        salario_novo: data.salario_novo,
        motivo: data.motivo || null,
        tipo: data.tipo || null,
        vigencia: data.vigencia,
        aprovado_por: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

// ============================================================
// ADIANTAMENTOS
// ============================================================

export interface RhLancamento {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  data: string;
  valor: number;
  competencia_mes: number;
  competencia_ano: number;
  status: LancamentoStatus;
  descricao: string | null;
}

async function listarLancamentos(
  supabase: any,
  tabela: "rh_adiantamentos" | "rh_descontos",
  filtros: {
    funcionario_id?: string;
    competencia_mes?: number;
    competencia_ano?: number;
  },
): Promise<RhLancamento[]> {
  let q = supabase
    .from(tabela)
    .select(
      `id, funcionario_id, data, valor, competencia_mes, competencia_ano,
       status, ${tabela === "rh_adiantamentos" ? "descricao" : "motivo"}, rh_funcionarios(nome)`,
    )
    .order("data", { ascending: false });
  if (filtros.funcionario_id) q = q.eq("funcionario_id", filtros.funcionario_id);
  if (filtros.competencia_mes) q = q.eq("competencia_mes", filtros.competencia_mes);
  if (filtros.competencia_ano) q = q.eq("competencia_ano", filtros.competencia_ano);
  const { data, error } = await q.limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    funcionario_id: r.funcionario_id,
    funcionario_nome: r.rh_funcionarios?.nome ?? "—",
    data: r.data,
    valor: Number(r.valor ?? 0),
    competencia_mes: r.competencia_mes,
    competencia_ano: r.competencia_ano,
    status: r.status,
    descricao: (r.descricao ?? r.motivo) as string | null,
  }));
}

const lancamentoInput = z.object({
  id: z.string().uuid().optional(),
  funcionario_id: z.string().uuid(),
  data: z.string(),
  valor: z.number().min(0),
  competencia_mes: z.number().min(1).max(12),
  competencia_ano: z.number().min(2020).max(2100),
  descricao: z.string().optional().nullable(),
  status: z
    .enum(["previsto", "descontado", "pago", "cancelado"])
    .default("previsto"),
});

export const listarAdiantamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid().optional(),
        competencia_mes: z.number().optional(),
        competencia_ano: z.number().optional(),
      })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) =>
    listarLancamentos(context.supabase, "rh_adiantamentos", data),
  );

export const registrarAdiantamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => lancamentoInput.parse(data))
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const payload = {
      correspondente_id: cid,
      funcionario_id: data.funcionario_id,
      data: data.data,
      valor: data.valor,
      competencia_mes: data.competencia_mes,
      competencia_ano: data.competencia_ano,
      descricao: data.descricao || null,
      status: data.status,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("rh_adiantamentos")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("rh_adiantamentos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

// ============================================================
// DESCONTOS
// ============================================================

export const listarDescontos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid().optional(),
        competencia_mes: z.number().optional(),
        competencia_ano: z.number().optional(),
      })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) =>
    listarLancamentos(context.supabase, "rh_descontos", data),
  );

export const registrarDesconto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => lancamentoInput.parse(data))
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const payload = {
      correspondente_id: cid,
      funcionario_id: data.funcionario_id,
      data: data.data,
      valor: data.valor,
      competencia_mes: data.competencia_mes,
      competencia_ano: data.competencia_ano,
      motivo: data.descricao || null,
      status: data.status,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("rh_descontos")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("rh_descontos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

// ============================================================
// HOLERITES
// ============================================================

export interface RhHolerite {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  competencia_id: string | null;
  mes: number;
  ano: number;
  arquivo_path: string;
  arquivo_nome: string;
  valor_liquido: number | null;
  created_at: string;
}

export const listarHolerites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid().optional(),
        ano: z.number().optional(),
        mes: z.number().optional(),
      })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<RhHolerite[]> => {
    let q = context.supabase
      .from("rh_holerites")
      .select(
        `id, funcionario_id, competencia_id, mes, ano, arquivo_path, arquivo_nome,
         valor_liquido, created_at, rh_funcionarios(nome)`,
      )
      .order("ano", { ascending: false })
      .order("mes", { ascending: false });
    if (data.funcionario_id) q = q.eq("funcionario_id", data.funcionario_id);
    if (data.ano) q = q.eq("ano", data.ano);
    if (data.mes) q = q.eq("mes", data.mes);
    const { data: rows, error } = await q.limit(1000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      funcionario_id: r.funcionario_id,
      funcionario_nome: r.rh_funcionarios?.nome ?? "—",
      competencia_id: r.competencia_id,
      mes: r.mes,
      ano: r.ano,
      arquivo_path: r.arquivo_path,
      arquivo_nome: r.arquivo_nome,
      valor_liquido: r.valor_liquido !== null ? Number(r.valor_liquido) : null,
      created_at: r.created_at,
    }));
  });

export const anexarHolerite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid(),
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
        competencia_id: z.string().uuid().optional().nullable(),
        arquivo_path: z.string().min(1),
        arquivo_nome: z.string().min(1),
        valor_liquido: z.number().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("rh_holerites")
      .upsert(
        {
          correspondente_id: cid,
          funcionario_id: data.funcionario_id,
          mes: data.mes,
          ano: data.ano,
          competencia_id: data.competencia_id || null,
          arquivo_path: data.arquivo_path,
          arquivo_nome: data.arquivo_nome,
          valor_liquido: data.valor_liquido ?? null,
          gerado_por: context.userId,
        },
        { onConflict: "funcionario_id,ano,mes" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

// Exporta helper para uso em componentes
export { funcResumo };

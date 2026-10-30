/**
 * RH · submódulos operacionais: documentos, ocorrências, férias, benefícios,
 * alterações salariais, adiantamentos e holerites.
 *
 * Cada função confere a permissão do módulo na entrada (`exigirPermissao`, as mesmas
 * ações do catálogo) e a RLS confere de novo no banco, com a empresa. Lançamentos do
 * mês (horas extras, descontos…) moram em `folha.functions.ts`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { hojeISO } from "@/lib/financeiro/format";
import { correspondenteId } from "@/lib/rh/acesso";

/**
 * A RLS não dá erro quando bloqueia um UPDATE/DELETE: simplesmente não mexe
 * em nenhuma linha. Sem conferir, a tela mostrava "salvo"/"excluído" à toa.
 */
const SEM_PERMISSAO = "Você não tem permissão para alterar este registro.";

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

export type FeriasStatus = "planejada" | "aprovada" | "em_curso" | "concluida" | "cancelada";

export type LancamentoStatus = "previsto" | "recebido" | "descontado" | "pago" | "cancelado";

/** Resumo para seletores: sem salário (quem só vê a ficha também usa). */
export interface FuncionarioResumo {
  id: string;
  nome: string;
  numero: string;
  cargo: string | null;
}

/** Lista simplificada de funcionários ativos para seletores. */
export const listarFuncionariosAtivos = createServerFn({ method: "GET" })
  .middleware([
    exigirPermissao(
      ["rh.funcionarios", "view"],
      ["rh.folha", "view"],
      ["rh.ferias", "view"],
      ["rh.ocorrencias", "view"],
      ["rh.documentos", "view"],
      ["rh.beneficios", "view"],
    ),
  ])
  .handler(async ({ context }): Promise<FuncionarioResumo[]> => {
    const { data, error } = await context.supabase
      .from("rh_funcionarios")
      .select("id, nome, numero, rh_cargos(nome)")
      .is("deletado_em", null)
      .neq("status", "desligado")
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      numero: r.numero,
      cargo: r.rh_cargos?.nome ?? null,
    }));
  });

/**
 * Apaga um arquivo do bucket do RH depois que o registro já saiu do banco.
 * Falha aqui não desfaz a exclusão: devolve false para a tela avisar.
 */
export async function apagarArquivoRh(supabase: any, path: string | null | undefined) {
  if (!path) return true;
  const { data, error } = await supabase.storage.from("rh-documentos").remove([path]);
  if (error) {
    console.error("[rh] arquivo não apagado do bucket", path, error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
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
  .middleware([exigirPermissao(["rh.documentos", "view"])])
  .validator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid().optional(),
        tipo: z.string().optional(),
        somente_vencidos: z.boolean().optional(),
        /** Vence até esta data (yyyy-mm-dd) — "documentos vencendo". */
        vence_ate: z.string().optional(),
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
    if (data.somente_vencidos) q = q.lte("validade", hojeISO());
    if (data.vence_ate) q = q.not("validade", "is", null).lte("validade", data.vence_ate);
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
  .middleware([exigirPermissao(["rh.documentos", "create"])])
  .validator((data: unknown) =>
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
  .middleware([exigirPermissao(["rh.documentos", "delete"])])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rh_documentos")
      .update({ ativo: false })
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error(SEM_PERMISSAO);
    return { ok: true };
  });

/** URL temporária de um arquivo do RH. A política do bucket decide quem abre cada pasta. */
export const gerarUrlAssinada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ path: z.string().min(1).max(500), expira_em: z.number().int().min(30).max(3600).default(300) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("rh-documentos")
      .createSignedUrl(data.path, data.expira_em);
    if (error || !signed) throw new Error("Arquivo não encontrado ou sem permissão.");
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
  .middleware([exigirPermissao(["rh.ocorrencias", "view"])])
  .validator((data: unknown) =>
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
  .middleware([exigirPermissao(["rh.ocorrencias", "create"], ["rh.ocorrencias", "edit"])])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        funcionario_id: z.string().uuid(),
        tipo: z.enum(["falta", "atestado", "advertencia", "licenca", "suspensao", "elogio", "outro"]),
        data_inicio: z.string(),
        data_fim: z.string().optional().nullable(),
        dias: z.number().optional().nullable(),
        cid: z.string().optional().nullable(),
        justificativa: z.string().optional().nullable(),
        abonada: z.boolean().default(false),
        arquivo_path: z.string().optional().nullable(),
        arquivo_nome: z.string().optional().nullable(),
      })
      .refine((d) => !d.data_fim || !d.data_inicio || d.data_fim >= d.data_inicio, {
        message: "A data final não pode ser antes da inicial.",
        path: ["data_fim"],
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
      const { data: rows, error } = await context.supabase
        .from("rh_ocorrencias")
        .update(payload)
        .eq("id", data.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new Error(SEM_PERMISSAO);
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
  .middleware([exigirPermissao(["rh.ocorrencias", "edit"])])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rh_ocorrencias")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error(SEM_PERMISSAO);
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
  .middleware([exigirPermissao(["rh.ferias", "view"], ["rh.funcionarios", "view"])])
  .validator((data: unknown) =>
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

/**
 * Programar (planejada/cancelada) exige "programar"; aprovar, pôr em curso e concluir
 * exigem "aprovar" — conferido aqui e no gatilho do banco.
 */
export const salvarFerias = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.ferias", "create"], ["rh.ferias", "edit"])])
  .validator((data: unknown) =>
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
        status: z.enum(["planejada", "aprovada", "em_curso", "concluida", "cancelada"]),
        observacoes: z.string().optional().nullable(),
      })
      .refine((d) => !d.data_fim || !d.data_inicio || d.data_fim >= d.data_inicio, {
        message: "O fim das férias não pode ser antes do início.",
        path: ["data_fim"],
      })
      .refine((d) => d.dias_gozados + d.abono_dias <= 30, {
        message: "Gozo + abono não passam de 30 dias.",
        path: ["abono_dias"],
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { pode } = await import("@/lib/rh/acesso");
    const aprova = ["aprovada", "em_curso", "concluida"].includes(data.status);
    if (aprova && !(await pode(context.supabase, context.userId, "rh.ferias", "edit"))) {
      throw new Error("Só quem aprova férias (RH · Férias · aprovar) pode aprovar ou concluir.");
    }
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
      const { data: rows, error } = await context.supabase
        .from("rh_ferias")
        .update(payload)
        .eq("id", data.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new Error(SEM_PERMISSAO);

      // Refletir status no funcionário
      if (data.status === "em_curso" || data.status === "concluida") {
        await context.supabase
          .from("rh_funcionarios")
          .update({ status: data.status === "em_curso" ? "ferias" : "ativo" })
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
  .middleware([exigirPermissao(["rh.beneficios", "view"], ["rh.funcionarios", "view"])])
  .handler(async ({ context }): Promise<RhBeneficioTipo[]> => {
    const { data, error } = await context.supabase
      .from("rh_beneficios_tipos")
      .select("id, nome, descricao, valor_padrao, desconto_padrao, natureza, ativo")
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as RhBeneficioTipo[];
  });

export const salvarBeneficioTipo = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.beneficios", "edit"])])
  .validator((data: unknown) =>
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
      const { data: rows, error } = await context.supabase
        .from("rh_beneficios_tipos")
        .update({
          nome: data.nome,
          descricao: data.descricao || null,
          valor_padrao: data.valor_padrao,
          desconto_padrao: data.desconto_padrao,
          natureza: data.natureza,
          ativo: data.ativo,
        })
        .eq("id", data.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new Error(SEM_PERMISSAO);
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
  .middleware([exigirPermissao(["rh.beneficios", "view"], ["rh.funcionarios", "view"])])
  .validator((data: unknown) =>
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
  .middleware([exigirPermissao(["rh.beneficios", "edit"])])
  .validator((data: unknown) =>
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
      .refine((d) => !d.vigencia_fim || !d.vigencia_inicio || d.vigencia_fim >= d.vigencia_inicio, {
        message: "O fim da vigência não pode ser antes do início.",
        path: ["vigencia_fim"],
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    if (data.id) {
      // Campo ausente não é campo vazio: só regrava observações quando vierem.
      const { data: rows, error } = await context.supabase
        .from("rh_funcionario_beneficios")
        .update({
          tipo_id: data.tipo_id,
          valor: data.valor,
          desconto: data.desconto,
          vigencia_inicio: data.vigencia_inicio,
          vigencia_fim: data.vigencia_fim || null,
          ativo: data.ativo,
          ...(data.observacoes !== undefined ? { observacoes: data.observacoes || null } : {}),
        })
        .eq("id", data.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new Error(SEM_PERMISSAO);
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
// ALTERAÇÕES SALARIAIS (salário = rh.salarios)
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
  .middleware([exigirPermissao(["rh.salarios", "view"])])
  .validator((data: unknown) =>
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
  .middleware([exigirPermissao(["rh.salarios", "edit"])])
  .validator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid(),
        salario_novo: z.number().positive("Novo salário deve ser maior que zero."),
        motivo: z.string().optional().nullable(),
        tipo: z.string().optional().nullable(),
        vigencia: z
          .string()
          .refine((s) => !Number.isNaN(new Date(s + "T00:00:00").getTime()), "Vigência inválida."),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { dadosSensiveis } = await import("@/lib/rh/acesso");
    const cid = await correspondenteId(context.supabase, context.userId);
    const { data: func } = await context.supabase
      .from("rh_funcionarios")
      .select("id, data_admissao")
      .eq("id", data.funcionario_id)
      .maybeSingle();
    if (!func) throw new Error("Funcionário não encontrado.");
    const anterior = (await dadosSensiveis(context.supabase, [data.funcionario_id])).get(data.funcionario_id)
      ?.salario_atual ?? 0;
    if (func.data_admissao && data.vigencia < func.data_admissao) {
      throw new Error("Vigência não pode ser anterior à admissão do funcionário.");
    }
    if (Math.abs(data.salario_novo - anterior) < 0.01) {
      throw new Error("O novo salário é igual ao atual — nenhuma alteração a registrar.");
    }

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
// ADIANTAMENTOS (folha)
// ============================================================

export interface RhAdiantamento {
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

export const listarAdiantamentos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.folha", "view"])])
  .validator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid().optional(),
        competencia_mes: z.number().optional(),
        competencia_ano: z.number().optional(),
      })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<RhAdiantamento[]> => {
    let q = context.supabase
      .from("rh_adiantamentos")
      .select(
        "id, funcionario_id, data, valor, competencia_mes, competencia_ano, status, descricao, rh_funcionarios(nome)",
      )
      .order("data", { ascending: false });
    if (data.funcionario_id) q = q.eq("funcionario_id", data.funcionario_id);
    if (data.competencia_mes) q = q.eq("competencia_mes", data.competencia_mes);
    if (data.competencia_ano) q = q.eq("competencia_ano", data.competencia_ano);
    const { data: rows, error } = await q.limit(1000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      funcionario_id: r.funcionario_id,
      funcionario_nome: r.rh_funcionarios?.nome ?? "—",
      data: r.data,
      valor: Number(r.valor ?? 0),
      competencia_mes: r.competencia_mes,
      competencia_ano: r.competencia_ano,
      status: r.status,
      descricao: r.descricao,
    }));
  });

/**
 * Espelha um adiantamento em contas a pagar (origem_tipo = "rh_adiantamento").
 * Mantém uma única conta por adiantamento; cancelamentos removem a conta
 * ainda em aberto.
 */
async function sincronizarAdiantamentoFinanceiro(
  supabase: any,
  cid: string,
  userId: string,
  adiantamentoId: string,
  input: {
    funcionario_id: string;
    data: string;
    valor: number;
    descricao: string | null;
    status: string;
  },
) {
  const { data: func } = await supabase
    .from("rh_funcionarios")
    .select("nome")
    .eq("id", input.funcionario_id)
    .maybeSingle();
  const nome = func?.nome ?? "Funcionário";
  const { data: existente } = await supabase
    .from("financial_payables")
    .select("id, status")
    .eq("origem_tipo", "rh_adiantamento")
    .eq("origem_ref", adiantamentoId)
    .maybeSingle();

  if (input.status === "cancelado") {
    if (existente && existente.status !== "paga") {
      await supabase.from("financial_payables").delete().eq("id", existente.id);
    }
    return;
  }

  const payload = {
    correspondente_id: cid,
    descricao: `Adiantamento salarial — ${nome}${input.descricao ? ` (${input.descricao})` : ""}`,
    fornecedor: nome,
    valor: input.valor,
    vencimento: input.data,
    origem_tipo: "rh_adiantamento",
    origem_ref: adiantamentoId,
  };

  if (existente) {
    if (existente.status === "paga") return;
    await supabase.from("financial_payables").update(payload).eq("id", existente.id);
    return;
  }
  await supabase.from("financial_payables").insert({ ...payload, criador_id: userId });
}

export const registrarAdiantamento = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.folha", "edit"])])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        funcionario_id: z.string().uuid(),
        data: z.string(),
        valor: z.number().positive("Informe o valor."),
        competencia_mes: z.number().min(1).max(12),
        competencia_ano: z.number().min(2020).max(2100),
        descricao: z.string().optional().nullable(),
        status: z.enum(["previsto", "recebido", "descontado", "pago", "cancelado"]).default("previsto"),
      })
      .parse(data),
  )
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
    let id = data.id;
    if (id) {
      const { data: rows, error } = await context.supabase
        .from("rh_adiantamentos")
        .update(payload)
        .eq("id", id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new Error(SEM_PERMISSAO);
    } else {
      const { data: row, error } = await context.supabase
        .from("rh_adiantamentos")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = row!.id as string;
    }
    // Reflete no Financeiro (contas a pagar). Falhas aqui não invalidam o RH.
    try {
      await sincronizarAdiantamentoFinanceiro(context.supabase, cid, context.userId, id!, {
        funcionario_id: data.funcionario_id,
        data: data.data,
        valor: data.valor,
        descricao: data.descricao || null,
        status: data.status,
      });
    } catch {
      /* silencioso: o adiantamento já foi salvo */
    }
    return { id: id! };
  });

export const excluirAdiantamento = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.folha", "edit"])])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rh_adiantamentos")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error(SEM_PERMISSAO);
    const { data: conta } = await context.supabase
      .from("financial_payables")
      .select("id, status")
      .eq("origem_tipo", "rh_adiantamento")
      .eq("origem_ref", data.id)
      .maybeSingle();
    if (conta && conta.status !== "paga") {
      await context.supabase.from("financial_payables").delete().eq("id", conta.id);
    }
    return { ok: true };
  });

// ============================================================
// HOLERITES (valores = salário: ver exige rh.salarios; gerar exige rh.folha:edit)
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
  /** Dados usados no cálculo (permitem reabrir o holerite para edição). */
  entrada: Record<string, string | number | boolean> | null;
  created_at: string;
}

export const listarHolerites = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.salarios", "view"])])
  .validator((data: unknown) =>
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
         valor_liquido, entrada, created_at, rh_funcionarios(nome)`,
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
      entrada: (r.entrada ?? null) as Record<string, string | number | boolean> | null,
      created_at: r.created_at,
    }));
  });

export const anexarHolerite = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.folha", "edit"])])
  .validator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid(),
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
        competencia_id: z.string().uuid().optional().nullable(),
        arquivo_path: z.string().min(1),
        arquivo_nome: z.string().min(1),
        valor_liquido: z.number().optional().nullable(),
        /** Em edição: atualiza este holerite em vez de procurar pelo mês. */
        id: z.string().uuid().optional(),
        entrada: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: rows, error } = await context.supabase
        .from("rh_holerites")
        .update({
          competencia_id: data.competencia_id || null,
          arquivo_path: data.arquivo_path,
          arquivo_nome: data.arquivo_nome,
          valor_liquido: data.valor_liquido ?? null,
          ...(data.entrada !== undefined ? { entrada: data.entrada } : {}),
          gerado_por: context.userId,
        })
        .eq("id", data.id)
        .eq("funcionario_id", data.funcionario_id)
        .eq("ano", data.ano)
        .eq("mes", data.mes)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new Error(SEM_PERMISSAO);
      return { id: data.id };
    }
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
          ...(data.entrada !== undefined ? { entrada: data.entrada } : {}),
          gerado_por: context.userId,
        },
        { onConflict: "funcionario_id,ano,mes" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const excluirHolerite = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.folha", "edit"])])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Primeiro o registro, depois o PDF: se o registro não sair, o arquivo fica.
    const { data: rows, error } = await context.supabase
      .from("rh_holerites")
      .delete()
      .eq("id", data.id)
      .select("id, arquivo_path");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error(SEM_PERMISSAO);
    const arquivoApagado = await apagarArquivoRh(context.supabase, rows[0].arquivo_path);
    return { ok: true, arquivoApagado };
  });

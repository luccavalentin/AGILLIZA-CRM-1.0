import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Status possível de um funcionário. */
export type StatusFuncionario =
  | "ativo"
  | "experiencia"
  | "afastado"
  | "ferias"
  | "desligado";

export type TipoContrato =
  | "clt"
  | "pj"
  | "estagio"
  | "autonomo"
  | "temporario"
  | "aprendiz";

export interface FuncionarioLista {
  id: string;
  numero: string;
  nome: string;
  cpf: string;
  status: StatusFuncionario;
  tipo_contrato: TipoContrato;
  data_admissao: string;
  fim_experiencia: string | null;
  salario_atual: number;
  cargo_id: string | null;
  cargo_nome: string | null;
  departamento_id: string | null;
  departamento_nome: string | null;
  gestor_id: string | null;
  gestor_nome: string | null;
  email_corporativo: string | null;
  telefone: string | null;
}

export interface Funcionario extends FuncionarioLista {
  nome_social: string | null;
  rg: string | null;
  rg_orgao: string | null;
  rg_uf: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  estado_civil: string | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  nome_mae: string | null;
  nome_pai: string | null;
  email_pessoal: string | null;
  cep: string | null;
  logradouro: string | null;
  numero_endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  matricula: string | null;
  ctps_numero: string | null;
  ctps_serie: string | null;
  ctps_uf: string | null;
  pis: string | null;
  data_demissao: string | null;
  motivo_demissao: string | null;
  jornada_horas_semanais: number | null;
  jornada_descricao: string | null;
  salario_desde: string | null;
  banco_nome: string | null;
  banco_agencia: string | null;
  banco_conta: string | null;
  banco_tipo_conta: string | null;
  banco_pix: string | null;
  observacoes: string | null;
  ativo: boolean;
  user_id: string | null;
  user_nome: string | null;
  user_email: string | null;
}

const funcionarioSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(2, "Informe o nome completo.").transform((v) => v.trim()),
  nome_social: z.string().optional().nullable(),
  cpf: z.string().min(11, "CPF inválido.").transform((v) => v.replace(/\D/g, "")),
  rg: z.string().optional().nullable(),
  rg_orgao: z.string().optional().nullable(),
  rg_uf: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  sexo: z.string().optional().nullable(),
  estado_civil: z.string().optional().nullable(),
  nacionalidade: z.string().optional().nullable(),
  naturalidade: z.string().optional().nullable(),
  nome_mae: z.string().optional().nullable(),
  nome_pai: z.string().optional().nullable(),
  email_pessoal: z.string().email().optional().or(z.literal("")).nullable(),
  telefone: z.string().optional().nullable(),

  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero_endereco: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),

  cargo_id: z.string().uuid().optional().nullable(),
  departamento_id: z.string().uuid().optional().nullable(),
  gestor_id: z.string().uuid().optional().nullable(),
  tipo_contrato: z.enum(["clt", "pj", "estagio", "autonomo", "temporario", "aprendiz"]),
  status: z.enum(["ativo", "experiencia", "afastado", "ferias", "desligado"]).default("experiencia"),
  matricula: z.string().optional().nullable(),
  ctps_numero: z.string().optional().nullable(),
  ctps_serie: z.string().optional().nullable(),
  ctps_uf: z.string().optional().nullable(),
  pis: z.string().optional().nullable(),
  data_admissao: z.string().min(10, "Informe a data de admissão."),
  fim_experiencia: z.string().optional().nullable(),
  data_demissao: z.string().optional().nullable(),
  motivo_demissao: z.string().optional().nullable(),
  jornada_horas_semanais: z.number().optional().nullable(),
  jornada_descricao: z.string().optional().nullable(),
  email_corporativo: z.string().email().optional().or(z.literal("")).nullable(),

  salario_atual: z.number().min(0),
  salario_desde: z.string().optional().nullable(),

  banco_nome: z.string().optional().nullable(),
  banco_agencia: z.string().optional().nullable(),
  banco_conta: z.string().optional().nullable(),
  banco_tipo_conta: z.string().optional().nullable(),
  banco_pix: z.string().optional().nullable(),

  observacoes: z.string().optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
});

export type FuncionarioInput = z.infer<typeof funcionarioSchema>;

async function correspondenteDoUsuario(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id as string | undefined;
}

/** Lista funcionários do ecossistema (com filtros e busca). */
export const listarFuncionarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        q: z.string().optional(),
        status: z.string().optional(),
        departamento_id: z.string().uuid().optional(),
        cargo_id: z.string().uuid().optional(),
        incluir_desligados: z.boolean().optional(),
      })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<FuncionarioLista[]> => {
    const { supabase } = context;
    let query = supabase
      .from("rh_funcionarios")
      .select(
        `id, numero, nome, cpf, status, tipo_contrato, data_admissao, fim_experiencia,
         salario_atual, cargo_id, departamento_id, gestor_id, email_corporativo, telefone,
         rh_cargos(nome), rh_departamentos(nome)`,
      )
      .is("deletado_em", null)
      .order("nome", { ascending: true });

    if (!data.incluir_desligados) query = query.neq("status", "desligado");
    if (data.status) query = query.eq("status", data.status as StatusFuncionario);
    if (data.departamento_id) query = query.eq("departamento_id", data.departamento_id);
    if (data.cargo_id) query = query.eq("cargo_id", data.cargo_id);
    if (data.q && data.q.trim().length >= 2) {
      const term = data.q.trim();
      query = query.or(`nome.ilike.%${term}%,cpf.ilike.%${term}%,numero.ilike.%${term}%`);
    }

    const { data: rows, error } = await query.limit(500);
    if (error) throw new Error(error.message);

    // Nome do gestor via segunda consulta pontual.
    const gestorIds = Array.from(new Set((rows ?? []).map((r: any) => r.gestor_id).filter(Boolean)));
    const nomeGestor = new Map<string, string>();
    if (gestorIds.length > 0) {
      const { data: gs } = await supabase.from("profiles").select("id, nome").in("id", gestorIds);
      (gs ?? []).forEach((g: any) => nomeGestor.set(g.id, g.nome ?? ""));
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      numero: r.numero,
      nome: r.nome,
      cpf: r.cpf,
      status: r.status,
      tipo_contrato: r.tipo_contrato,
      data_admissao: r.data_admissao,
      fim_experiencia: r.fim_experiencia,
      salario_atual: Number(r.salario_atual ?? 0),
      cargo_id: r.cargo_id,
      cargo_nome: r.rh_cargos?.nome ?? null,
      departamento_id: r.departamento_id,
      departamento_nome: r.rh_departamentos?.nome ?? null,
      gestor_id: r.gestor_id,
      gestor_nome: r.gestor_id ? (nomeGestor.get(r.gestor_id) ?? null) : null,
      email_corporativo: r.email_corporativo,
      telefone: r.telefone,
    }));
  });

/** Obtém uma ficha completa do funcionário. */
export const obterFuncionario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<Funcionario | null> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("rh_funcionarios")
      .select(
        `*, rh_cargos(nome), rh_departamentos(nome)`,
      )
      .eq("id", data.id)
      .is("deletado_em", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    let gestor_nome: string | null = null;
    if (row.gestor_id) {
      const { data: g } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", row.gestor_id)
        .maybeSingle();
      gestor_nome = g?.nome ?? null;
    }
    let user_nome: string | null = null;
    let user_email: string | null = null;
    if ((row as any).user_id) {
      const { data: u } = await supabase
        .from("profiles")
        .select("nome, email")
        .eq("id", (row as any).user_id)
        .maybeSingle();
      user_nome = u?.nome ?? null;
      user_email = u?.email ?? null;
    }
    return {
      ...(row as any),
      salario_atual: Number(row.salario_atual ?? 0),
      cargo_nome: (row as any).rh_cargos?.nome ?? null,
      departamento_nome: (row as any).rh_departamentos?.nome ?? null,
      gestor_nome,
      user_nome,
      user_email,
    } as Funcionario;
  });

/** Cria um novo funcionário. */
export const criarFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => funcionarioSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ id: string; numero: string }> => {
    const { supabase, userId } = context;
    const correspondenteId = await correspondenteDoUsuario(supabase, userId);
    if (!correspondenteId) throw new Error("Ecossistema não identificado.");

    const payload = {
      ...data,
      correspondente_id: correspondenteId,
      criador_id: userId,
      // Datas em branco -> null
      data_nascimento: data.data_nascimento || null,
      fim_experiencia: data.fim_experiencia || null,
      data_demissao: data.data_demissao || null,
      salario_desde: data.salario_desde || data.data_admissao,
      email_pessoal: data.email_pessoal || null,
      email_corporativo: data.email_corporativo || null,
    };
    delete (payload as any).id;

    const { data: row, error } = await supabase
      .from("rh_funcionarios")
      .insert(payload as never)
      .select("id, numero")
      .single();
    if (error) throw new Error(error.message);

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "rh.funcionario.criar",
      entidade: "rh_funcionarios",
      entidadeId: row.id,
      payloadNovo: { numero: row.numero, nome: data.nome, cpf: data.cpf },
    });

    return row as { id: string; numero: string };
  });

/** Atualiza dados do funcionário; o histórico é gravado automaticamente pelo trigger. */
export const atualizarFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    funcionarioSchema.extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const correspondenteId = await correspondenteDoUsuario(supabase, userId);
    if (!correspondenteId) throw new Error("Ecossistema não identificado.");

    const { id, ...rest } = data;
    const payload: any = {
      ...rest,
      data_nascimento: rest.data_nascimento || null,
      fim_experiencia: rest.fim_experiencia || null,
      data_demissao: rest.data_demissao || null,
      email_pessoal: rest.email_pessoal || null,
      email_corporativo: rest.email_corporativo || null,
    };

    const { error } = await supabase.from("rh_funcionarios").update(payload).eq("id", id);
    if (error) throw new Error(error.message);

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "rh.funcionario.atualizar",
      entidade: "rh_funcionarios",
      entidadeId: id,
      payloadNovo: { nome: rest.nome, status: rest.status, salario_atual: rest.salario_atual },
    });
    return { ok: true };
  });

/** Marca funcionário como desligado (soft delete + status). */
export const desligarFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      data_demissao: z.string().min(10),
      motivo_demissao: z.string().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const correspondenteId = (await correspondenteDoUsuario(supabase, userId)) ?? null;
    const { error } = await supabase
      .from("rh_funcionarios")
      .update({
        status: "desligado",
        data_demissao: data.data_demissao,
        motivo_demissao: data.motivo_demissao ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "rh.funcionario.desligar",
      entidade: "rh_funcionarios",
      entidadeId: data.id,
      payloadNovo: { data_demissao: data.data_demissao, motivo: data.motivo_demissao ?? null },
    });
    return { ok: true };
  });

// ------------ Dependentes ------------------------------------------------

export interface Dependente {
  id: string;
  funcionario_id: string;
  nome: string;
  cpf: string | null;
  data_nascimento: string | null;
  parentesco: string;
  ir: boolean;
  plano_saude: boolean;
  salario_familia: boolean;
  observacoes: string | null;
}

const dependenteSchema = z.object({
  id: z.string().uuid().optional(),
  funcionario_id: z.string().uuid(),
  nome: z.string().min(2),
  cpf: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  parentesco: z.string().min(1),
  ir: z.boolean().default(false),
  plano_saude: z.boolean().default(false),
  salario_familia: z.boolean().default(false),
  observacoes: z.string().optional().nullable(),
});

export const listarDependentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ funcionario_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<Dependente[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("rh_dependentes")
      .select("*")
      .eq("funcionario_id", data.funcionario_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Dependente[];
  });

export const salvarDependente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => dependenteSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const correspondenteId = await correspondenteDoUsuario(supabase, userId);
    if (!correspondenteId) throw new Error("Ecossistema não identificado.");

    const payload = {
      ...data,
      correspondente_id: correspondenteId,
      data_nascimento: data.data_nascimento || null,
    };

    if (data.id) {
      const { error } = await supabase.from("rh_dependentes").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    delete (payload as any).id;
    const { data: row, error } = await supabase
      .from("rh_dependentes")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string };
  });

export const excluirDependente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("rh_dependentes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ Histórico --------------------------------------------------

export interface HistoricoItem {
  id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  ator_id: string | null;
  ator_nome: string | null;
  created_at: string;
}

export const listarHistoricoFuncionario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ funcionario_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<HistoricoItem[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("rh_funcionario_historico")
      .select("id, campo, valor_anterior, valor_novo, motivo, ator_id, created_at")
      .eq("funcionario_id", data.funcionario_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const atorIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.ator_id).filter(Boolean)),
    ) as string[];
    const nomes = new Map<string, string>();
    if (atorIds.length > 0) {
      const { data: ps } = await supabase.from("profiles").select("id, nome").in("id", atorIds);
      (ps ?? []).forEach((p: any) => nomes.set(p.id, p.nome ?? ""));
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      ator_nome: r.ator_id ? (nomes.get(r.ator_id) ?? null) : null,
    })) as HistoricoItem[];
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { hojeISO } from "@/lib/financeiro/format";
import { validarCPF, validarPIS } from "@/lib/crm/documento";
import { apagarArquivoRh } from "@/lib/rh/submodulos.functions";
import { CAMPOS_SENSIVEIS, dadosSensiveis, pode } from "@/lib/rh/acesso";
import {
  CONTRATO_LABEL as CONTRATO_LABEL_RH,
  STATUS_FUNCIONARIO_LABEL as STATUS_FUNCIONARIO_LABEL_RH,
} from "@/lib/rh/rotulos";

/** Status possível de um funcionário. */
export type StatusFuncionario = "ativo" | "experiencia" | "afastado" | "ferias" | "desligado";

export type TipoContrato = "clt" | "pj" | "estagio" | "autonomo" | "temporario" | "aprendiz";

export interface FuncionarioLista {
  id: string;
  numero: string;
  nome: string;
  cpf: string;
  status: StatusFuncionario;
  tipo_contrato: TipoContrato;
  data_admissao: string;
  fim_experiencia: string | null;
  /** null = quem pede não tem RH · Salários · ver. */
  salario_atual: number | null;
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
  centro_custo_id: string | null;
  centro_custo_nome: string | null;
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
  dia_pagamento_salario: number | null;
  dia_pagamento_adiantamento: number | null;
  gerar_contas_pagar_automatico: boolean;
  foto_url: string | null;
  /** A ficha veio com salário e banco (quem pede tem RH · Salários · ver). */
  com_dados_sensiveis: boolean;
}

/** Colunas não sensíveis da ficha (salário e banco vêm de `rh_dados_sensiveis`). */
const COLUNAS_FICHA = `id, correspondente_id, numero, status, nome, nome_social, cpf, rg, rg_orgao, rg_uf,
  data_nascimento, sexo, estado_civil, nacionalidade, naturalidade, nome_mae, nome_pai, email_pessoal,
  telefone, foto_url, cep, logradouro, numero_endereco, complemento, bairro, cidade, uf, cargo_id,
  departamento_id, gestor_id, centro_custo_id, tipo_contrato, matricula, ctps_numero, ctps_serie, ctps_uf, pis,
  data_admissao, fim_experiencia, data_demissao, motivo_demissao, jornada_horas_semanais,
  jornada_descricao, email_corporativo, observacoes, ativo, user_id, dia_pagamento_salario,
  dia_pagamento_adiantamento, gerar_contas_pagar_automatico, created_at, updated_at`;

const funcionarioSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z
    .string()
    .min(2, "Informe o nome completo.")
    .transform((v) => v.trim()),
  nome_social: z.string().optional().nullable(),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(validarCPF, "CPF inválido."),
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
  centro_custo_id: z.string().uuid().optional().nullable(),
  tipo_contrato: z.enum(["clt", "pj", "estagio", "autonomo", "temporario", "aprendiz"]),
  status: z
    .enum(["ativo", "experiencia", "afastado", "ferias", "desligado"])
    .default("experiencia"),
  matricula: z.string().optional().nullable(),
  ctps_numero: z.string().optional().nullable(),
  ctps_serie: z.string().optional().nullable(),
  ctps_uf: z.string().optional().nullable(),
  pis: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v.replace(/\D/g, "") : v))
    .refine((v) => !v || validarPIS(v), "PIS/PASEP inválido."),
  data_admissao: z.string().min(10, "Informe a data de admissão."),
  fim_experiencia: z.string().optional().nullable(),
  data_demissao: z.string().optional().nullable(),
  motivo_demissao: z.string().optional().nullable(),
  jornada_horas_semanais: z.number().optional().nullable(),
  jornada_descricao: z.string().optional().nullable(),
  email_corporativo: z.string().email().optional().or(z.literal("")).nullable(),

  salario_atual: z.number().min(0).optional(),
  salario_desde: z.string().optional().nullable(),

  banco_nome: z.string().optional().nullable(),
  banco_agencia: z.string().optional().nullable(),
  banco_conta: z.string().optional().nullable(),
  banco_tipo_conta: z.string().optional().nullable(),
  banco_pix: z.string().optional().nullable(),

  observacoes: z.string().optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
  dia_pagamento_salario: z.number().int().min(1).max(31).optional().nullable(),
  dia_pagamento_adiantamento: z.number().int().min(1).max(31).optional().nullable(),
  gerar_contas_pagar_automatico: z.boolean().optional().default(true),
  foto_url: z.string().optional().nullable(),
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

/** Sem RH · Salários · alterar, salário e banco nem chegam ao banco (o gatilho recusaria). */
async function semSensiveisSeNaoPode(supabase: any, userId: string, payload: Record<string, unknown>) {
  if (await pode(supabase, userId, "rh.salarios", "edit")) return payload;
  const limpo = { ...payload };
  for (const c of CAMPOS_SENSIVEIS) delete limpo[c];
  return limpo;
}

/** Lista funcionários do ecossistema (com filtros e busca). */
export const listarFuncionarios = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.funcionarios", "view"])])
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
         cargo_id, departamento_id, gestor_id, email_corporativo, telefone,
         rh_cargos(nome), rh_departamentos(nome)`,
      )
      .is("deletado_em", null)
      .order("nome", { ascending: true });

    if (!data.incluir_desligados) query = query.neq("status", "desligado");
    if (data.status) query = query.eq("status", data.status as StatusFuncionario);
    if (data.departamento_id) query = query.eq("departamento_id", data.departamento_id);
    if (data.cargo_id) query = query.eq("cargo_id", data.cargo_id);
    if (data.q && data.q.trim().length >= 2) {
      // Vírgula e parênteses quebram a sintaxe do `or` do PostgREST.
      const term = data.q.trim().replace(/[,()]/g, " ");
      // O CPF é gravado só com dígitos: "123.456.789-01" não achava ninguém.
      const digitos = term.replace(/\D/g, "");
      const partes = [`nome.ilike.%${term}%`, `cpf.ilike.%${term}%`, `numero.ilike.%${term}%`];
      if (digitos.length >= 3 && digitos !== term) partes.push(`cpf.ilike.%${digitos}%`);
      query = query.or(partes.join(","));
    }

    const { data: rows, error } = await query.limit(500);
    if (error) throw new Error(error.message);

    const verSalario = await pode(supabase, context.userId, "rh.salarios", "view");
    const sens = verSalario
      ? await dadosSensiveis(supabase, (rows ?? []).map((r: any) => r.id as string))
      : new Map();

    // Nome do gestor via segunda consulta pontual.
    const gestorIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.gestor_id).filter(Boolean)),
    );
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
      salario_atual: verSalario ? (sens.get(r.id)?.salario_atual ?? 0) : null,
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
  .middleware([exigirPermissao(["rh.funcionarios", "view"])])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<Funcionario | null> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("rh_funcionarios")
      .select(`${COLUNAS_FICHA}, rh_cargos(nome), rh_departamentos(nome), financial_cost_centers(nome)`)
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
    const verSalario = await pode(supabase, context.userId, "rh.salarios", "view");
    const sens = verSalario ? (await dadosSensiveis(supabase, [data.id])).get(data.id) : undefined;
    return {
      ...(row as any),
      salario_atual: sens ? sens.salario_atual : null,
      salario_desde: sens?.salario_desde ?? null,
      banco_nome: sens?.banco_nome ?? null,
      banco_agencia: sens?.banco_agencia ?? null,
      banco_conta: sens?.banco_conta ?? null,
      banco_tipo_conta: sens?.banco_tipo_conta ?? null,
      banco_pix: sens?.banco_pix ?? null,
      com_dados_sensiveis: verSalario,
      centro_custo_nome: (row as any).financial_cost_centers?.nome ?? null,
      cargo_nome: (row as any).rh_cargos?.nome ?? null,
      departamento_nome: (row as any).rh_departamentos?.nome ?? null,
      gestor_nome,
      user_nome,
      user_email,
    } as Funcionario;
  });

/** Cria um novo funcionário. */
/** Um CPF por funcionário ativo no ecossistema (a RLS já restringe ao correspondente). */
async function garantirCpfLivre(supabase: any, cpf: string, ignorarId?: string) {
  let q = supabase
    .from("rh_funcionarios")
    .select("numero, nome")
    .eq("cpf", cpf)
    .is("deletado_em", null);
  if (ignorarId) q = q.neq("id", ignorarId);
  const { data } = await q.limit(1).maybeSingle();
  if (data) throw new Error(`Este CPF já é do funcionário ${data.numero} — ${data.nome}.`);
}

export const criarFuncionario = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.funcionarios", "create"])])
  .inputValidator((data: unknown) => funcionarioSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ id: string; numero: string }> => {
    const { supabase, userId } = context;
    const correspondenteId = await correspondenteDoUsuario(supabase, userId);
    if (!correspondenteId) throw new Error("Ecossistema não identificado.");

    await garantirCpfLivre(supabase, data.cpf);
    const payload: Record<string, unknown> = {
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
    delete payload.id;

    const { data: row, error } = await supabase
      .from("rh_funcionarios")
      .insert((await semSensiveisSeNaoPode(supabase, userId, payload)) as never)
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
  .middleware([exigirPermissao(["rh.funcionarios", "edit"])])
  .inputValidator((data: unknown) =>
    funcionarioSchema.extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const correspondenteId = await correspondenteDoUsuario(supabase, userId);
    if (!correspondenteId) throw new Error("Ecossistema não identificado.");

    const { id, ...rest } = data;
    await garantirCpfLivre(supabase, rest.cpf, id);
    const payload: any = {
      ...rest,
      data_nascimento: rest.data_nascimento || null,
      fim_experiencia: rest.fim_experiencia || null,
      data_demissao: rest.data_demissao || null,
      email_pessoal: rest.email_pessoal || null,
      email_corporativo: rest.email_corporativo || null,
    };

    // Campo sensível que não veio não é campo vazio: não regrava.
    for (const c of CAMPOS_SENSIVEIS) if ((rest as any)[c] === undefined) delete payload[c];
    const { data: atualizados, error } = await supabase
      .from("rh_funcionarios")
      .update((await semSensiveisSeNaoPode(supabase, userId, payload)) as never)
      .eq("id", id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!atualizados || atualizados.length === 0) {
      throw new Error(
        "Você não tem permissão para editar este funcionário (permissão 'RH · Funcionários · editar').",
      );
    }

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "rh.funcionario.atualizar",
      entidade: "rh_funcionarios",
      entidadeId: id,
      payloadNovo: { nome: rest.nome, status: rest.status },
    });
    return { ok: true };
  });

/** Marca funcionário como desligado (soft delete + status). */
export const desligarFuncionario = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.funcionarios", "edit"])])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        data_demissao: z.string().min(10),
        motivo_demissao: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    // Valida a data de desligamento contra a admissão e contra o futuro.
    // Sem isso, a folha pode registrar um desligamento retroativo à admissão
    // ou datado no futuro — ambos geram inconsistência em holerites e rescisão.
    const dtDem = new Date(data.data_demissao);
    if (Number.isNaN(dtDem.getTime())) {
      throw new Error("Data de desligamento inválida.");
    }
    // Compara em UTC pelo dia (evita falso-positivo por fuso).
    const hojeUtc = new Date(hojeISO());
    if (dtDem.getTime() > hojeUtc.getTime()) {
      throw new Error("Data de desligamento não pode ser futura.");
    }

    const { data: atual, error: errBusca } = await supabase
      .from("rh_funcionarios")
      .select("data_admissao")
      .eq("id", data.id)
      .maybeSingle();
    if (errBusca) throw new Error(errBusca.message);
    if (!atual) throw new Error("Funcionário não encontrado.");
    if (atual.data_admissao) {
      const dtAdm = new Date(atual.data_admissao);
      if (!Number.isNaN(dtAdm.getTime()) && dtDem.getTime() < dtAdm.getTime()) {
        throw new Error("Data de desligamento não pode ser anterior à admissão.");
      }
    }

    const correspondenteId = (await correspondenteDoUsuario(supabase, userId)) ?? null;
    const { data: atualizados, error } = await supabase
      .from("rh_funcionarios")
      .update({
        status: "desligado",
        data_demissao: data.data_demissao,
        motivo_demissao: data.motivo_demissao ?? null,
      })
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    // Sem permissão de edição a RLS não atualiza nada e não dá erro: a tela
    // dizia "desligado" e o funcionário continuava ativo.
    if (!atualizados || atualizados.length === 0) {
      throw new Error("Você não tem permissão para desligar funcionários.");
    }

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

/**
 * Exclui definitivamente um funcionário e todos os registros vinculados
 * (documentos, dependentes, férias, benefícios, holerites, lançamentos…).
 * As FKs estão em ON DELETE CASCADE, então o próprio banco cuida do vínculo.
 */
export const excluirFuncionario = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.funcionarios", "delete"])])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const correspondenteId = await correspondenteDoUsuario(supabase, userId);
    if (!correspondenteId) throw new Error("Ecossistema não identificado.");

    const { data: alvo, error: errBusca } = await supabase
      .from("rh_funcionarios")
      .select("id, nome, numero")
      .eq("id", data.id)
      .maybeSingle();
    if (errBusca) throw new Error(errBusca.message);
    if (!alvo) throw new Error("Funcionário não encontrado.");

    const { data: removidos, error } = await supabase
      .from("rh_funcionarios")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!removidos || removidos.length === 0) {
      throw new Error(
        "Você não tem permissão para excluir funcionários (permissão 'RH · Funcionários · excluir').",
      );
    }

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "rh.funcionario.excluir",
      entidade: "rh_funcionarios",
      entidadeId: data.id,
      payloadAnterior: { nome: (alvo as any).nome, numero: (alvo as any).numero },
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
  cpf: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || validarCPF(v), "CPF do dependente inválido."),
  data_nascimento: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || v <= hojeISO(), "A data de nascimento não pode estar no futuro."),
  parentesco: z.string().min(1),
  ir: z.boolean().default(false),
  plano_saude: z.boolean().default(false),
  salario_familia: z.boolean().default(false),
  observacoes: z.string().optional().nullable(),
});

export const listarDependentes = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.funcionarios", "view"])])
  .inputValidator((data: unknown) => z.object({ funcionario_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<Dependente[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("rh_dependentes")
      .select("id, funcionario_id, nome, cpf, data_nascimento, parentesco, ir, plano_saude, salario_familia, observacoes")
      .eq("funcionario_id", data.funcionario_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Dependente[];
  });

export const salvarDependente = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.funcionarios", "edit"])])
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

// A RLS de dependentes libera DELETE a quem só pode ver (USING de "ver");
// a exclusão exige "editar", como a gravação.
export const excluirDependente = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.funcionarios", "edit"])])
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
  /** Nome do campo como a tela mostra ("Cargo", não "cargo_id"). */
  campo_label: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  ator_id: string | null;
  ator_nome: string | null;
  created_at: string;
}

const CAMPO_HISTORICO: Record<string, string> = {
  status: "Situação",
  nome: "Nome",
  cpf: "CPF",
  data_nascimento: "Data de nascimento",
  estado_civil: "Estado civil",
  telefone: "Telefone",
  email_pessoal: "E-mail pessoal",
  cargo_id: "Cargo",
  departamento_id: "Departamento",
  gestor_id: "Gestor",
  tipo_contrato: "Tipo de contrato",
  data_admissao: "Data de admissão",
  fim_experiencia: "Fim da experiência",
  data_demissao: "Data de desligamento",
  motivo_demissao: "Motivo do desligamento",
  jornada_horas_semanais: "Jornada (h/semana)",
  salario_atual: "Salário",
  salario_desde: "Salário desde",
  banco_nome: "Banco",
  banco_agencia: "Agência",
  banco_conta: "Conta",
  banco_pix: "Chave PIX",
  cep: "CEP",
  logradouro: "Logradouro",
  numero_endereco: "Número",
  bairro: "Bairro",
  cidade: "Cidade",
  uf: "UF",
};

const STATUS_FUNCIONARIO_LABEL: Record<string, string> = STATUS_FUNCIONARIO_LABEL_RH;
const CONTRATO_LABEL: Record<string, string> = CONTRATO_LABEL_RH;

const DATAS_HISTORICO = new Set([
  "data_nascimento",
  "data_admissao",
  "fim_experiencia",
  "data_demissao",
  "salario_desde",
]);

/** Valor do histórico em texto legível (o cargo aparecia como UUID). */
function valorHistorico(
  campo: string,
  v: string | null,
  nomes: Map<string, string>,
): string | null {
  if (v == null || v === "") return null;
  if (campo === "cargo_id" || campo === "departamento_id" || campo === "gestor_id") {
    return nomes.get(v) ?? "(registro removido)";
  }
  if (campo === "status") return STATUS_FUNCIONARIO_LABEL[v] ?? v;
  if (campo === "tipo_contrato") return CONTRATO_LABEL[v] ?? v;
  if (DATAS_HISTORICO.has(campo) && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [a, m, d] = v.slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  }
  if (campo === "salario_atual" && Number.isFinite(Number(v))) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return v;
}

export const listarHistoricoFuncionario = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.funcionarios", "view"])])
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
    // Cargo, departamento e gestor chegam como id: busca os nomes de uma vez.
    const idsDe = (campo: string) =>
      Array.from(
        new Set(
          (rows ?? [])
            .filter((r: any) => r.campo === campo)
            .flatMap((r: any) => [r.valor_anterior, r.valor_novo])
            .filter((v: unknown): v is string => typeof v === "string" && v.length > 0),
        ),
      );
    const nomesRef = new Map<string, string>();
    const [cargos, deptos, gestores] = await Promise.all([
      idsDe("cargo_id").length
        ? supabase.from("rh_cargos").select("id, nome").in("id", idsDe("cargo_id"))
        : Promise.resolve({ data: [] as any[] }),
      idsDe("departamento_id").length
        ? supabase.from("rh_departamentos").select("id, nome").in("id", idsDe("departamento_id"))
        : Promise.resolve({ data: [] as any[] }),
      idsDe("gestor_id").length
        ? supabase.from("rh_funcionarios").select("id, nome").in("id", idsDe("gestor_id"))
        : Promise.resolve({ data: [] as any[] }),
    ]);
    for (const lista of [cargos.data, deptos.data, gestores.data]) {
      for (const x of (lista ?? []) as any[]) nomesRef.set(x.id, x.nome ?? "—");
    }

    return (rows ?? []).map((r: any) => ({
      ...r,
      campo_label:
        r.campo === "__criacao__"
          ? "Admissão registrada"
          : (CAMPO_HISTORICO[r.campo] ?? String(r.campo).replace(/_/g, " ")),
      valor_anterior: valorHistorico(r.campo, r.valor_anterior, nomesRef),
      valor_novo: valorHistorico(r.campo, r.valor_novo, nomesRef),
      ator_nome: r.ator_id ? (nomes.get(r.ator_id) ?? null) : null,
    })) as HistoricoItem[];
  });

// ------------ Usuários vinculáveis --------------------------------------

export interface UsuarioVinculavel {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  foto_url: string | null;
  ja_vinculado_a: string | null; // id do funcionário atual que já usa este user, se houver
}

/** Lista usuários (profiles) do ecossistema que podem ser vinculados a um funcionário. */
export const listarUsuariosVinculaveis = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.funcionarios", "edit"], ["rh.funcionarios", "create"])])
  .inputValidator((data: unknown) =>
    z
      .object({ funcionario_id: z.string().uuid().optional() })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<UsuarioVinculavel[]> => {
    const { supabase, userId } = context;
    const correspondenteId = await correspondenteDoUsuario(supabase, userId);
    if (!correspondenteId) return [];
    const { data: profs, error } = await supabase
      .from("profiles")
      .select("id, nome, email, telefone, documento, foto_url")
      .eq("correspondente_id", correspondenteId)
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: usados } = await supabase
      .from("rh_funcionarios")
      .select("id, user_id")
      .eq("correspondente_id", correspondenteId)
      .is("deletado_em", null)
      .not("user_id", "is", null);
    const mapa = new Map<string, string>();
    (usados ?? []).forEach((r: any) => {
      if (r.user_id) mapa.set(r.user_id, r.id);
    });

    return (profs ?? []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      telefone: p.telefone ?? null,
      documento: p.documento ?? null,
      foto_url: p.foto_url ?? null,
      ja_vinculado_a:
        mapa.get(p.id) && mapa.get(p.id) !== data.funcionario_id ? mapa.get(p.id)! : null,
    }));
  });

/** Atualiza apenas a foto do funcionário (upload imediato na ficha). */
export const salvarFotoFuncionario = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.funcionarios", "edit"], ["rh.funcionarios", "create"])])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), foto_url: z.string().nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: atual } = await context.supabase
      .from("rh_funcionarios")
      .select("foto_url")
      .eq("id", data.id)
      .maybeSingle();
    const { data: rows, error } = await context.supabase
      .from("rh_funcionarios")
      .update({ foto_url: data.foto_url })
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) {
      throw new Error("Você não tem permissão para alterar este funcionário.");
    }
    // A foto anterior só sai do bucket depois que o registro já aponta para a nova.
    const anterior = (atual as { foto_url?: string | null } | null)?.foto_url ?? null;
    const arquivoApagado =
      anterior && anterior !== data.foto_url
        ? await apagarArquivoRh(context.supabase, anterior)
        : true;
    return { ok: true, arquivoApagado };
  });

/**
 * RH · Prévia da folha
 * Consolida salário + benefícios − descontos − adiantamentos por competência,
 * aceita ajustes avulsos (proventos/descontos manuais), e permite fechar a
 * competência gerando lançamentos no Contas a Pagar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularCLT } from "@/lib/rh/clt";

export type StatusCompetencia = "aberta" | "conferida" | "fechada" | "cancelada";

export type AjusteTipo = "provento" | "desconto";

export interface FolhaAjuste {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  mes: number;
  ano: number;
  tipo: AjusteTipo;
  descricao: string;
  valor: number;
  created_at: string;
}

export interface FolhaItem {
  funcionario_id: string;
  funcionario_nome: string;
  cargo: string | null;
  salario_base: number;
  proventos: number;
  descontos: number;
  liquido: number;
  detalhes: {
    beneficios_valor: number;
    beneficios_desconto: number;
    adiantamentos: number;
    descontos_lancados: number;
    proventos_avulsos: number;
    descontos_avulsos: number;
    inss: number;
    irrf: number;
    base_irrf: number;
    fgts: number;
    dependentes_ir: number;
  };
}

export interface FolhaCompetencia {
  id: string;
  mes: number;
  ano: number;
  status: StatusCompetencia;
  total_proventos: number;
  total_descontos: number;
  total_liquido: number;
  observacoes: string | null;
  fechada_em: string | null;
  created_at: string;
}

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

async function calcularPrevia(supabase: any, mes: number, ano: number): Promise<FolhaItem[]> {
  const { data: funcs } = await supabase
    .from("rh_funcionarios")
    .select("id, nome, salario_atual, rh_cargos(nome)")
    .is("deletado_em", null)
    .neq("status", "desligado")
    .order("nome");
  const ids = (funcs ?? []).map((f: any) => f.id);
  if (ids.length === 0) return [];
  const [{ data: bens }, { data: adis }, { data: descs }, { data: ajus }, { data: deps }] =
    await Promise.all([
      supabase
        .from("rh_funcionario_beneficios")
        .select("funcionario_id, valor, desconto")
        .in("funcionario_id", ids)
        .eq("ativo", true),
      supabase
        .from("rh_adiantamentos")
        .select("funcionario_id, valor")
        .in("funcionario_id", ids)
        .eq("competencia_mes", mes)
        .eq("competencia_ano", ano)
        .neq("status", "cancelado"),
      supabase
        .from("rh_descontos")
        .select("funcionario_id, valor")
        .in("funcionario_id", ids)
        .eq("competencia_mes", mes)
        .eq("competencia_ano", ano)
        .neq("status", "cancelado"),
      supabase
        .from("rh_folha_ajustes")
        .select("funcionario_id, tipo, valor")
        .in("funcionario_id", ids)
        .eq("mes", mes)
        .eq("ano", ano),
      supabase
        .from("rh_dependentes")
        .select("funcionario_id, ir")
        .in("funcionario_id", ids)
        .eq("ir", true),
    ]);
  const bensBy = new Map<string, { valor: number; desconto: number }>();
  (bens ?? []).forEach((b: any) => {
    const cur = bensBy.get(b.funcionario_id) ?? { valor: 0, desconto: 0 };
    cur.valor += Number(b.valor ?? 0);
    cur.desconto += Number(b.desconto ?? 0);
    bensBy.set(b.funcionario_id, cur);
  });
  const somaPor = (rows: any[] | null | undefined) => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r: any) =>
      m.set(r.funcionario_id, (m.get(r.funcionario_id) ?? 0) + Number(r.valor ?? 0)),
    );
    return m;
  };
  const adiBy = somaPor(adis);
  const desBy = somaPor(descs);
  const ajProv = new Map<string, number>();
  const ajDesc = new Map<string, number>();
  (ajus ?? []).forEach((a: any) => {
    const alvo = a.tipo === "provento" ? ajProv : ajDesc;
    alvo.set(a.funcionario_id, (alvo.get(a.funcionario_id) ?? 0) + Number(a.valor ?? 0));
  });
  const depsBy = new Map<string, number>();
  (deps ?? []).forEach((d: any) => {
    depsBy.set(d.funcionario_id, (depsBy.get(d.funcionario_id) ?? 0) + 1);
  });
  return (funcs ?? []).map((f: any) => {
    const salario = Number(f.salario_atual ?? 0);
    const b = bensBy.get(f.id) ?? { valor: 0, desconto: 0 };
    const adi = adiBy.get(f.id) ?? 0;
    const des = desBy.get(f.id) ?? 0;
    const provAv = ajProv.get(f.id) ?? 0;
    const descAv = ajDesc.get(f.id) ?? 0;
    const depIR = depsBy.get(f.id) ?? 0;
    // Base tributável CLT: salário + proventos avulsos (benefícios em geral
    // não são tributáveis; se algum benefício for tributável, deve ser
    // lançado como ajuste "provento").
    const bruto = salario + provAv;
    const clt = calcularCLT(bruto, depIR, 0);
    const proventos = salario + b.valor + provAv;
    const descontos = b.desconto + adi + des + descAv + clt.inss + clt.irrf;
    return {
      funcionario_id: f.id,
      funcionario_nome: f.nome,
      cargo: f.rh_cargos?.nome ?? null,
      salario_base: salario,
      proventos,
      descontos,
      liquido: proventos - descontos,
      detalhes: {
        beneficios_valor: b.valor,
        beneficios_desconto: b.desconto,
        adiantamentos: adi,
        descontos_lancados: des,
        proventos_avulsos: provAv,
        descontos_avulsos: descAv,
        inss: clt.inss,
        irrf: clt.irrf,
        base_irrf: clt.base_irrf,
        fgts: clt.fgts,
        dependentes_ir: depIR,
      },
    };
  });
}

/** Calcula a prévia dinamicamente para uma competência (não persiste). */
export const previaFolha = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => calcularPrevia(context.supabase, data.mes, data.ano));

// ============================================================
// AJUSTES AVULSOS (proventos/descontos manuais por competência)
// ============================================================

export const listarAjustes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
        funcionario_id: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<FolhaAjuste[]> => {
    let q = context.supabase
      .from("rh_folha_ajustes")
      .select(
        "id, funcionario_id, mes, ano, tipo, descricao, valor, created_at, rh_funcionarios(nome)",
      )
      .eq("mes", data.mes)
      .eq("ano", data.ano)
      .order("created_at", { ascending: false });
    if (data.funcionario_id) q = q.eq("funcionario_id", data.funcionario_id);
    const { data: rows, error } = await q.limit(1000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      funcionario_id: r.funcionario_id,
      funcionario_nome: r.rh_funcionarios?.nome ?? "—",
      mes: r.mes,
      ano: r.ano,
      tipo: r.tipo,
      descricao: r.descricao,
      valor: Number(r.valor ?? 0),
      created_at: r.created_at,
    }));
  });

export const salvarAjuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        funcionario_id: z.string().uuid(),
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
        tipo: z.enum(["provento", "desconto"]),
        descricao: z.string().min(1).max(200),
        valor: z.number().min(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const payload = {
      correspondente_id: cid,
      funcionario_id: data.funcionario_id,
      mes: data.mes,
      ano: data.ano,
      tipo: data.tipo,
      descricao: data.descricao,
      valor: data.valor,
      criado_por: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("rh_folha_ajustes")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("rh_folha_ajustes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const excluirAjuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rh_folha_ajustes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarCompetencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FolhaCompetencia[]> => {
    const { data, error } = await context.supabase
      .from("rh_folha_competencias")
      .select(
        "id, mes, ano, status, total_proventos, total_descontos, total_liquido, observacoes, fechada_em, created_at",
      )
      .order("ano", { ascending: false })
      .order("mes", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      ...r,
      total_proventos: Number(r.total_proventos ?? 0),
      total_descontos: Number(r.total_descontos ?? 0),
      total_liquido: Number(r.total_liquido ?? 0),
    }));
  });

/**
 * Fecha a competência: grava rh_folha_competencias + rh_folha_itens e cria
 * lançamentos em financial_payables (um por funcionário).
 */
export const fecharCompetencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
        vencimento: z.string(),
        observacoes: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const previa = await calcularPrevia(context.supabase, data.mes, data.ano);
    if (previa.length === 0) {
      throw new Error("Não há funcionários ativos para essa competência.");
    }
    const totais = previa.reduce(
      (acc, i) => {
        acc.proventos += i.proventos;
        acc.descontos += i.descontos;
        acc.liquido += i.liquido;
        return acc;
      },
      { proventos: 0, descontos: 0, liquido: 0 },
    );

    const { data: comp, error: cErr } = await context.supabase
      .from("rh_folha_competencias")
      .upsert(
        {
          correspondente_id: cid,
          mes: data.mes,
          ano: data.ano,
          status: "fechada" as StatusCompetencia,
          total_proventos: totais.proventos,
          total_descontos: totais.descontos,
          total_liquido: totais.liquido,
          observacoes: data.observacoes || null,
          fechada_por: context.userId,
          fechada_em: new Date().toISOString(),
        },
        { onConflict: "correspondente_id,ano,mes" },
      )
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    const compId = comp!.id as string;

    await context.supabase.from("rh_folha_itens").delete().eq("competencia_id", compId);
    const itens = previa.map((i) => ({
      correspondente_id: cid,
      competencia_id: compId,
      funcionario_id: i.funcionario_id,
      salario_base: i.salario_base,
      total_beneficios: i.detalhes.beneficios_valor,
      total_descontos:
        i.detalhes.beneficios_desconto +
        i.detalhes.descontos_lancados +
        i.detalhes.descontos_avulsos,
      total_adiantamentos: i.detalhes.adiantamentos,
      liquido: i.liquido,
      detalhamento: i.detalhes,
    }));
    const { error: iErr } = await context.supabase.from("rh_folha_itens").insert(itens);
    if (iErr) throw new Error(iErr.message);

    const mesLabel = String(data.mes).padStart(2, "0");
    const payables = previa
      .filter((i) => i.liquido > 0)
      .map((i) => ({
        correspondente_id: cid,
        descricao: `Folha ${mesLabel}/${data.ano} · ${i.funcionario_nome}`,
        fornecedor: i.funcionario_nome,
        vencimento: data.vencimento,
        valor: i.liquido,
        status: "aberta" as const,
      }));
    if (payables.length > 0) {
      const { error: pErr } = await context.supabase.from("financial_payables").insert(payables);
      if (pErr) throw new Error(pErr.message);
    }

    return { competencia_id: compId, total: totais.liquido, contas: payables.length };
  });

/**
 * Retorna os itens de uma competência já fechada (para gerar holerites em PDF).
 */
export const listarItensFolha = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: comp } = await context.supabase
      .from("rh_folha_competencias")
      .select("id, status")
      .eq("mes", data.mes)
      .eq("ano", data.ano)
      .maybeSingle();
    if (!comp) return { competencia_id: null, itens: [] as any[] };
    const { data: itens, error } = await context.supabase
      .from("rh_folha_itens")
      .select(
        "funcionario_id, salario_base, total_beneficios, total_descontos, total_adiantamentos, liquido, detalhamento, rh_funcionarios(nome, numero, cpf, rh_cargos(nome), rh_departamentos(nome))",
      )
      .eq("competencia_id", comp.id);
    if (error) throw new Error(error.message);
    return {
      competencia_id: comp.id as string,
      status: comp.status as StatusCompetencia,
      itens: (itens ?? []).map((r: any) => ({
        funcionario_id: r.funcionario_id,
        funcionario_nome: r.rh_funcionarios?.nome ?? "—",
        funcionario_numero: r.rh_funcionarios?.numero ?? null,
        funcionario_cpf: r.rh_funcionarios?.cpf ?? null,
        cargo: r.rh_funcionarios?.rh_cargos?.nome ?? null,
        departamento: r.rh_funcionarios?.rh_departamentos?.nome ?? null,
        salario_base: Number(r.salario_base ?? 0),
        total_beneficios: Number(r.total_beneficios ?? 0),
        total_descontos: Number(r.total_descontos ?? 0),
        total_adiantamentos: Number(r.total_adiantamentos ?? 0),
        liquido: Number(r.liquido ?? 0),
        detalhamento: r.detalhamento ?? {},
      })),
    };
  });

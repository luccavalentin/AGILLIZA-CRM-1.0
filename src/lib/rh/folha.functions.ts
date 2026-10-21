/**
 * RH · Prévia da folha
 * Consolida salário + benefícios − descontos − adiantamentos por competência,
 * aceita ajustes avulsos (proventos/descontos manuais), e permite fechar a
 * competência gerando lançamentos no Contas a Pagar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { calcularHolerite, type HoleriteEntrada } from "@/lib/rh/holerite-calc";
import {
  limitesDaCompetencia,
  montarEntradaDaCompetencia,
  type DadosCompetencia,
} from "@/lib/rh/entrada-competencia";

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

/**
 * Competência já fechada não muda: os itens e as contas a pagar já foram
 * gerados com os valores daquele momento.
 */
async function garantirCompetenciaAberta(supabase: any, mes: number, ano: number) {
  const { data, error } = await supabase
    .from("rh_folha_competencias")
    .select("status")
    .eq("mes", mes)
    .eq("ano", ano)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.status === "fechada") {
    throw new Error(`A competência ${String(mes).padStart(2, "0")}/${ano} já foi fechada.`);
  }
}

async function correspondenteId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  const cid = data?.correspondente_id as string | undefined;
  if (!cid) {
    throw new Error(
      "Seu usuário não está vinculado a uma empresa. Peça ao administrador para revisar o cadastro.",
    );
  }
  return cid;
}

/**
 * Dados lançados no sistema que entram no holerite de cada funcionário na
 * competência — a mesma montagem para a prévia, a ficha e o "Gerar holerite".
 */
async function carregarDadosCompetencia(
  supabase: any,
  mes: number,
  ano: number,
  funcionarioId?: string,
): Promise<Array<{ func: any; dados: DadosCompetencia }>> {
  let qf = supabase
    .from("rh_funcionarios")
    .select("id, nome, salario_atual, rh_cargos(nome)")
    .is("deletado_em", null)
    .neq("status", "desligado")
    .order("nome");
  if (funcionarioId) qf = qf.eq("id", funcionarioId);
  const { data: funcs } = await qf;
  const ids = (funcs ?? []).map((f: any) => f.id);
  if (ids.length === 0) return [];
  const { inicio, fim } = limitesDaCompetencia({ ano, mes });
  const [{ data: alts }, { data: bens }, { data: ocs }, { data: adis }, { data: descs }, { data: ajus }, { data: deps }] =
    await Promise.all([
      supabase.from("rh_alteracoes_salariais").select("funcionario_id, vigencia, salario_anterior, salario_novo").in("funcionario_id", ids),
      supabase
        .from("rh_funcionario_beneficios")
        .select("funcionario_id, valor, desconto, vigencia_inicio, vigencia_fim, rh_beneficios_tipos(nome)")
        .in("funcionario_id", ids)
        .eq("ativo", true),
      supabase
        .from("rh_ocorrencias")
        .select("funcionario_id, data_inicio, data_fim, abonada")
        .in("funcionario_id", ids)
        .eq("tipo", "falta")
        .lte("data_inicio", fim)
        // termina no mês ou depois, ou (sem data de fim) começa no mês
        .or(`data_fim.gte.${inicio},data_inicio.gte.${inicio}`),
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
      supabase.from("rh_folha_ajustes").select("funcionario_id, tipo, valor").in("funcionario_id", ids).eq("mes", mes).eq("ano", ano),
      supabase.from("rh_dependentes").select("funcionario_id, ir, salario_familia, data_nascimento").in("funcionario_id", ids),
    ]);
  const de = (rows: any[] | null | undefined, id: string) => (rows ?? []).filter((r: any) => r.funcionario_id === id);
  return (funcs ?? []).map((f: any) => ({
    func: f,
    dados: {
      salarioAtual: Number(f.salario_atual ?? 0),
      alteracoesSalariais: de(alts, f.id).map((a: any) => ({
        vigencia: a.vigencia,
        salario_anterior: a.salario_anterior == null ? null : Number(a.salario_anterior),
        salario_novo: Number(a.salario_novo ?? 0),
      })),
      beneficios: de(bens, f.id).map((b: any) => ({
        nome: b.rh_beneficios_tipos?.nome ?? "",
        valor: Number(b.valor ?? 0),
        desconto: Number(b.desconto ?? 0),
        vigencia_inicio: b.vigencia_inicio,
        vigencia_fim: b.vigencia_fim,
      })),
      faltas: de(ocs, f.id).map((o: any) => ({ data_inicio: o.data_inicio, data_fim: o.data_fim, abonada: !!o.abonada })),
      adiantamentos: de(adis, f.id).map((a: any) => Number(a.valor ?? 0)),
      descontos: de(descs, f.id).map((d: any) => Number(d.valor ?? 0)),
      ajustes: de(ajus, f.id).map((a: any) => ({ tipo: a.tipo, valor: Number(a.valor ?? 0) })),
      dependentes: de(deps, f.id).map((d: any) => ({ ir: !!d.ir, salario_familia: !!d.salario_familia, data_nascimento: d.data_nascimento })),
    },
  }));
}

const CODIGOS_BENEFICIO = new Set(["120", "121", "122", "130", "131"]);

async function calcularPrevia(supabase: any, mes: number, ano: number): Promise<FolhaItem[]> {
  const competencia = { ano, mes };
  const linhas = await carregarDadosCompetencia(supabase, mes, ano);
  return linhas.map(({ func: f, dados }) => {
    const entrada = montarEntradaDaCompetencia(dados, competencia);
    const h = calcularHolerite(entrada, competencia);
    const valor = (codigos: Set<string>) =>
      h.descontos.filter((l) => codigos.has(l.codigo)).reduce((s, l) => s + l.valor, 0);
    const ajusteProv = dados.ajustes.filter((a) => a.tipo === "provento").reduce((s, a) => s + a.valor, 0);
    const ajusteDesc = dados.ajustes.filter((a) => a.tipo === "desconto").reduce((s, a) => s + a.valor, 0);
    return {
      funcionario_id: f.id,
      funcionario_nome: f.nome,
      cargo: f.rh_cargos?.nome ?? null,
      salario_base: entrada.salario_base,
      proventos: h.total_proventos,
      descontos: h.total_descontos,
      liquido: h.liquido,
      detalhes: {
        // Benefício em espécie não é pago em dinheiro: só a coparticipação desconta.
        beneficios_valor: 0,
        beneficios_desconto: Math.round(valor(CODIGOS_BENEFICIO) * 100) / 100,
        adiantamentos: entrada.adiantamento,
        descontos_lancados: dados.descontos.reduce((s, x) => s + x, 0),
        proventos_avulsos: ajusteProv,
        descontos_avulsos: ajusteDesc,
        inss: h.inss,
        irrf: h.irrf,
        base_irrf: h.base_irrf,
        fgts: h.fgts,
        dependentes_ir: entrada.dependentes_ir,
      },
    };
  });
}

/** Entrada do holerite de um funcionário na competência, já com os lançamentos do mês. */
export const entradaHoleriteDaCompetencia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid(),
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<HoleriteEntrada | null> => {
    const [linha] = await carregarDadosCompetencia(context.supabase, data.mes, data.ano, data.funcionario_id);
    return linha ? montarEntradaDaCompetencia(linha.dados, { ano: data.ano, mes: data.mes }) : null;
  });

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

// A tabela de ajustes só separa por correspondente na RLS: sem estas checagens,
// qualquer usuário logado lia e lançava proventos/descontos na folha.
export const listarAjustes = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.previa_folha", "view"], ["rh.holerites", "view"])])
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
  .middleware([exigirPermissao(["rh.previa_folha", "edit"], ["rh.funcionarios", "edit"])])
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
    await garantirCompetenciaAberta(context.supabase, data.mes, data.ano);
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
  .middleware([exigirPermissao(["rh.previa_folha", "edit"], ["rh.funcionarios", "edit"])])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: ajuste, error: aErr } = await context.supabase
      .from("rh_folha_ajustes")
      .select("mes, ano")
      .eq("id", data.id)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!ajuste) throw new Error("Ajuste não encontrado.");
    await garantirCompetenciaAberta(context.supabase, ajuste.mes as number, ajuste.ano as number);
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
    // Fechar de novo duplicava as contas a pagar de todos os funcionários
    // (a tela só desabilitava o botão).
    await garantirCompetenciaAberta(context.supabase, data.mes, data.ano);
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

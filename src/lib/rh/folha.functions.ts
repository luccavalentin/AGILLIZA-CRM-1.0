/**
 * RH · Prévia da folha
 * Consolida salário + benefícios − descontos − adiantamentos por competência
 * e permite fechar a competência gerando lançamentos no Contas a Pagar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatusCompetencia =
  | "aberta"
  | "conferida"
  | "fechada"
  | "paga"
  | "cancelada";

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

async function calcularPrevia(
  supabase: any,
  mes: number,
  ano: number,
): Promise<FolhaItem[]> {
  const { data: funcs } = await supabase
    .from("rh_funcionarios")
    .select("id, nome, salario_atual, rh_cargos(nome)")
    .is("deletado_em", null)
    .neq("status", "desligado")
    .order("nome");
  const ids = (funcs ?? []).map((f: any) => f.id);
  if (ids.length === 0) return [];
  const [{ data: bens }, { data: adis }, { data: descs }] = await Promise.all([
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
  return (funcs ?? []).map((f: any) => {
    const salario = Number(f.salario_atual ?? 0);
    const b = bensBy.get(f.id) ?? { valor: 0, desconto: 0 };
    const adi = adiBy.get(f.id) ?? 0;
    const des = desBy.get(f.id) ?? 0;
    const proventos = salario + b.valor;
    const descontos = b.desconto + adi + des;
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
  .handler(async ({ data, context }): Promise<FolhaItem[]> => {
    return calcularPrevia(context.supabase, data.mes, data.ano);
  });

const _oldPreviaFolha = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<FolhaItem[]> => {
    const { supabase } = context;
    const { data: funcs } = await supabase
      .from("rh_funcionarios")
      .select("id, nome, salario_atual, rh_cargos(nome)")
      .is("deletado_em", null)
      .neq("status", "desligado")
      .order("nome");

    const ids = (funcs ?? []).map((f: any) => f.id);
    if (ids.length === 0) return [];

    const [{ data: bens }, { data: adis }, { data: descs }] = await Promise.all([
      supabase
        .from("rh_funcionario_beneficios")
        .select("funcionario_id, valor, desconto")
        .in("funcionario_id", ids)
        .eq("ativo", true),
      supabase
        .from("rh_adiantamentos")
        .select("funcionario_id, valor")
        .in("funcionario_id", ids)
        .eq("competencia_mes", data.mes)
        .eq("competencia_ano", data.ano)
        .neq("status", "cancelado"),
      supabase
        .from("rh_descontos")
        .select("funcionario_id, valor")
        .in("funcionario_id", ids)
        .eq("competencia_mes", data.mes)
        .eq("competencia_ano", data.ano)
        .neq("status", "cancelado"),
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

    return (funcs ?? []).map((f: any) => {
      const salario = Number(f.salario_atual ?? 0);
      const b = bensBy.get(f.id) ?? { valor: 0, desconto: 0 };
      const adi = adiBy.get(f.id) ?? 0;
      const des = desBy.get(f.id) ?? 0;
      const proventos = salario + b.valor;
      const descontos = b.desconto + adi + des;
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
        },
      };
    });
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
    // Recalcula a prévia diretamente aqui para consistência
    const previa = await previaFolha({
      data: { mes: data.mes, ano: data.ano },
    } as never);
    if (!previa || previa.length === 0) {
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

    // Cria competência
    const { data: comp, error: cErr } = await context.supabase
      .from("rh_folha_competencias")
      .upsert(
        {
          correspondente_id: cid,
          mes: data.mes,
          ano: data.ano,
          status: "fechada",
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

    // Limpa itens anteriores e insere os novos
    await context.supabase.from("rh_folha_itens").delete().eq("competencia_id", compId);
    const itens = previa.map((i) => ({
      correspondente_id: cid,
      competencia_id: compId,
      funcionario_id: i.funcionario_id,
      salario_base: i.salario_base,
      total_beneficios: i.detalhes.beneficios_valor,
      total_descontos: i.detalhes.beneficios_desconto + i.detalhes.descontos_lancados,
      total_adiantamentos: i.detalhes.adiantamentos,
      liquido: i.liquido,
      detalhamento: i.detalhes,
    }));
    const { error: iErr } = await context.supabase.from("rh_folha_itens").insert(itens);
    if (iErr) throw new Error(iErr.message);

    // Cria contas a pagar (uma por funcionário)
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
      const { error: pErr } = await context.supabase
        .from("financial_payables")
        .insert(payables);
      if (pErr) throw new Error(pErr.message);
    }

    return { competencia_id: compId, total: totais.liquido, contas: payables.length };
  });

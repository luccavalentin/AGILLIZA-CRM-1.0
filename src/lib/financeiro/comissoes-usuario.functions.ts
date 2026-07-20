import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TIPOS_VINCULO_COMISSAO = [
  { valor: "corretor", rotulo: "Corretor" },
  { valor: "imobiliaria", rotulo: "Imobiliária" },
  { valor: "analista", rotulo: "Analista" },
  { valor: "comercial_agilliza", rotulo: "Comercial Agilliza" },
  { valor: "parceiro", rotulo: "Parceiro" },
  { valor: "outro", rotulo: "Outros" },
] as const;

export type TipoVinculoComissao = (typeof TIPOS_VINCULO_COMISSAO)[number]["valor"];

export const GATILHOS_COMISSAO = [
  { valor: "contrato_emitido", rotulo: "Contrato emitido" },
  { valor: "manual", rotulo: "Manual" },
] as const;

export const BASES_CALCULO = [
  { valor: "valor_contrato", rotulo: "% do valor do contrato" },
  { valor: "percentual_repasse", rotulo: "% do repasse do correspondente" },
] as const;

export interface RegraComissaoUsuario {
  id: string;
  usuario_id: string;
  usuario_nome: string | null;
  usuario_email: string | null;
  tipo_vinculo: TipoVinculoComissao;
  gatilho: string;
  base_calculo: "valor_contrato" | "percentual_repasse";
  percentual: number;
  banco_nome: string | null;
  produto: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
  observacao: string | null;
  created_at: string;
}

export interface ComissaoUsuarioLancamento {
  id: string;
  proposta_id: string;
  numero_proposta: string | null;
  nome_cliente: string | null;
  usuario_id: string;
  usuario_nome: string | null;
  tipo_vinculo: TipoVinculoComissao;
  gatilho: string;
  base_calculo: "valor_contrato" | "percentual_repasse";
  percentual: number;
  valor_base: number;
  valor_comissao: number;
  banco_nome: string | null;
  produto: string | null;
  status: "a_pagar" | "paga" | "cancelada";
  payable_id: string | null;
  vencimento: string | null;
  data_pagamento: string | null;
  created_at: string;
}

async function corrDoUsuario(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário sem correspondente.");
  return data as string;
}

// ---------- REGRAS ----------

export const listarRegrasComissaoUsuario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tipo_vinculo: z.string().optional(),
        ativo: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<RegraComissaoUsuario[]> => {
    const { supabase, userId } = context;
    const corr = await corrDoUsuario(supabase, userId);
    let query = supabase
      .from("comissao_regras_usuario")
      .select("*")
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: false });
    if (data.tipo_vinculo) query = query.eq("tipo_vinculo", data.tipo_vinculo as TipoVinculoComissao);
    if (typeof data.ativo === "boolean") query = query.eq("ativo", data.ativo);
    const { data: regras, error } = await query;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((regras ?? []).map((r: any) => r.usuario_id)));
    const nomes = new Map<string, { nome: string | null; email: string | null }>();
    if (ids.length) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      (prof ?? []).forEach((p: any) => nomes.set(p.id, { nome: p.nome, email: p.email }));
    }

    return (regras ?? []).map((r: any) => ({
      id: r.id,
      usuario_id: r.usuario_id,
      usuario_nome: nomes.get(r.usuario_id)?.nome ?? null,
      usuario_email: nomes.get(r.usuario_id)?.email ?? null,
      tipo_vinculo: r.tipo_vinculo,
      gatilho: r.gatilho,
      base_calculo: r.base_calculo,
      percentual: Number(r.percentual ?? 0),
      banco_nome: r.banco_nome,
      produto: r.produto,
      vigencia_inicio: r.vigencia_inicio,
      vigencia_fim: r.vigencia_fim,
      ativo: !!r.ativo,
      observacao: r.observacao,
      created_at: r.created_at,
    }));
  });

export const salvarRegraComissaoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        usuario_id: z.string().uuid(),
        tipo_vinculo: z.enum([
          "corretor",
          "imobiliaria",
          "parceiro",
          "comercial_agilliza",
          "analista",
          "outro",
        ]),
        gatilho: z.enum([
          "contrato_emitido",
          "credito_aprovado",
          "assinatura_contrato",
          "registro_imovel",
          "manual",
        ]),
        base_calculo: z.enum(["valor_contrato", "percentual_repasse"]),
        percentual: z.number().min(0).max(100),
        banco_nome: z.string().nullable().optional(),
        produto: z.string().nullable().optional(),
        vigencia_inicio: z.string().nullable().optional(),
        vigencia_fim: z.string().nullable().optional(),
        ativo: z.boolean().default(true),
        observacao: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const corr = await corrDoUsuario(supabase, userId);
    const payload = {
      correspondente_id: corr,
      usuario_id: data.usuario_id,
      tipo_vinculo: data.tipo_vinculo,
      gatilho: data.gatilho,
      base_calculo: data.base_calculo,
      percentual: data.percentual,
      banco_nome: data.banco_nome || null,
      produto: data.produto || null,
      vigencia_inicio: data.vigencia_inicio || null,
      vigencia_fim: data.vigencia_fim || null,
      ativo: data.ativo,
      observacao: data.observacao || null,
      criador_id: userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("comissao_regras_usuario")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: novo, error } = await supabase
      .from("comissao_regras_usuario")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: novo.id as string };
  });

export const excluirRegraComissaoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("comissao_regras_usuario")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- LANÇAMENTOS ----------

export const listarComissoesUsuario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["a_pagar", "paga", "cancelada"]).optional(),
        usuario_id: z.string().uuid().optional(),
        banco_nome: z.string().optional(),
        tipo_vinculo: z.string().optional(),
        de: z.string().optional(),
        ate: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<ComissaoUsuarioLancamento[]> => {
    const { supabase, userId } = context;
    const corr = await corrDoUsuario(supabase, userId);
    let query = supabase
      .from("comissoes_usuario")
      .select("*")
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: false });
    if (data.status) query = query.eq("status", data.status);
    if (data.usuario_id) query = query.eq("usuario_id", data.usuario_id);
    if (data.banco_nome) query = query.eq("banco_nome", data.banco_nome);
    if (data.tipo_vinculo) query = query.eq("tipo_vinculo", data.tipo_vinculo as TipoVinculoComissao);
    if (data.de) query = query.gte("created_at", data.de);
    if (data.ate) query = query.lte("created_at", `${data.ate}T23:59:59.999`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.usuario_id)));
    const propIds = Array.from(new Set((rows ?? []).map((r: any) => r.proposta_id)));
    const payIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.payable_id).filter(Boolean)),
    );

    const nomes = new Map<string, string | null>();
    if (userIds.length) {
      const { data: prof } = await supabase.from("profiles").select("id, nome").in("id", userIds);
      (prof ?? []).forEach((p: any) => nomes.set(p.id, p.nome));
    }
    const props = new Map<string, string | null>();
    if (propIds.length) {
      const { data: pp } = await supabase
        .from("propostas")
        .select("id, nome_cliente")
        .in("id", propIds);
      (pp ?? []).forEach((p: any) => props.set(p.id, p.nome_cliente));
    }
    const pays = new Map<
      string,
      { vencimento: string | null; data_pagamento: string | null }
    >();
    if (payIds.length) {
      const { data: pp } = await supabase
        .from("financial_payables")
        .select("id, vencimento, data_pagamento")
        .in("id", payIds);
      (pp ?? []).forEach((p: any) =>
        pays.set(p.id, { vencimento: p.vencimento, data_pagamento: p.data_pagamento }),
      );
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      proposta_id: r.proposta_id,
      numero_proposta: r.numero_proposta,
      nome_cliente: props.get(r.proposta_id) ?? null,
      usuario_id: r.usuario_id,
      usuario_nome: nomes.get(r.usuario_id) ?? null,
      tipo_vinculo: r.tipo_vinculo,
      gatilho: r.gatilho,
      base_calculo: r.base_calculo,
      percentual: Number(r.percentual ?? 0),
      valor_base: Number(r.valor_base ?? 0),
      valor_comissao: Number(r.valor_comissao ?? 0),
      banco_nome: r.banco_nome,
      produto: r.produto,
      status: r.status,
      payable_id: r.payable_id,
      vencimento: r.payable_id ? pays.get(r.payable_id)?.vencimento ?? null : null,
      data_pagamento: r.payable_id ? pays.get(r.payable_id)?.data_pagamento ?? null : null,
      created_at: r.created_at,
    }));
  });

export const marcarComissaoUsuarioPaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: c, error: e0 } = await supabase
      .from("comissoes_usuario")
      .select("id, payable_id, valor_comissao")
      .eq("id", data.id)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!c) throw new Error("Comissão não encontrada.");

    if (c.payable_id) {
      const hoje = new Date().toISOString().slice(0, 10);
      await supabase
        .from("financial_payables")
        .update({
          status: "paga",
          valor_pago: c.valor_comissao,
          data_pagamento: hoje,
        })
        .eq("id", c.payable_id);
    }
    const { error } = await supabase
      .from("comissoes_usuario")
      .update({ status: "paga" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelarComissaoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: c } = await supabase
      .from("comissoes_usuario")
      .select("payable_id")
      .eq("id", data.id)
      .maybeSingle();
    if (c?.payable_id) {
      await supabase
        .from("financial_payables")
        .update({ status: "cancelada" })
        .eq("id", c.payable_id);
    }
    const { error } = await supabase
      .from("comissoes_usuario")
      .update({ status: "cancelada" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recalcularComissoesProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ proposta_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: qtd, error } = await supabase.rpc(
      "calcular_comissoes_usuario_proposta",
      { _prop_id: data.proposta_id },
    );
    if (error) throw new Error(error.message);
    return { criadas: (qtd as number) ?? 0 };
  });

// Usuários elegíveis para comissão (todos os profiles do correspondente)
export interface UsuarioComissionavel {
  id: string;
  nome: string | null;
  email: string | null;
  tipo_pessoa: string | null;
}

export const listarUsuariosComissionaveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioComissionavel[]> => {
    const { supabase, userId } = context;
    const corr = await corrDoUsuario(supabase, userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email, tipo_pessoa")
      .eq("correspondente_id", corr)
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as UsuarioComissionavel[];
  });

// Bancos disponíveis (para o filtro do formulário)
export const listarBancosComissao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase } = context;
    const { data } = await supabase
      .from("homefin_bancos")
      .select("nome_banco")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    return Array.from(new Set((data ?? []).map((b: any) => b.nome_banco).filter(Boolean)));
  });

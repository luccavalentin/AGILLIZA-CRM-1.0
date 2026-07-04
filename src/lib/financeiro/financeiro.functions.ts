import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ContaTipo = "pagar" | "receber";

const TABELA: Record<ContaTipo, "financial_payables" | "financial_receivables"> = {
  pagar: "financial_payables",
  receber: "financial_receivables",
};

async function correspondenteId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário sem correspondente vinculado.");
  return data as string;
}

async function registrarAuditoria(
  supabase: any,
  correspondente_id: string,
  entidade: string,
  entidade_id: string,
  acao: string,
  dados: Record<string, unknown>,
) {
  await supabase.from("financial_audit_logs").insert({
    correspondente_id,
    entidade,
    entidade_id,
    acao,
    dados,
  });
}

async function registrarHistorico(
  supabase: any,
  correspondente_id: string,
  tipo: ContaTipo,
  entidade_id: string,
  evento: string,
  descricao: string | null,
  valor: number | null,
) {
  await supabase.from("financial_payable_history").insert({
    correspondente_id,
    entidade: tipo,
    entidade_id,
    evento,
    descricao,
    valor,
  });
}

/** Deriva status efetivo (atrasada) a partir do vencimento. */
function statusEfetivo(status: string, vencimento: string): string {
  if ((status === "aberta" || status === "parcial") && vencimento) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (new Date(vencimento + "T00:00:00") < hoje) return "atrasada";
  }
  return status;
}

export interface ContaListaItem {
  id: string;
  numero: string | null;
  descricao: string;
  contraparte: string | null;
  categoria_nome: string | null;
  centro_custo_nome: string | null;
  vencimento: string;
  valor: number;
  valor_pago: number;
  status: string;
  status_efetivo: string;
}

/** ===== Listagem de contas ===== */
export const listarContas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        tipo: z.enum(["pagar", "receber"]),
        status: z.string().optional(),
        categoria_id: z.string().uuid().optional(),
        cost_center_id: z.string().uuid().optional(),
        contraparte: z.string().optional(),
        de: z.string().optional(),
        ate: z.string().optional(),
        pagina: z.number().int().min(1).default(1),
        porPagina: z.number().int().min(1).max(100).default(30),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ itens: ContaListaItem[]; total: number }> => {
    const { supabase } = context;
    const contraCol = data.tipo === "pagar" ? "fornecedor" : "pagador";
    let query = supabase
      .from(TABELA[data.tipo])
      .select(
        `id, numero, descricao, ${contraCol}, vencimento, valor, valor_pago, status,
         categoria:financial_categories(nome), centro:financial_cost_centers(nome)`,
        { count: "exact" },
      );

    if (data.status) query = query.eq("status", data.status as any);
    if (data.categoria_id) query = query.eq("categoria_id", data.categoria_id);
    if (data.cost_center_id) query = query.eq("cost_center_id", data.cost_center_id);
    if (data.contraparte) query = query.ilike(contraCol, `%${data.contraparte}%`);
    if (data.de) query = query.gte("vencimento", data.de);
    if (data.ate) query = query.lte("vencimento", data.ate);

    const from = (data.pagina - 1) * data.porPagina;
    query = query.order("vencimento", { ascending: true }).range(from, from + data.porPagina - 1);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);

    const itens: ContaListaItem[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      numero: r.numero,
      descricao: r.descricao,
      contraparte: r[contraCol] ?? null,
      categoria_nome: r.categoria?.nome ?? null,
      centro_custo_nome: r.centro?.nome ?? null,
      vencimento: r.vencimento,
      valor: Number(r.valor),
      valor_pago: Number(r.valor_pago),
      status: r.status,
      status_efetivo: statusEfetivo(r.status, r.vencimento),
    }));
    return { itens, total: count ?? 0 };
  });

/** ===== Criar conta ===== */
export const criarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        tipo: z.enum(["pagar", "receber"]),
        descricao: z.string().min(1),
        contraparte: z.string().optional(),
        valor: z.number().positive(),
        vencimento: z.string(),
        categoria_id: z.string().uuid().optional(),
        cost_center_id: z.string().uuid().optional(),
        payment_method_id: z.string().uuid().optional(),
        comprovante_path: z.string().optional(),
        recorrencia: z.enum(["nenhuma", "mensal", "anual"]).default("nenhuma"),
        recorrencia_ate: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const correspondente_id = await correspondenteId(supabase, userId);
    const contraCol = data.tipo === "pagar" ? "fornecedor" : "pagador";

    const registro: Record<string, unknown> = {
      correspondente_id,
      descricao: data.descricao,
      [contraCol]: data.contraparte ?? null,
      valor: data.valor,
      vencimento: data.vencimento,
      categoria_id: data.categoria_id ?? null,
      cost_center_id: data.cost_center_id ?? null,
      payment_method_id: data.payment_method_id ?? null,
      comprovante_path: data.comprovante_path ?? null,
      recorrencia: data.recorrencia,
      recorrencia_ate: data.recorrencia_ate ?? null,
      criador_id: userId,
    };

    const { data: inserted, error } = await supabase
      .from(TABELA[data.tipo])
      .insert(registro as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await registrarHistorico(supabase, correspondente_id, data.tipo, inserted.id, "criada", data.descricao, data.valor);
    await registrarAuditoria(supabase, correspondente_id, `conta_${data.tipo}`, inserted.id, "criada", {
      valor: data.valor,
      vencimento: data.vencimento,
    });
    return { id: inserted.id };
  });

/** ===== Baixar conta (pagamento/recebimento total ou parcial) ===== */
export const baixarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        tipo: z.enum(["pagar", "receber"]),
        id: z.string().uuid(),
        valor: z.number().positive(),
        data_pagamento: z.string(),
        payment_method_id: z.string().uuid().optional(),
        comprovante_path: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ status: string }> => {
    const { supabase, userId } = context;
    const correspondente_id = await correspondenteId(supabase, userId);

    const { data: conta, error: e1 } = await supabase
      .from(TABELA[data.tipo])
      .select("valor, valor_pago, status, comprovante_path")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    if (conta.status === "cancelada" || conta.status === "estornada")
      throw new Error("Conta não pode ser baixada.");

    const novoPago = Number(conta.valor_pago) + data.valor;
    const quitada = novoPago >= Number(conta.valor) - 0.005;
    const novoStatus = quitada ? (data.tipo === "pagar" ? "paga" : "paga") : "parcial";

    const { error: e2 } = await supabase
      .from(TABELA[data.tipo])
      .update({
        valor_pago: novoPago,
        status: novoStatus,
        data_pagamento: data.data_pagamento,
        payment_method_id: data.payment_method_id ?? null,
        comprovante_path: data.comprovante_path ?? conta.comprovante_path ?? null,
        aprovado_por: userId,
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (e2) throw new Error(e2.message);

    // Fluxo de caixa realizado
    await supabase.from("fluxo_caixa").insert({
      correspondente_id,
      data: data.data_pagamento,
      tipo: data.tipo === "pagar" ? "saida" : "entrada",
      origem: data.tipo === "pagar" ? "payable" : "receivable",
      ref_id: data.id,
      descricao: quitada ? "Baixa total" : "Baixa parcial",
      valor: data.valor,
      realizado: true,
    });

    await registrarHistorico(
      supabase,
      correspondente_id,
      data.tipo,
      data.id,
      quitada ? "baixa_total" : "baixa_parcial",
      quitada ? "Quitação total" : "Baixa parcial",
      data.valor,
    );
    await registrarAuditoria(supabase, correspondente_id, `conta_${data.tipo}`, data.id, "baixada", {
      valor: data.valor,
      quitada,
    });
    return { status: novoStatus };
  });

/** ===== Estornar conta ===== */
export const estornarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        tipo: z.enum(["pagar", "receber"]),
        id: z.string().uuid(),
        motivo: z.string().min(3, "Informe o motivo do estorno."),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const correspondente_id = await correspondenteId(supabase, userId);

    const { data: conta, error: e1 } = await supabase
      .from(TABELA[data.tipo])
      .select("*")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    if (conta.estornada) throw new Error("Conta já estornada.");

    // Marca original como estornada
    const { error: e2 } = await supabase
      .from(TABELA[data.tipo])
      .update({ status: "estornada", estornada: true, estorno_motivo: data.motivo })
      .eq("id", data.id);
    if (e2) throw new Error(e2.message);

    // Reverte impacto no fluxo de caixa (entrada negativa correspondente)
    if (Number(conta.valor_pago) > 0) {
      await supabase.from("fluxo_caixa").insert({
        correspondente_id,
        data: new Date().toISOString().slice(0, 10),
        tipo: data.tipo === "pagar" ? "entrada" : "saida",
        origem: data.tipo === "pagar" ? "payable" : "receivable",
        ref_id: data.id,
        descricao: "Estorno",
        valor: Number(conta.valor_pago),
        realizado: true,
      });
    }

    // Cria nova linha de estorno (não deleta a original)
    const { data: nova, error: e3 } = await supabase
      .from(TABELA[data.tipo])
      .insert({
        correspondente_id,
        descricao: `Estorno — ${(conta as any).descricao}`,
        [data.tipo === "pagar" ? "fornecedor" : "pagador"]:
          (conta as any)[data.tipo === "pagar" ? "fornecedor" : "pagador"] ?? null,
        valor: (conta as any).valor,
        vencimento: (conta as any).vencimento,
        status: "estornada",
        estornada: true,
        estorno_de: data.id,
        estorno_motivo: data.motivo,
        criador_id: userId,
      } as any)
      .select("id")
      .single();
    if (e3) throw new Error(e3.message);

    await registrarHistorico(supabase, correspondente_id, data.tipo, data.id, "estornada", data.motivo, null);
    await registrarAuditoria(supabase, correspondente_id, `conta_${data.tipo}`, data.id, "estornada", {
      motivo: data.motivo,
      estorno_linha: nova.id,
    });
    return { ok: true };
  });

/** ===== Cancelar conta ===== */
export const cancelarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        tipo: z.enum(["pagar", "receber"]),
        id: z.string().uuid(),
        motivo: z.string().min(3, "Informe o motivo do cancelamento."),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const correspondente_id = await correspondenteId(supabase, userId);
    const { error } = await supabase
      .from(TABELA[data.tipo])
      .update({ status: "cancelada", estorno_motivo: data.motivo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await registrarHistorico(supabase, correspondente_id, data.tipo, data.id, "cancelada", data.motivo, null);
    await registrarAuditoria(supabase, correspondente_id, `conta_${data.tipo}`, data.id, "cancelada", {
      motivo: data.motivo,
    });
    return { ok: true };
  });

/** ===== Detalhe da conta ===== */
export const obterConta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ tipo: z.enum(["pagar", "receber"]), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ conta: any; historico: any[] }> => {
    const { supabase } = context;
    const { data: conta, error } = await supabase
      .from(TABELA[data.tipo])
      .select(
        `*, categoria:financial_categories(nome), centro:financial_cost_centers(nome), metodo:financial_payment_methods(nome)`,
      )
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { data: historico } = await supabase
      .from("financial_payable_history")
      .select("*")
      .eq("entidade", data.tipo)
      .eq("entidade_id", data.id)
      .order("created_at", { ascending: false });

    return { conta, historico: historico ?? [] };
  });

/** ===== Comissões ===== */
export interface ComissaoItem {
  id: string;
  numero_proposta: string | null;
  banco_nome: string | null;
  valor_bruto: number;
  split_parceiro: number;
  split_interno: number;
  status: string;
  proposta_id: string | null;
}

export const listarComissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ status: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<ComissaoItem[]> => {
    const { supabase } = context;
    let query = supabase
      .from("comissoes")
      .select("id, banco_nome, valor_bruto, split_parceiro, split_interno, status, proposta_id, proposta:propostas(numero_proposta)")
      .order("created_at", { ascending: false });
    if (data.status) query = query.eq("status", data.status as any);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      numero_proposta: r.proposta?.numero_proposta ?? null,
      banco_nome: r.banco_nome,
      valor_bruto: Number(r.valor_bruto),
      split_parceiro: Number(r.split_parceiro),
      split_interno: Number(r.split_interno),
      status: r.status,
      proposta_id: r.proposta_id,
    }));
  });

/** ===== Recalcular comissão de uma proposta ===== */
export const recalcularComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ comissao_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ id: string | null }> => {
    const { supabase, userId } = context;
    const correspondente_id = await correspondenteId(supabase, userId);

    const { data: com, error } = await supabase
      .from("comissoes")
      .select("id, proposta_id, receivable_id, payable_id")
      .eq("id", data.comissao_id)
      .single();
    if (error) throw new Error(error.message);
    if (!com.proposta_id) throw new Error("Comissão sem proposta vinculada.");

    // Remove recebíveis/pagáveis ainda em aberto vinculados à comissão
    if (com.receivable_id) {
      await supabase.from("financial_receivables").delete().eq("id", com.receivable_id).eq("status", "aberta");
    }
    if (com.payable_id) {
      await supabase.from("financial_payables").delete().eq("id", com.payable_id).eq("status", "aberta");
    }
    await supabase.from("comissoes").delete().eq("id", com.id);

    const { data: novo, error: e2 } = await supabase.rpc("calcular_comissao_proposta", {
      _prop_id: com.proposta_id,
    });
    if (e2) throw new Error(e2.message);
    await registrarAuditoria(supabase, correspondente_id, "comissao", com.id, "recalculada", {
      proposta_id: com.proposta_id,
    });
    return { id: (novo as string) ?? null };
  });

/** ===== Configurações (categorias, centros, formas) ===== */
export const listarConfigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [cats, ccs, pms] = await Promise.all([
      supabase.from("financial_categories").select("id, nome, tipo").eq("ativo", true).order("nome"),
      supabase.from("financial_cost_centers").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("financial_payment_methods").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    return {
      categorias: cats.data ?? [],
      centrosCusto: ccs.data ?? [],
      formasPagamento: pms.data ?? [],
    };
  });

export const criarConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        entidade: z.enum(["categoria", "centro", "forma"]),
        nome: z.string().min(1),
        tipo: z.enum(["despesa", "receita"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const correspondente_id = await correspondenteId(supabase, userId);
    const tabela =
      data.entidade === "categoria"
        ? "financial_categories"
        : data.entidade === "centro"
          ? "financial_cost_centers"
          : "financial_payment_methods";
    const registro: Record<string, unknown> = { correspondente_id, nome: data.nome };
    if (data.entidade === "categoria") registro.tipo = data.tipo ?? "despesa";
    const { data: ins, error } = await supabase.from(tabela).insert(registro as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

/** ===== Regras de comissão ===== */
export const listarRegrasComissao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("comissao_regras")
      .select("*")
      .order("faixa_min", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** ===== KPIs do painel ===== */
export interface FinanceiroKpis {
  aReceberHoje: number;
  aReceber30d: number;
  aPagarHoje: number;
  aPagar30d: number;
  saldoProjetado: number;
  inadimplencia: number;
  receitaDespesaMensal: { mes: string; receita: number; despesa: number }[];
  receitaPorBanco: { nome: string; valor: number }[];
  despesaPorCategoria: { nome: string; valor: number }[];
}

export const obterKpisFinanceiros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FinanceiroKpis> => {
    const { supabase } = context;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const hojeStr = iso(hoje);
    const em30 = new Date(hoje);
    em30.setDate(em30.getDate() + 30);
    const em30Str = iso(em30);
    const limiteInadimplencia = new Date(hoje);
    limiteInadimplencia.setDate(limiteInadimplencia.getDate() - 10);
    const inadimStr = iso(limiteInadimplencia);
    const doze = new Date(hoje);
    doze.setMonth(doze.getMonth() - 11);
    doze.setDate(1);
    const dozeStr = iso(doze);

    const abertos = ["aberta", "parcial"] as any;

    const [recAll, payAll, recRealizado, payRealizado, inadim] = await Promise.all([
      supabase
        .from("financial_receivables")
        .select("valor, valor_pago, vencimento, banco_nome, status")
        .in("status", abertos),
      supabase
        .from("financial_payables")
        .select("valor, valor_pago, vencimento, status, categoria:financial_categories(nome)")
        .in("status", abertos),
      supabase
        .from("financial_receivables")
        .select("valor, data_pagamento, banco_nome")
        .in("status", ["paga"] as any)
        .gte("data_pagamento", dozeStr),
      supabase
        .from("financial_payables")
        .select("valor, data_pagamento, categoria:financial_categories(nome)")
        .in("status", ["paga"] as any)
        .gte("data_pagamento", dozeStr),
      supabase
        .from("financial_receivables")
        .select("valor, valor_pago")
        .in("status", abertos)
        .lt("vencimento", inadimStr),
    ]);

    const saldoAberto = (r: any) => Number(r.valor) - Number(r.valor_pago);

    const recRows = recAll.data ?? [];
    const payRows = payAll.data ?? [];

    const aReceberHoje = recRows.filter((r: any) => r.vencimento <= hojeStr).reduce((s: number, r: any) => s + saldoAberto(r), 0);
    const aReceber30d = recRows.filter((r: any) => r.vencimento <= em30Str).reduce((s: number, r: any) => s + saldoAberto(r), 0);
    const aPagarHoje = payRows.filter((r: any) => r.vencimento <= hojeStr).reduce((s: number, r: any) => s + saldoAberto(r), 0);
    const aPagar30d = payRows.filter((r: any) => r.vencimento <= em30Str).reduce((s: number, r: any) => s + saldoAberto(r), 0);
    const saldoProjetado = aReceber30d - aPagar30d;
    const inadimplencia = (inadim.data ?? []).reduce((s: number, r: any) => s + saldoAberto(r), 0);

    // Receita vs despesa mensal (realizado, últimos 12 meses)
    const meses: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje);
      d.setMonth(d.getMonth() - (11 - i));
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const mapMes: Record<string, { receita: number; despesa: number }> = {};
    meses.forEach((m) => (mapMes[m] = { receita: 0, despesa: 0 }));
    (recRealizado.data ?? []).forEach((r: any) => {
      const m = (r.data_pagamento ?? "").slice(0, 7);
      if (mapMes[m]) mapMes[m].receita += Number(r.valor);
    });
    (payRealizado.data ?? []).forEach((r: any) => {
      const m = (r.data_pagamento ?? "").slice(0, 7);
      if (mapMes[m]) mapMes[m].despesa += Number(r.valor);
    });
    const receitaDespesaMensal = meses.map((m) => ({ mes: m, receita: mapMes[m].receita, despesa: mapMes[m].despesa }));

    // Receita por banco (a receber em aberto)
    const bancoMap: Record<string, number> = {};
    recRows.forEach((r: any) => {
      const k = r.banco_nome ?? "Outros";
      bancoMap[k] = (bancoMap[k] ?? 0) + saldoAberto(r);
    });
    const receitaPorBanco = Object.entries(bancoMap)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);

    // Despesa por categoria (a pagar em aberto)
    const catMap: Record<string, number> = {};
    payRows.forEach((r: any) => {
      const k = r.categoria?.nome ?? "Sem categoria";
      catMap[k] = (catMap[k] ?? 0) + saldoAberto(r);
    });
    const despesaPorCategoria = Object.entries(catMap)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);

    return {
      aReceberHoje,
      aReceber30d,
      aPagarHoje,
      aPagar30d,
      saldoProjetado,
      inadimplencia,
      receitaDespesaMensal,
      receitaPorBanco,
      despesaPorCategoria,
    };
  });

/** ===== Fluxo de caixa (projetado + realizado, por período) ===== */
export interface FluxoPonto {
  periodo: string;
  entrada: number;
  saida: number;
  saldo: number;
}

export const obterFluxoCaixa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ granularidade: z.enum(["dia", "semana", "mes"]).default("mes") }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<FluxoPonto[]> => {
    const { supabase } = context;
    const abertos = ["aberta", "parcial"] as any;
    const [rec, pay] = await Promise.all([
      supabase.from("financial_receivables").select("valor, valor_pago, vencimento").in("status", abertos),
      supabase.from("financial_payables").select("valor, valor_pago, vencimento").in("status", abertos),
    ]);

    const chave = (iso: string): string => {
      const d = new Date(iso + "T00:00:00");
      if (data.granularidade === "mes") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (data.granularidade === "semana") {
        const onejan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
        return `${d.getFullYear()}-S${String(week).padStart(2, "0")}`;
      }
      return iso;
    };

    const mapa: Record<string, { entrada: number; saida: number }> = {};
    const saldoAberto = (r: any) => Number(r.valor) - Number(r.valor_pago);
    (rec.data ?? []).forEach((r: any) => {
      const k = chave(r.vencimento);
      (mapa[k] ??= { entrada: 0, saida: 0 }).entrada += saldoAberto(r);
    });
    (pay.data ?? []).forEach((r: any) => {
      const k = chave(r.vencimento);
      (mapa[k] ??= { entrada: 0, saida: 0 }).saida += saldoAberto(r);
    });

    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, v]) => ({ periodo, entrada: v.entrada, saida: v.saida, saldo: v.entrada - v.saida }));
  });

/** Exclui uma conta a pagar ou a receber. */
export const excluirConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tipo: z.enum(["pagar", "receber"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from(TABELA[data.tipo]).delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

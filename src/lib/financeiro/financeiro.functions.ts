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
    let query = supabase.from(TABELA[data.tipo]).select(
      `id, numero, descricao, ${contraCol}, vencimento, valor, valor_pago, status,
         categoria:financial_categories(nome), centro:financial_cost_centers(nome)`,
      { count: "exact" },
    );

    if (data.status === "atrasada") {
      // "atrasada" é um status derivado (não existe na coluna): abertas/parciais vencidas.
      const hojeStr = new Date().toLocaleDateString("sv");
      query = query.in("status", ["aberta", "parcial"] as any).lt("vencimento", hojeStr);
    } else if (data.status) {
      query = query.eq("status", data.status as any);
    }
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

/** ===== Resumo/KPIs de contas (respeita filtros) ===== */
export interface ContasResumo {
  totalValor: number;
  totalQtd: number;
  abertoValor: number;
  abertoQtd: number;
  pagoValor: number;
  pagoQtd: number;
  atrasadoValor: number;
  atrasadoQtd: number;
}

export const resumoContas = createServerFn({ method: "GET" })
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
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<ContasResumo> => {
    const { supabase } = context;
    const contraCol = data.tipo === "pagar" ? "fornecedor" : "pagador";
    let query = supabase
      .from(TABELA[data.tipo])
      .select("vencimento, valor, valor_pago, status");

    if (data.status === "atrasada") {
      const hojeStr = new Date().toLocaleDateString("sv");
      query = query.in("status", ["aberta", "parcial"] as any).lt("vencimento", hojeStr);
    } else if (data.status) {
      query = query.eq("status", data.status as any);
    }
    if (data.categoria_id) query = query.eq("categoria_id", data.categoria_id);
    if (data.cost_center_id) query = query.eq("cost_center_id", data.cost_center_id);
    if (data.contraparte) query = query.ilike(contraCol, `%${data.contraparte}%`);
    if (data.de) query = query.gte("vencimento", data.de);
    if (data.ate) query = query.lte("vencimento", data.ate);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const resumo: ContasResumo = {
      totalValor: 0,
      totalQtd: 0,
      abertoValor: 0,
      abertoQtd: 0,
      pagoValor: 0,
      pagoQtd: 0,
      atrasadoValor: 0,
      atrasadoQtd: 0,
    };
    for (const r of rows ?? []) {
      const valor = Number(r.valor) || 0;
      const pago = Number(r.valor_pago) || 0;
      const ef = statusEfetivo(r.status, r.vencimento);
      resumo.totalValor += valor;
      resumo.totalQtd += 1;
      if (r.status === "paga") {
        resumo.pagoValor += valor;
        resumo.pagoQtd += 1;
      } else if (r.status === "aberta" || r.status === "parcial") {
        const restante = valor - pago;
        resumo.abertoValor += restante > 0 ? restante : 0;
        resumo.abertoQtd += 1;
        if (ef === "atrasada") {
          resumo.atrasadoValor += restante > 0 ? restante : 0;
          resumo.atrasadoQtd += 1;
        }
      }
    }
    return resumo;
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
        recorrencia: z.enum(["nenhuma", "mensal", "anual", "parcelado"]).default("nenhuma"),
        recorrencia_ate: z.string().optional(),
        parcelas: z.number().int().min(2).max(360).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const correspondente_id = await correspondenteId(supabase, userId);
    const contraCol = data.tipo === "pagar" ? "fornecedor" : "pagador";

    // ===== Parcelado: gera N duplicatas mensais dividindo o valor total =====
    if (data.recorrencia === "parcelado") {
      const n = data.parcelas ?? 0;
      if (n < 2) throw new Error("Informe a quantidade de parcelas (mínimo 2).");
      const totalCentavos = Math.round(data.valor * 100);
      const baseCentavos = Math.floor(totalCentavos / n);
      const resto = totalCentavos - baseCentavos * n;

      const base = new Date(`${data.vencimento}T00:00:00`);
      const linhas = Array.from({ length: n }, (_, i) => {
        const venc = new Date(base);
        venc.setMonth(venc.getMonth() + i);
        // última parcela absorve o arredondamento
        const centavos = baseCentavos + (i === n - 1 ? resto : 0);
        return {
          correspondente_id,
          descricao: `${data.descricao} (${i + 1}/${n})`,
          [contraCol]: data.contraparte ?? null,
          valor: centavos / 100,
          vencimento: venc.toISOString().slice(0, 10),
          categoria_id: data.categoria_id ?? null,
          cost_center_id: data.cost_center_id ?? null,
          payment_method_id: data.payment_method_id ?? null,
          comprovante_path: data.comprovante_path ?? null,
          recorrencia: "parcelado",
          parcelas: n,
          parcela_numero: i + 1,
          criador_id: userId,
        } as Record<string, unknown>;
      });

      const { data: inseridas, error } = await supabase
        .from(TABELA[data.tipo])
        .insert(linhas as any)
        .select("id");
      if (error) throw new Error(error.message);
      const primeiraId = inseridas?.[0]?.id as string;

      await registrarHistorico(
        supabase,
        correspondente_id,
        data.tipo,
        primeiraId,
        "criada",
        `${data.descricao} — ${n} parcelas`,
        data.valor,
      );
      await registrarAuditoria(
        supabase,
        correspondente_id,
        `conta_${data.tipo}`,
        primeiraId,
        "criada",
        { valor: data.valor, vencimento: data.vencimento, parcelas: n },
      );
      return { id: primeiraId };
    }

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

    await registrarHistorico(
      supabase,
      correspondente_id,
      data.tipo,
      inserted.id,
      "criada",
      data.descricao,
      data.valor,
    );
    await registrarAuditoria(
      supabase,
      correspondente_id,
      `conta_${data.tipo}`,
      inserted.id,
      "criada",
      {
        valor: data.valor,
        vencimento: data.vencimento,
      },
    );
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
    if (conta.status === "paga")
      throw new Error("Conta já está totalmente paga.");

    const saldoDevedor = Number(conta.valor) - Number(conta.valor_pago);
    if (data.valor > saldoDevedor + 0.005) {
      throw new Error(
        `Valor da baixa (${data.valor.toFixed(2)}) maior que o saldo devedor (${saldoDevedor.toFixed(2)}).`,
      );
    }
    const novoPago = Number(conta.valor_pago) + data.valor;
    const quitada = novoPago >= Number(conta.valor) - 0.005;
    const novoStatus = quitada ? "paga" : "parcial";

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
    await registrarAuditoria(
      supabase,
      correspondente_id,
      `conta_${data.tipo}`,
      data.id,
      "baixada",
      {
        valor: data.valor,
        quitada,
      },
    );
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
        valor: Number(conta.valor_pago) || (conta as any).valor,
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

    await registrarHistorico(
      supabase,
      correspondente_id,
      data.tipo,
      data.id,
      "estornada",
      data.motivo,
      null,
    );
    await registrarAuditoria(
      supabase,
      correspondente_id,
      `conta_${data.tipo}`,
      data.id,
      "estornada",
      {
        motivo: data.motivo,
        estorno_linha: nova.id,
      },
    );
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
    const { data: atual } = await supabase
      .from(TABELA[data.tipo])
      .select("status, valor_pago")
      .eq("id", data.id)
      .single();
    if (!atual) throw new Error("Conta não encontrada.");
    if (atual.status === "cancelada") throw new Error("Conta já está cancelada.");
    if (atual.status === "estornada") throw new Error("Conta estornada não pode ser cancelada.");
    if (Number(atual.valor_pago) > 0)
      throw new Error("Conta com pagamentos não pode ser cancelada. Estorne antes.");
    const { error } = await supabase
      .from(TABELA[data.tipo])
      .update({ status: "cancelada", estorno_motivo: data.motivo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await registrarHistorico(
      supabase,
      correspondente_id,
      data.tipo,
      data.id,
      "cancelada",
      data.motivo,
      null,
    );
    await registrarAuditoria(
      supabase,
      correspondente_id,
      `conta_${data.tipo}`,
      data.id,
      "cancelada",
      {
        motivo: data.motivo,
      },
    );
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
    z
      .object({
        status: z.string().optional(),
        de: z.string().optional(),
        ate: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<ComissaoItem[]> => {
    const { supabase } = context;
    let query = supabase
      .from("comissoes")
      .select(
        "id, banco_nome, valor_bruto, split_parceiro, split_interno, status, proposta_id, proposta:propostas(numero_proposta,numero_proposta_banco)",
      )
      .order("created_at", { ascending: false });
    if (data.status) query = query.eq("status", data.status as any);
    if (data.de) query = query.gte("created_at", data.de);
    if (data.ate) query = query.lte("created_at", `${data.ate}T23:59:59`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      numero_proposta: r.proposta?.numero_proposta_banco ?? r.proposta?.numero_proposta ?? null,
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
      await supabase
        .from("financial_receivables")
        .delete()
        .eq("id", com.receivable_id)
        .eq("status", "aberta");
    }
    if (com.payable_id) {
      await supabase
        .from("financial_payables")
        .delete()
        .eq("id", com.payable_id)
        .eq("status", "aberta");
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
      supabase
        .from("financial_categories")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .order("nome"),
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
    const { data: ins, error } = await supabase
      .from(tabela)
      .insert(registro as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

/** ===== Configurações (CRUD completo) ===== */
export type ConfigEntidade = "categoria" | "centro" | "forma";

const CONFIG_TABELA: Record<ConfigEntidade, string> = {
  categoria: "financial_categories",
  centro: "financial_cost_centers",
  forma: "financial_payment_methods",
};

export interface ConfigItem {
  id: string;
  nome: string;
  tipo?: string | null;
  ativo: boolean;
}

/** Lista completa (inclui inativos) para as telas de gestão. */
export const listarConfigsGestao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      categorias: ConfigItem[];
      centrosCusto: ConfigItem[];
      formasPagamento: ConfigItem[];
    }> => {
      const { supabase } = context;
      const [cats, ccs, pms] = await Promise.all([
        supabase.from("financial_categories").select("id, nome, tipo, ativo").order("nome"),
        supabase.from("financial_cost_centers").select("id, nome, ativo").order("nome"),
        supabase.from("financial_payment_methods").select("id, nome, ativo").order("nome"),
      ]);
      return {
        categorias: (cats.data ?? []) as ConfigItem[],
        centrosCusto: (ccs.data ?? []) as ConfigItem[],
        formasPagamento: (pms.data ?? []) as ConfigItem[],
      };
    },
  );

export const atualizarConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        entidade: z.enum(["categoria", "centro", "forma"]),
        id: z.string().uuid(),
        nome: z.string().min(1).optional(),
        tipo: z.enum(["despesa", "receita"]).optional(),
        ativo: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const patch: Record<string, unknown> = {};
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.ativo !== undefined) patch.ativo = data.ativo;
    if (data.entidade === "categoria" && data.tipo !== undefined) patch.tipo = data.tipo;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from(CONFIG_TABELA[data.entidade] as any)
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        entidade: z.enum(["categoria", "centro", "forma"]),
        id: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; desativado: boolean }> => {
    const { supabase } = context;
    const tabela = CONFIG_TABELA[data.entidade] as any;
    // Tenta excluir; se houver vínculos (FK), apenas desativa para preservar histórico.
    const { error } = await supabase.from(tabela).delete().eq("id", data.id);
    if (error) {
      const { error: err2 } = await supabase
        .from(tabela)
        .update({ ativo: false } as any)
        .eq("id", data.id);
      if (err2) throw new Error(err2.message);
      return { ok: true, desativado: true };
    }
    return { ok: true, desativado: false };
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
  .inputValidator((data) =>
    z
      .object({ de: z.string().optional(), ate: z.string().optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<FinanceiroKpis> => {
    const { supabase } = context;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const hojeStr = iso(hoje);
    const em30 = new Date(hoje);
    em30.setDate(em30.getDate() + 30);
    // Janela do período: usa de/ate quando informados, senão hoje..+30d.
    const inicioStr = data.de || hojeStr;
    const fimStr = data.ate || iso(em30);
    const em30Str = fimStr;
    const limiteInadimplencia = new Date(hoje);
    limiteInadimplencia.setDate(limiteInadimplencia.getDate() - 10);
    const inadimStr = iso(limiteInadimplencia);
    const doze = new Date(hoje);
    doze.setMonth(doze.getMonth() - 11);
    doze.setDate(1);
    const dozeStr = iso(doze);

    const abertos = ["aberta", "parcial"] as any;

    // Limite alto (50k) para agregações; sem `.limit()`, o Supabase silencia em 1000 linhas
    // e sub-estima os KPIs. Idealmente migrar para sum() no banco quando o volume crescer.
    const CAP = 50000;
    const [recAll, payAll, recRealizado, payRealizado, inadim] = await Promise.all([
      supabase
        .from("financial_receivables")
        .select("valor, valor_pago, vencimento, banco_nome, status")
        .in("status", abertos)
        .limit(CAP),
      supabase
        .from("financial_payables")
        .select("valor, valor_pago, vencimento, status, categoria:financial_categories(nome)")
        .in("status", abertos)
        .limit(CAP),
      supabase
        .from("financial_receivables")
        .select("valor_pago, data_pagamento, banco_nome")
        .in("status", ["paga", "parcial"] as any)
        .gte("data_pagamento", dozeStr)
        .limit(CAP),
      supabase
        .from("financial_payables")
        .select("valor_pago, data_pagamento, categoria:financial_categories(nome)")
        .in("status", ["paga", "parcial"] as any)
        .gte("data_pagamento", dozeStr)
        .limit(CAP),
      supabase
        .from("financial_receivables")
        .select("valor, valor_pago")
        .in("status", abertos)
        .lt("vencimento", inadimStr)
        .limit(CAP),
    ]);
    for (const r of [recAll, payAll, recRealizado, payRealizado, inadim]) {
      if (r.error) throw new Error(`Falha ao carregar indicadores financeiros: ${r.error.message}`);
    }

    const saldoAberto = (r: any) => Number(r.valor) - Number(r.valor_pago);

    const recRows = recAll.data ?? [];
    const payRows = payAll.data ?? [];

    const aReceberHoje = recRows
      .filter((r: any) => r.vencimento === hojeStr)
      .reduce((s: number, r: any) => s + saldoAberto(r), 0);
    const aReceber30d = recRows
      .filter((r: any) => r.vencimento >= inicioStr && r.vencimento <= em30Str)
      .reduce((s: number, r: any) => s + saldoAberto(r), 0);
    const aPagarHoje = payRows
      .filter((r: any) => r.vencimento === hojeStr)
      .reduce((s: number, r: any) => s + saldoAberto(r), 0);
    const aPagar30d = payRows
      .filter((r: any) => r.vencimento >= inicioStr && r.vencimento <= em30Str)
      .reduce((s: number, r: any) => s + saldoAberto(r), 0);
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
      if (mapMes[m]) mapMes[m].receita += Number(r.valor_pago ?? 0);
    });
    (payRealizado.data ?? []).forEach((r: any) => {
      const m = (r.data_pagamento ?? "").slice(0, 7);
      if (mapMes[m]) mapMes[m].despesa += Number(r.valor_pago ?? 0);
    });
    const receitaDespesaMensal = meses.map((m) => ({
      mes: m,
      receita: mapMes[m].receita,
      despesa: mapMes[m].despesa,
    }));

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
      supabase
        .from("financial_receivables")
        .select("valor, valor_pago, vencimento")
        .in("status", abertos)
        .limit(50000),
      supabase
        .from("financial_payables")
        .select("valor, valor_pago, vencimento")
        .in("status", abertos)
        .limit(50000),
    ]);
    if (rec.error) throw new Error(`Falha ao carregar fluxo de caixa: ${rec.error.message}`);
    if (pay.error) throw new Error(`Falha ao carregar fluxo de caixa: ${pay.error.message}`);

    const chave = (iso: string): string => {
      const d = new Date(iso + "T00:00:00");
      if (data.granularidade === "mes")
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (data.granularidade === "semana") {
        const onejan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(
          ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7,
        );
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

    let saldoAcum = 0;
    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, v]) => {
        // Saldo projetado é acumulado: arrasta o resultado dos períodos anteriores.
        saldoAcum += v.entrada - v.saida;
        return {
          periodo,
          entrada: v.entrada,
          saida: v.saida,
          saldo: saldoAcum,
        };
      });
  });

/** Exclui uma conta a pagar ou a receber. */
export const excluirConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tipo: z.enum(["pagar", "receber"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const correspondente_id = await correspondenteId(supabase, userId);
    const { data: atual, error: e0 } = await supabase
      .from(TABELA[data.tipo])
      .select("valor_pago, status, descricao, valor")
      .eq("id", data.id)
      .eq("correspondente_id", correspondente_id)
      .single();
    if (e0) throw new Error(e0.message);
    if (!atual) throw new Error("Conta não encontrada.");
    if (Number(atual.valor_pago) > 0)
      throw new Error("Conta com pagamentos não pode ser excluída. Estorne antes.");
    const { error } = await supabase
      .from(TABELA[data.tipo])
      .delete()
      .eq("id", data.id)
      .eq("correspondente_id", correspondente_id);
    if (error) throw error;
    await registrarAuditoria(
      supabase,
      correspondente_id,
      `conta_${data.tipo}`,
      data.id,
      "excluida",
      { descricao: atual.descricao, valor: Number(atual.valor), status: atual.status },
    );
    return { ok: true };
  });

/** ===== Fluxo de caixa analítico (ERP) ===== */
export interface FluxoPontoAnalitico {
  periodo: string;
  label: string;
  entradaReal: number;
  saidaReal: number;
  entradaProj: number;
  saidaProj: number;
  entrada: number;
  saida: number;
  resultado: number;
  saldoAcum: number;
  futuro: boolean;
}

export interface FluxoResumo {
  saldoRealizado: number;
  totalEntradaReal: number;
  totalSaidaReal: number;
  totalEntradaProj: number;
  totalSaidaProj: number;
  resultadoProj: number;
  saldoFinalProj: number;
  mediaEntrada: number;
  mediaSaida: number;
  melhorPeriodo: { label: string; valor: number } | null;
  piorPeriodo: { label: string; valor: number } | null;
  coberturaPct: number;
  runwayMeses: number | null;
}

export interface FluxoAnalitico {
  granularidade: "dia" | "semana" | "mes";
  pontos: FluxoPontoAnalitico[];
  resumo: FluxoResumo;
  entradasPorCategoria: { nome: string; valor: number }[];
  saidasPorCategoria: { nome: string; valor: number }[];
  proximosVencimentos: {
    tipo: ContaTipo;
    descricao: string;
    contraparte: string | null;
    vencimento: string;
    valor: number;
  }[];
}

export const obterFluxoCaixaAnalitico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ granularidade: z.enum(["dia", "semana", "mes"]).default("mes") })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<FluxoAnalitico> => {
    const { supabase } = context;
    const abertos = ["aberta", "parcial"] as any;
    const hojeStr = new Date().toLocaleDateString("sv");

    const [rec, pay, realiz] = await Promise.all([
      supabase
        .from("financial_receivables")
        .select("valor, valor_pago, vencimento, descricao, pagador, banco_nome")
        .in("status", abertos),
      supabase
        .from("financial_payables")
        .select("valor, valor_pago, vencimento, descricao, fornecedor, categoria:financial_categories(nome)")
        .in("status", abertos),
      supabase
        .from("fluxo_caixa")
        .select("data, tipo, valor")
        .eq("realizado", true),
    ]);

    const recRows = rec.data ?? [];
    const payRows = pay.data ?? [];
    const realizRows = realiz.data ?? [];
    const saldoAberto = (r: any) => Number(r.valor) - Number(r.valor_pago);

    const chave = (iso: string): string => {
      const d = new Date(iso + "T00:00:00");
      if (data.granularidade === "mes")
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (data.granularidade === "semana") {
        const onejan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(
          ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7,
        );
        return `${d.getFullYear()}-S${String(week).padStart(2, "0")}`;
      }
      return iso;
    };
    const rotulo = (periodo: string): string => {
      if (data.granularidade === "mes") {
        const [y, m] = periodo.split("-");
        return `${m}/${y.slice(2)}`;
      }
      if (data.granularidade === "semana") return periodo.replace("-", " ");
      const [, m, d] = periodo.split("-");
      return `${d}/${m}`;
    };

    type Bucket = {
      entradaReal: number;
      saidaReal: number;
      entradaProj: number;
      saidaProj: number;
    };
    const mapa: Record<string, Bucket> = {};
    const get = (k: string): Bucket =>
      (mapa[k] ??= { entradaReal: 0, saidaReal: 0, entradaProj: 0, saidaProj: 0 });

    realizRows.forEach((r: any) => {
      if (!r.data) return;
      const b = get(chave(r.data));
      if (r.tipo === "entrada") b.entradaReal += Number(r.valor);
      else b.saidaReal += Number(r.valor);
    });
    recRows.forEach((r: any) => {
      if (!r.vencimento) return;
      get(chave(r.vencimento)).entradaProj += saldoAberto(r);
    });
    payRows.forEach((r: any) => {
      if (!r.vencimento) return;
      get(chave(r.vencimento)).saidaProj += saldoAberto(r);
    });

    const chaveHoje = chave(hojeStr);
    let saldoAcum = 0;
    const pontos: FluxoPontoAnalitico[] = Object.keys(mapa)
      .sort((a, b) => a.localeCompare(b))
      .map((periodo) => {
        const b = mapa[periodo];
        const entrada = b.entradaReal + b.entradaProj;
        const saida = b.saidaReal + b.saidaProj;
        const resultado = entrada - saida;
        saldoAcum += resultado;
        return {
          periodo,
          label: rotulo(periodo),
          entradaReal: b.entradaReal,
          saidaReal: b.saidaReal,
          entradaProj: b.entradaProj,
          saidaProj: b.saidaProj,
          entrada,
          saida,
          resultado,
          saldoAcum,
          futuro: periodo >= chaveHoje,
        };
      });

    const totalEntradaReal = pontos.reduce((s, p) => s + p.entradaReal, 0);
    const totalSaidaReal = pontos.reduce((s, p) => s + p.saidaReal, 0);
    const totalEntradaProj = pontos.reduce((s, p) => s + p.entradaProj, 0);
    const totalSaidaProj = pontos.reduce((s, p) => s + p.saidaProj, 0);
    const saldoRealizado = totalEntradaReal - totalSaidaReal;
    const resultadoProj = totalEntradaProj - totalSaidaProj;
    const saldoFinalProj = saldoRealizado + resultadoProj;
    const n = pontos.length || 1;
    const mediaEntrada = (totalEntradaReal + totalEntradaProj) / n;
    const mediaSaida = (totalSaidaReal + totalSaidaProj) / n;

    let melhorPeriodo: { label: string; valor: number } | null = null;
    let piorPeriodo: { label: string; valor: number } | null = null;
    pontos.forEach((p) => {
      if (!melhorPeriodo || p.resultado > melhorPeriodo.valor)
        melhorPeriodo = { label: p.label, valor: p.resultado };
      if (!piorPeriodo || p.resultado < piorPeriodo.valor)
        piorPeriodo = { label: p.label, valor: p.resultado };
    });

    const coberturaPct = totalSaidaProj > 0 ? (totalEntradaProj / totalSaidaProj) * 100 : 0;
    const runwayMeses = mediaSaida > 0 ? saldoFinalProj / mediaSaida : null;

    // Distribuição projetada
    const bancoMap: Record<string, number> = {};
    recRows.forEach((r: any) => {
      const k = r.banco_nome ?? "Outras receitas";
      bancoMap[k] = (bancoMap[k] ?? 0) + saldoAberto(r);
    });
    const entradasPorCategoria = Object.entries(bancoMap)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    const catMap: Record<string, number> = {};
    payRows.forEach((r: any) => {
      const k = r.categoria?.nome ?? "Sem categoria";
      catMap[k] = (catMap[k] ?? 0) + saldoAberto(r);
    });
    const saidasPorCategoria = Object.entries(catMap)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    // Próximos vencimentos (a partir de hoje)
    const proximos: FluxoAnalitico["proximosVencimentos"] = [];
    recRows
      .filter((r: any) => r.vencimento >= hojeStr)
      .forEach((r: any) =>
        proximos.push({
          tipo: "receber",
          descricao: r.descricao,
          contraparte: r.pagador ?? r.banco_nome ?? null,
          vencimento: r.vencimento,
          valor: saldoAberto(r),
        }),
      );
    payRows
      .filter((r: any) => r.vencimento >= hojeStr)
      .forEach((r: any) =>
        proximos.push({
          tipo: "pagar",
          descricao: r.descricao,
          contraparte: r.fornecedor ?? null,
          vencimento: r.vencimento,
          valor: saldoAberto(r),
        }),
      );
    proximos.sort((a, b) => a.vencimento.localeCompare(b.vencimento));

    return {
      granularidade: data.granularidade,
      pontos,
      resumo: {
        saldoRealizado,
        totalEntradaReal,
        totalSaidaReal,
        totalEntradaProj,
        totalSaidaProj,
        resultadoProj,
        saldoFinalProj,
        mediaEntrada,
        mediaSaida,
        melhorPeriodo,
        piorPeriodo,
        coberturaPct,
        runwayMeses,
      },
      entradasPorCategoria,
      saidasPorCategoria,
      proximosVencimentos: proximos.slice(0, 10),
    };
  });

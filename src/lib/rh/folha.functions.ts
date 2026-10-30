/**
 * RH · Folha mensal (um lugar só): lançamentos da competência → prévia calculada
 * pela tabela fiscal vigente → fechamento (trava no banco) → holerites.
 *
 * O cálculo é do motor (`holerite-calc.ts`) sobre a entrada única
 * (`entrada-competencia.ts`); o fechamento grava itens, totais e contas a pagar de
 * uma vez pela função do banco `rh_fechar_competencia` (exige RH · Folha · fechar).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { calcularHolerite, type HoleriteEntrada, type LinhaHolerite } from "@/lib/rh/holerite-calc";
import { normalizarTabelaFiscal, tabelaVigente, type Competencia, type TabelaFiscal } from "@/lib/rh/clt";
import {
  LANCAMENTO_EM_HORAS,
  limitesDaCompetencia,
  montarEntradaDaCompetencia,
  type DadosCompetencia,
  type TipoLancamento,
} from "@/lib/rh/entrada-competencia";
import { correspondenteId, dadosSensiveis, exigir } from "@/lib/rh/acesso";

export type StatusCompetencia = "aberta" | "conferida" | "fechada" | "cancelada";

export interface FolhaItem {
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_numero: string | null;
  cargo: string | null;
  salario_base: number;
  proventos: number;
  descontos: number;
  liquido: number;
  gera_conta_pagar: boolean;
  detalhes: {
    adiantamentos: number;
    inss: number;
    irrf: number;
    base_inss: number;
    base_irrf: number;
    fgts: number;
    dependentes_ir: number;
    faltas_dias: number;
    horas_extras: number;
    beneficios_desconto: number;
    lancamentos: number;
  };
  linhas: { proventos: LinhaHolerite[]; descontos: LinhaHolerite[] };
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

export interface Lancamento {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  mes: number;
  ano: number;
  tipo: TipoLancamento;
  quantidade: number | null;
  valor: number;
  descricao: string | null;
  created_at: string;
}

const TIPOS_LANCAMENTO = [
  "hora_extra_50",
  "hora_extra_100",
  "adicional_noturno",
  "atraso",
  "comissao",
  "bonus",
  "outro_provento",
  "desconto",
  "emprestimo_consignado",
  "pensao_alimenticia",
  "contribuicao_sindical",
] as const;

const competenciaSchema = z.object({
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2020).max(2100),
});

const CODIGOS_BENEFICIO = new Set(["120", "121", "122", "130", "131"]);
const r2 = (n: number) => Math.round(n * 100) / 100;

// ------------------------------------------------------------------
// Tabela fiscal
// ------------------------------------------------------------------

/** Vigências visíveis à empresa (padrão do sistema + próprias), já normalizadas. */
export async function carregarTabelasFiscais(supabase: any): Promise<TabelaFiscal[]> {
  const { data, error } = await supabase
    .from("rh_tabelas_fiscais")
    .select(
      "id, correspondente_id, vigencia_desde, salario_minimo, inss_faixas, irrf_faixas, irrf_dependente, irrf_desconto_simplificado, irrf_reducao, salario_familia_quota, salario_familia_teto, fgts_aliquota, fonte",
    )
    .order("vigencia_desde", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => normalizarTabelaFiscal(r));
}

export async function tabelaDaCompetencia(supabase: any, c: Competencia): Promise<TabelaFiscal> {
  const t = tabelaVigente(await carregarTabelasFiscais(supabase), c);
  if (!t) {
    throw new Error(
      `Não há tabela da folha (INSS/IRRF) vigente em ${String(c.mes).padStart(2, "0")}/${c.ano}. Cadastre em RH › Configurações › Tabelas da folha.`,
    );
  }
  return t;
}

/** Tabela vigente na competência (não é dado pessoal: qualquer usuário do RH lê). */
export const obterTabelaFiscal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => competenciaSchema.parse(d))
  .handler(async ({ data, context }): Promise<TabelaFiscal> => tabelaDaCompetencia(context.supabase, data));

// ------------------------------------------------------------------
// Dados da competência
// ------------------------------------------------------------------

/**
 * Quem entra na folha do mês: admitido até o fim dele e não desligado antes do início
 * (quem sai no meio do mês recebe o saldo do mês).
 */
async function carregarDadosCompetencia(
  supabase: any,
  c: Competencia,
  funcionarioId?: string,
): Promise<Array<{ func: any; dados: DadosCompetencia }>> {
  const { inicio, fim } = limitesDaCompetencia(c);
  let qf = supabase
    .from("rh_funcionarios")
    .select(
      "id, nome, numero, cpf, status, data_admissao, data_demissao, jornada_horas_semanais, gerar_contas_pagar_automatico, rh_cargos(nome), rh_departamentos(nome)",
    )
    .is("deletado_em", null)
    .lte("data_admissao", fim)
    .or(`data_demissao.is.null,data_demissao.gte.${inicio}`)
    .order("nome");
  if (funcionarioId) qf = qf.eq("id", funcionarioId);
  const { data: funcs, error } = await qf;
  if (error) throw new Error(error.message);
  const ids = (funcs ?? []).map((f: any) => f.id as string);
  if (ids.length === 0) return [];
  const sensiveis = await dadosSensiveis(supabase, ids);
  const [alts, bens, ocs, adis, lancs, deps] = await Promise.all([
    supabase
      .from("rh_alteracoes_salariais")
      .select("funcionario_id, vigencia, salario_anterior, salario_novo")
      .in("funcionario_id", ids),
    supabase
      .from("rh_funcionario_beneficios")
      .select("funcionario_id, valor, desconto, vigencia_inicio, vigencia_fim, rh_beneficios_tipos(nome)")
      .in("funcionario_id", ids)
      .eq("ativo", true),
    // Faltas pela função do banco (sem CID nem justificativa): a RLS de rh_ocorrencias exige
    // "Ocorrências · ver" e quem fecha a folha sem ela via a prévia sem as faltas — o banco,
    // que recalcula no fechamento, recusaria (auditoria rodada 2).
    supabase.rpc("rh_faltas_da_folha", { p_ids: ids, p_ini: inicio, p_fim: fim }),
    supabase
      .from("rh_adiantamentos")
      .select("funcionario_id, valor")
      .in("funcionario_id", ids)
      .eq("competencia_mes", c.mes)
      .eq("competencia_ano", c.ano)
      .neq("status", "cancelado"),
    supabase
      .from("rh_lancamentos")
      .select("funcionario_id, tipo, quantidade, valor, descricao")
      .in("funcionario_id", ids)
      .eq("mes", c.mes)
      .eq("ano", c.ano)
      .eq("ativo", true),
    supabase.from("rh_dependentes").select("funcionario_id, ir, salario_familia, data_nascimento").in("funcionario_id", ids),
  ]);
  for (const r of [alts, bens, ocs, adis, lancs, deps]) {
    if (r.error) throw new Error(r.error.message);
  }
  const de = (rows: any[] | null | undefined, id: string) => (rows ?? []).filter((r: any) => r.funcionario_id === id);
  return (funcs ?? []).map((f: any) => ({
    func: f,
    dados: {
      salarioAtual: sensiveis.get(f.id)?.salario_atual ?? 0,
      jornadaSemanal: f.jornada_horas_semanais == null ? null : Number(f.jornada_horas_semanais),
      alteracoesSalariais: de(alts.data, f.id).map((a: any) => ({
        vigencia: a.vigencia,
        salario_anterior: a.salario_anterior == null ? null : Number(a.salario_anterior),
        salario_novo: Number(a.salario_novo ?? 0),
      })),
      beneficios: de(bens.data, f.id).map((b: any) => ({
        nome: b.rh_beneficios_tipos?.nome ?? "",
        valor: Number(b.valor ?? 0),
        desconto: Number(b.desconto ?? 0),
        vigencia_inicio: b.vigencia_inicio,
        vigencia_fim: b.vigencia_fim,
      })),
      faltas: de(ocs.data, f.id).map((o: any) => ({ data_inicio: o.data_inicio, data_fim: o.data_fim, abonada: !!o.abonada })),
      adiantamentos: de(adis.data, f.id).map((a: any) => Number(a.valor ?? 0)),
      lancamentos: de(lancs.data, f.id).map((l: any) => ({
        tipo: l.tipo,
        quantidade: l.quantidade == null ? null : Number(l.quantidade),
        valor: Number(l.valor ?? 0),
        descricao: l.descricao,
      })),
      dependentes: de(deps.data, f.id).map((d: any) => ({
        ir: !!d.ir,
        salario_familia: !!d.salario_familia,
        data_nascimento: d.data_nascimento,
      })),
    },
  }));
}

async function calcularPrevia(supabase: any, c: Competencia, funcionarioId?: string): Promise<FolhaItem[]> {
  const tabela = await tabelaDaCompetencia(supabase, c);
  const linhas = await carregarDadosCompetencia(supabase, c, funcionarioId);
  return linhas.map(({ func: f, dados }) => {
    const entrada = montarEntradaDaCompetencia(dados, c);
    const h = calcularHolerite(entrada, tabela);
    const descBeneficios = h.descontos
      .filter((l) => CODIGOS_BENEFICIO.has(l.codigo))
      .reduce((s, l) => s + l.valor, 0);
    return {
      funcionario_id: f.id,
      funcionario_nome: f.nome,
      funcionario_numero: f.numero ?? null,
      cargo: f.rh_cargos?.nome ?? null,
      salario_base: entrada.salario_base,
      proventos: h.total_proventos,
      descontos: h.total_descontos,
      liquido: h.liquido,
      gera_conta_pagar: f.gerar_contas_pagar_automatico !== false,
      detalhes: {
        adiantamentos: entrada.adiantamento,
        inss: h.inss,
        irrf: h.irrf,
        base_inss: h.base_inss,
        base_irrf: h.base_irrf,
        fgts: h.fgts,
        dependentes_ir: entrada.dependentes_ir,
        faltas_dias: entrada.faltas_dias,
        horas_extras: entrada.horas_extras_50 + entrada.horas_extras_100,
        beneficios_desconto: r2(descBeneficios),
        lancamentos: dados.lancamentos.length,
      },
      linhas: { proventos: h.proventos, descontos: h.descontos },
    };
  });
}

/** Entrada do holerite de um funcionário na competência, já com os lançamentos do mês. */
export const entradaHoleriteDaCompetencia = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.salarios", "view"])])
  .validator((data: unknown) =>
    competenciaSchema.extend({ funcionario_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<HoleriteEntrada | null> => {
    const c = { ano: data.ano, mes: data.mes };
    const [linha] = await carregarDadosCompetencia(context.supabase, c, data.funcionario_id);
    return linha ? montarEntradaDaCompetencia(linha.dados, c) : null;
  });

/** Prévia calculada (não grava). Valores por pessoa = salário: exige ver salário e ver a folha. */
export const previaFolha = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.salarios", "view"])])
  .validator((data: unknown) =>
    competenciaSchema.extend({ funcionario_id: z.string().uuid().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigir(context.supabase, context.userId, "rh.folha", "view", "Você não tem permissão para ver a folha.");
    return calcularPrevia(context.supabase, { ano: data.ano, mes: data.mes }, data.funcionario_id);
  });

// ------------------------------------------------------------------
// Lançamentos da competência
// ------------------------------------------------------------------

export const listarLancamentos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.folha", "view"])])
  .validator((data: unknown) =>
    competenciaSchema.extend({ funcionario_id: z.string().uuid().optional() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<Lancamento[]> => {
    let q = context.supabase
      .from("rh_lancamentos")
      .select("id, funcionario_id, mes, ano, tipo, quantidade, valor, descricao, created_at, rh_funcionarios(nome)")
      .eq("mes", data.mes)
      .eq("ano", data.ano)
      .eq("ativo", true)
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
      quantidade: r.quantidade == null ? null : Number(r.quantidade),
      valor: Number(r.valor ?? 0),
      descricao: r.descricao,
      created_at: r.created_at,
    }));
  });

export const salvarLancamento = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.folha", "edit"])])
  .validator((data: unknown) =>
    competenciaSchema
      .extend({
        id: z.string().uuid().optional(),
        funcionario_id: z.string().uuid(),
        tipo: z.enum(TIPOS_LANCAMENTO),
        quantidade: z.number().min(0).max(744).optional().nullable(),
        valor: z.number().min(0).max(10_000_000).default(0),
        descricao: z.string().trim().max(300).optional().nullable(),
      })
      .superRefine((d, ctx) => {
        if (LANCAMENTO_EM_HORAS.has(d.tipo)) {
          if (!d.quantidade || d.quantidade <= 0)
            ctx.addIssue({ code: "custom", message: "Informe as horas.", path: ["quantidade"] });
        } else if (!d.valor || d.valor <= 0) {
          ctx.addIssue({ code: "custom", message: "Informe o valor.", path: ["valor"] });
        }
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const emHoras = LANCAMENTO_EM_HORAS.has(data.tipo);
    const payload = {
      correspondente_id: cid,
      funcionario_id: data.funcionario_id,
      mes: data.mes,
      ano: data.ano,
      tipo: data.tipo,
      quantidade: emHoras ? data.quantidade : null,
      valor: emHoras ? 0 : data.valor,
      descricao: data.descricao || null,
      criado_por: context.userId,
    };
    if (data.id) {
      const { data: rows, error } = await context.supabase
        .from("rh_lancamentos")
        .update(payload)
        .eq("id", data.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new Error("Lançamento não encontrado ou sem permissão.");
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("rh_lancamentos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const excluirLancamento = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.folha", "edit"])])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rh_lancamentos")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Lançamento não encontrado ou sem permissão.");
    return { ok: true };
  });

// ------------------------------------------------------------------
// Competências
// ------------------------------------------------------------------

const mapCompetencia = (r: any): FolhaCompetencia => ({
  ...r,
  total_proventos: Number(r.total_proventos ?? 0),
  total_descontos: Number(r.total_descontos ?? 0),
  total_liquido: Number(r.total_liquido ?? 0),
});

export const listarCompetencias = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.folha", "view"])])
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
    return (data ?? []).map(mapCompetencia);
  });

/**
 * Fecha a competência: o servidor calcula a prévia (mesmo motor da tela) e o banco grava
 * itens, totais, situação e contas a pagar numa transação só.
 */
export const fecharCompetencia = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.folha", "gerir"])])
  .validator((data: unknown) =>
    competenciaSchema
      .extend({
        vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vencimento inválido."),
        observacoes: z.string().max(1000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigir(
      context.supabase,
      context.userId,
      "rh.salarios",
      "view",
      "Fechar a folha exige também a permissão de ver salários.",
    );
    const previa = await calcularPrevia(context.supabase, { ano: data.ano, mes: data.mes });
    if (previa.length === 0) throw new Error("Não há funcionários na folha dessa competência.");
    const itens = previa.map((i) => ({
      funcionario_id: i.funcionario_id,
      salario_base: i.salario_base,
      proventos: i.proventos,
      descontos: i.descontos,
      total_beneficios: 0,
      total_adiantamentos: i.detalhes.adiantamentos,
      liquido: i.liquido,
      detalhamento: { ...i.detalhes, linhas: i.linhas },
    }));
    const { data: r, error } = await context.supabase.rpc("rh_fechar_competencia", {
      p_ano: data.ano,
      p_mes: data.mes,
      p_itens: itens as any,
      p_vencimento: data.vencimento,
      p_observacoes: data.observacoes || null,
    });
    if (error) throw new Error(error.message);
    return r as { competencia_id: string; total: number; contas: number; itens: number };
  });

export const reabrirCompetencia = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.folha", "gerir"])])
  .validator((data: unknown) =>
    competenciaSchema.extend({ motivo: z.string().trim().min(5, "Diga o motivo da reabertura.").max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("rh_reabrir_competencia", {
      p_ano: data.ano,
      p_mes: data.mes,
      p_motivo: data.motivo,
    });
    if (error) throw new Error(error.message);
    return r as { competencia_id: string; contas_removidas: number };
  });

export interface ItemFolhaFechada {
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_numero: string | null;
  funcionario_cpf: string | null;
  cargo: string | null;
  departamento: string | null;
  salario_base: number;
  total_descontos: number;
  total_adiantamentos: number;
  liquido: number;
  detalhamento: Record<string, any>;
}

/** Itens de uma competência fechada (para gerar e publicar os holerites em PDF). */
export const listarItensFolha = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.salarios", "view"])])
  .validator((data: unknown) => competenciaSchema.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ competencia_id: string | null; status: StatusCompetencia | null; itens: ItemFolhaFechada[] }> => {
      const { data: comp } = await context.supabase
        .from("rh_folha_competencias")
        .select("id, status")
        .eq("mes", data.mes)
        .eq("ano", data.ano)
        .maybeSingle();
      if (!comp) return { competencia_id: null, status: null, itens: [] };
      const { data: itens, error } = await context.supabase
        .from("rh_folha_itens")
        .select(
          "funcionario_id, salario_base, total_descontos, total_adiantamentos, liquido, detalhamento, rh_funcionarios(nome, numero, cpf, rh_cargos(nome), rh_departamentos(nome))",
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
          total_descontos: Number(r.total_descontos ?? 0),
          total_adiantamentos: Number(r.total_adiantamentos ?? 0),
          liquido: Number(r.liquido ?? 0),
          detalhamento: r.detalhamento ?? {},
        })),
      };
    },
  );

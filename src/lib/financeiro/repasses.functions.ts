/**
 * Repasse aos assinantes (C45b) e financeiro dos assinantes (C45k) — fonte de verdade no
 * Agilliza Tech (plataforma.comissoes_assinante, migração 0327), lida e escrita pela
 * ponte. O servidor confere a matriz do Agilliza (financeiro.repasses) e o banco confere
 * de novo, pela pessoa dona do operador-espelho. O pagamento entra no livro do
 * correspondente (fin_baixas) — é ele que a conciliação enxerga.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

const uuid = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const motivo = z.string().trim().min(5, "Escreva o motivo (5 letras ou mais).").max(500);

/** "a_conferir" (0481): a base veio só do que a conta informou; o Agilliza confere antes (0495/0500). */
export type StatusRepasse = "a_pagar" | "a_conferir" | "aguardando_base" | "aprovada" | "parcial" | "paga" | "cancelada";
export type BaseRepasse = "valor_financiado" | "valor_contrato" | "comissao_recebida";

export interface Repasse {
  id: string;
  tenant_id: string;
  conta: string;
  tipo_conta: string;
  proposta: string;
  proposta_agilliza_id: string | null;
  numero_agilliza: string | null;
  cliente: string | null;
  base: number;
  base_tipo: BaseRepasse;
  base_fonte: string | null;
  base_provisoria: boolean;
  percentual: number;
  regra_escopo: "padrao" | "conta" | null;
  valor: number;
  valor_calculado: number | null;
  valor_pago: number;
  saldo: number;
  status: StatusRepasse;
  registrado_em: string;
  aprovada_em: string | null;
  paga_em: string | null;
  observacao: string | null;
  motivo_cancelamento: string | null;
  ultimo_ajuste_motivo: string | null;
}

export interface ListaRepasses {
  itens: Repasse[];
  totais: {
    previsto: number;
    aprovado: number;
    pago: number;
    cancelado: number;
    quantidade: number;
    aguardando_base: number;
    /** Em conferência (0481/0500): fora do previsto. Banco anterior à 0500 não traz. */
    a_conferir?: number;
    em_conferencia?: number;
  };
}

export interface RegraRepasse {
  id: string;
  tenant_id: string | null;
  conta: string | null;
  tipo_conta: string | null;
  percentual: number;
  base: BaseRepasse;
  gatilho: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  motivo: string | null;
  criado_em: string;
  encerrada_em: string | null;
  vigente: boolean;
}

export interface AssinanteFinanceiro {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  vinculo_agilliza: boolean | null;
  plano: string | null;
  licenca_recebida: number;
  faturas_pagas: number;
  licenca_a_vencer: number;
  inadimplencia: number;
  faturas_vencidas: number;
  vencida_desde: string | null;
  ultimo_pagamento: string | null;
  receita_avulsa: number;
  repasse_a_pagar: number;
  repasse_pago_periodo: number;
  contratos_registrados: number;
}

export interface FinanceiroAssinantes {
  itens: AssinanteFinanceiro[];
  totais: {
    licenca_recebida: number;
    licenca_a_vencer: number;
    inadimplencia: number;
    contas_inadimplentes: number;
    receita_avulsa: number;
    repasse_a_pagar: number;
    repasse_pago_periodo: number;
    contas_ativas: number;
    contas_teste: number;
  };
  por_mes: { mes: string; licenca: number; avulsa: number; repasse_pago: number }[];
}

/** O que volta do banco (jsonb): serializável de ponta a ponta. */
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

async function ponte() {
  return import("@/lib/plataforma/ponte.server");
}

export const listarRepasses = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["financeiro.repasses", "view"])])
  .validator((d: unknown) =>
    z
      .object({
        status: z.string().max(20).nullable().optional(),
        tenant_id: uuid.nullable().optional(),
        de: data.nullable().optional(),
        ate: data.nullable().optional(),
        busca: z.string().trim().max(120).nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data: f, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: ListaRepasses }>("select plataforma.repasses_listar($1::jsonb) as j", [JSON.stringify(f)]);
      return r?.j ?? { itens: [], totais: { previsto: 0, aprovado: 0, pago: 0, cancelado: 0, quantidade: 0, aguardando_base: 0 } };
    });
  });

export const detalheRepasse = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["financeiro.repasses", "view"])])
  .validator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: Json }>("select plataforma.repasse_detalhe($1) as j", [d.id]);
      return r?.j ?? null;
    });
  });

export const regrasRepasse = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["financeiro.repasses", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: { vigente_padrao: RegraRepasse; regras: RegraRepasse[] } }>(
        "select plataforma.repasse_regras_listar() as j",
      );
      return r?.j ?? null;
    });
  });

export const definirRegraRepasse = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["financeiro.repasses", "regras"])])
  .validator((d: unknown) =>
    z
      .object({
        tenantId: uuid.nullable(),
        percentual: z.number().min(0, "De 0 a 10%.").max(10, "De 0 a 10%.").nullable(),
        base: z.enum(["valor_financiado", "valor_contrato", "comissao_recebida"]).nullable(),
        inicio: data,
        motivo: z.string().trim().max(300).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.repasse_regra_definir($1, $2, $3, $4::date, $5)", [
        d.tenantId,
        d.percentual,
        d.base,
        d.inicio,
        d.motivo || null,
      ]),
    );
    return { ok: true as const };
  });

export const aprovarRepasses = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["financeiro.repasses", "aprovar"])])
  .validator((d: unknown) => z.object({ ids: z.array(uuid).min(1).max(500) }).parse(d))
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: { aprovados: number; recusados: number } }>("select plataforma.repasse_aprovar($1::uuid[]) as j", [
        d.ids,
      ]);
      return r?.j ?? { aprovados: 0, recusados: d.ids.length };
    });
  });

export const confirmarBaseRepasse = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["financeiro.repasses", "aprovar"])])
  .validator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ ok: boolean }>("select plataforma.repasse_confirmar_base($1) as ok", [d.id]);
      return { confirmada: !!r?.ok };
    });
  });

export const ajustarRepasse = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["financeiro.repasses", "edit"])])
  .validator((d: unknown) => z.object({ id: uuid, valor: z.number().min(0).max(999_999_999), motivo }).parse(d))
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.repasse_ajustar($1, $2, $3)", [d.id, d.valor, d.motivo]),
    );
    return { ok: true as const };
  });

export const cancelarRepasse = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["financeiro.repasses", "edit"])])
  .validator((d: unknown) => z.object({ id: uuid, motivo }).parse(d))
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) => tx.consultar("select plataforma.repasse_cancelar($1, $2)", [d.id, d.motivo]));
    return { ok: true as const };
  });

export const pagarRepasse = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["financeiro.repasses", "pagar"])])
  .validator((d: unknown) =>
    z
      .object({
        id: uuid,
        valor: z.number().positive().max(999_999_999),
        data,
        contaBancaria: uuid.nullable().default(null),
        forma: z.string().trim().max(60).nullable().default(null),
        documento: z.string().trim().max(120).nullable().default(null),
        observacao: z.string().trim().max(500).nullable().default(null),
        anexo: uuid.nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ id: string }>(
        "select plataforma.repasse_registrar_pagamento($1, $2, $3::date, $4, $5, $6, $7, $8) as id",
        [d.id, d.valor, d.data, d.contaBancaria, d.forma, d.documento, d.observacao, d.anexo],
      );
      return { id: r?.id ?? null };
    });
  });

export const estornarPagamentoRepasse = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["financeiro.repasses", "pagar"])])
  .validator((d: unknown) => z.object({ baixaId: uuid, motivo }).parse(d))
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.repasse_estornar_pagamento($1, $2)", [d.baixaId, d.motivo]),
    );
    return { ok: true as const };
  });

/** Licenças, inadimplência, receita avulsa e repasse por assinante (C45k). */
export const financeiroAssinantes = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["financeiro.repasses", "view"])])
  .validator((d: unknown) => z.object({ de: data, ate: data, busca: z.string().trim().max(120).nullable().optional() }).parse(d))
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: FinanceiroAssinantes }>(
        "select plataforma.financeiro_matriz_assinantes($1::date, $2::date, $3) as j",
        [d.de, d.ate, d.busca || null],
      );
      return r?.j ?? null;
    });
  });

/** Contas assinantes para escolher numa regra própria. */
export const contasParaRegraRepasse = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["financeiro.repasses", "regras"])])
  .validator((d: unknown) => z.object({ busca: z.string().trim().max(80) }).parse(d))
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await ponte();
    const termo = d.busca.replace(/[\\%_]/g, (c) => "\\" + c);
    return comPlataforma(context.userId, (tx) =>
      tx.consultar<{ id: string; nome: string; tipo: string }>(
        `select id, nome, tipo::text as tipo from nucleo.tenants
          where deleted_at is null and tipo not in ('plataforma', 'particular') and nome ilike '%' || $1 || '%'
          order by nome limit 20`,
        [termo],
      ),
    );
  });

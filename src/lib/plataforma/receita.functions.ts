/**
 * Receita e cobrança da plataforma (assinaturas e faturas dos assinantes do Agilliza Tech),
 * administradas pelo Agilliza. Mesmas consultas e regras da Gestão do Corretor.
 *
 * Sem gateway ligado, é aqui que o Agilliza confirma o Pix recebido ("dar baixa"): a baixa
 * da fatura é o que libera o crédito comprado ou mantém a assinatura em dia.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

/**
 * Licenças por dias de acesso (pré-pagas, Corretor 0193/0204/0253): a última compra de acesso
 * paga de cada conta, com o período (mensal, trimestral, semestral, anual). Conta com
 * assinatura recorrente vigente fica de fora (ela já entra pela assinatura).
 */
const ULTIMA_LICENCA_PAGA = `
  select t.id as tenant_id, t.nome as conta, t.tipo::text as conta_tipo, t.status::text as conta_status,
         t.acesso_ate, f.valor, coalesce(f.periodo_acesso, 'mensal') as periodo, f.pago_em,
         coalesce(f.plano_acesso_id, t.plano_id) as plano_id,
         case coalesce(f.periodo_acesso, 'mensal') when 'anual' then 12 when 'semestral' then 6
              when 'trimestral' then 3 else 1 end as meses
    from nucleo.tenants t
    join lateral (select x.valor, x.periodo_acesso, x.pago_em, x.plano_acesso_id
                    from nucleo.faturas_plataforma x
                   where x.tenant_id = t.id and x.status = 'paga' and x.dias_acesso is not null and x.valor > 0
                   order by coalesce(x.pago_em, x.atualizado_em) desc, x.criado_em desc
                   limit 1) f on true
   where t.deleted_at is null and t.tipo <> 'plataforma'
     and not exists (select 1 from nucleo.assinaturas a
                      where a.tenant_id = t.id and a.cancelada_em is null
                        and a.status::text in ('ativa', 'inadimplente'))`;

/** Meses de cada ciclo/período: o valor dividido por isto é a receita mensal. */
const MESES_SQL = (col: string) =>
  `case ${col} when 'anual' then 12 when 'semestral' then 6 when 'trimestral' then 3 else 1 end`;

export interface ResumoReceita {
  mrr: number;
  /** Receita mensal das licenças por pacote vigentes (valor ÷ meses do período, 0253). */
  mrr_licencas: number;
  /** Contas com licença por dias de acesso paga e vigente. */
  contas_licenca: number;
  contas_pagantes: number;
  contas_teste: number;
  pendente_valor: number;
  vencida_valor: number;
  vencidas: number;
  recebido_mes: number;
  /** Quantidades por filtro da lista de faturas (chips da tela). */
  qtd_abertas: number;
  qtd_pagas: number;
  qtd_faturas: number;
}

export interface MesReceita {
  mes: string;
  mrr_inicio: number;
  novo: number;
  expansao: number;
  contracao: number;
  churn: number;
  reativacao: number;
  mrr_fim: number;
}

export interface FaturaPlataforma {
  id: string;
  conta: string;
  conta_status: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: "pendente" | "vencida" | "paga" | "cancelada" | "estornada";
  forma: string | null;
  pago_em: string | null;
  vencida: boolean;
  /** Fatura de licença: o período comprado (mensal, trimestral, semestral, anual — 0253). */
  periodo: string | null;
}

export const lerReceita = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.receita", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      const resumo = await tx.uma<ResumoReceita>(
        `select
           coalesce((select sum(a.valor / ${MESES_SQL("a.ciclo::text")})
                       from nucleo.assinaturas a
                      where a.cancelada_em is null and a.status::text in ('ativa', 'inadimplente')), 0)::float8 as mrr,
           coalesce((select sum(l.valor / l.meses) from (${ULTIMA_LICENCA_PAGA}) l
                      where l.conta_status = 'ativo' and l.acesso_ate >= current_date), 0)::float8 as mrr_licencas,
           (select count(*) from (${ULTIMA_LICENCA_PAGA}) l
             where l.conta_status = 'ativo' and l.acesso_ate >= current_date)::int as contas_licenca,
           (select count(distinct a.tenant_id) from nucleo.assinaturas a
             where a.cancelada_em is null and a.status::text = 'ativa')::int as contas_pagantes,
           (select count(*) from nucleo.tenants t
             where t.deleted_at is null and t.tipo <> 'plataforma' and t.status = 'trial')::int as contas_teste,
           coalesce((select sum(valor) from nucleo.faturas_plataforma where status in ('pendente', 'vencida')), 0)::float8 as pendente_valor,
           coalesce((select sum(valor) from nucleo.faturas_plataforma
                      where status = 'vencida' or (status = 'pendente' and vencimento < current_date)), 0)::float8 as vencida_valor,
           (select count(*) from nucleo.faturas_plataforma
             where status = 'vencida' or (status = 'pendente' and vencimento < current_date))::int as vencidas,
           coalesce((select sum(valor) from nucleo.faturas_plataforma
                      where status = 'paga' and pago_em >= date_trunc('month', now())), 0)::float8 as recebido_mes,
           (select count(*) from nucleo.faturas_plataforma where status in ('pendente', 'vencida'))::int as qtd_abertas,
           (select count(*) from nucleo.faturas_plataforma where status = 'paga')::int as qtd_pagas,
           (select count(*) from nucleo.faturas_plataforma)::int as qtd_faturas`,
      );
      const meses = await tx.consultar<MesReceita>(
        `select mes::text as mes, mrr_inicio::float8 as mrr_inicio, novo::float8 as novo,
                expansao::float8 as expansao, contracao::float8 as contracao, churn::float8 as churn,
                reativacao::float8 as reativacao, mrr_fim::float8 as mrr_fim
           from receita.mrr_mensal(12)`,
      );
      return { resumo, meses };
    });
  });

export const FILTROS_FATURA = ["abertas", "vencidas", "pagas", "todas"] as const;
export type FiltroFatura = (typeof FILTROS_FATURA)[number];
export const POR_PAGINA_FATURAS = 50;

/**
 * Faturas dos assinantes, filtradas e paginadas no banco. Antes vinham as 300 primeiras e o
 * filtro rodava no navegador: com 2.000 contas, "Pagas" mostrava quase nada e o resto sumia.
 */
export const listarFaturasPlataforma = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.receita", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        filtro: z.enum(FILTROS_FATURA).default("abertas"),
        busca: z.string().trim().max(120).optional().nullable(),
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const busca = data.busca ? data.busca.replace(/[\\%_]/g, (c) => "\\" + c) : null;
    return comPlataforma(context.userId, async (tx) => {
      const faturas = await tx.consultar<FaturaPlataforma & { total: number }>(
        `select f.id, t.nome as conta, t.status::text as conta_status, f.descricao, f.valor::float8 as valor,
                f.vencimento::text as vencimento, f.status::text as status, f.forma::text as forma,
                f.pago_em::text as pago_em,
                case when f.dias_acesso is not null then coalesce(f.periodo_acesso, 'mensal') end as periodo,
                (f.status = 'vencida' or (f.status = 'pendente' and f.vencimento < current_date)) as vencida,
                (count(*) over ())::int as total
           from nucleo.faturas_plataforma f
           join nucleo.tenants t on t.id = f.tenant_id
          where case $1::text
                  when 'abertas' then f.status in ('pendente', 'vencida')
                  when 'vencidas' then f.status = 'vencida' or (f.status = 'pendente' and f.vencimento < current_date)
                  when 'pagas' then f.status = 'paga'
                  else true
                end
            and ($2::text is null or t.nome ilike '%' || $2 || '%' or f.descricao ilike '%' || $2 || '%')
          order by (f.status in ('pendente', 'vencida')) desc,
                   case when f.status in ('pendente', 'vencida') then f.vencimento end asc,
                   f.vencimento desc, f.id
          limit ${POR_PAGINA_FATURAS} offset $3`,
        [data.filtro, busca, (data.pagina - 1) * POR_PAGINA_FATURAS],
      );
      return {
        faturas: faturas.map(({ total: _t, ...f }) => f as FaturaPlataforma),
        total: faturas[0]?.total ?? 0,
      };
    });
  });

/** Confirma o pagamento (Pix/boleto/cartão recebido fora do gateway). */
export const baixarFaturaPlataforma = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.receita", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), forma: z.enum(["pix", "boleto", "cartao"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        `update nucleo.faturas_plataforma set status = 'paga', forma = $2, pago_em = now()
          where id = $1 and status in ('pendente', 'vencida') returning id`,
        [data.id, data.forma],
      ),
    );
    if (!r) throw new Error("Fatura não encontrada ou já baixada.");
    return { ok: true as const };
  });

/** Cancela uma fatura não paga (erro de emissão, cortesia, renegociação). */
export const cancelarFaturaPlataforma = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.receita", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        "update nucleo.faturas_plataforma set status = 'cancelada' where id = $1 and status in ('pendente', 'vencida') returning id",
        [data.id],
      ),
    );
    if (!r) throw new Error("Só é possível cancelar fatura em aberto.");
    return { ok: true as const };
  });

export interface AssinaturaPlataforma {
  id: string;
  tenant_id: string;
  conta: string;
  conta_tipo: string;
  plano: string | null;
  status: string;
  ciclo: string;
  valor: number;
  mrr: number;
  quantidade_usuarios: number | null;
  inicio_em: string | null;
  proxima_cobranca_em: string | null;
  cancelada_em: string | null;
  motivo_cancelamento: string | null;
  /**
   * Licença por dias de acesso (pré-paga), não assinatura recorrente: `ciclo` é o período da
   * última compra paga (mensal, trimestral, semestral, anual) e `proxima_cobranca_em` é o
   * fim do acesso. Não tem cancelar.
   */
  licenca: boolean;
}

export const POR_PAGINA_ASSINATURAS = 50;

/** Assinaturas (vigentes primeiro), uma página por vez, e as contas/planos para criar uma nova. */
export const listarAssinaturas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.receita", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        busca: z.string().trim().max(120).optional().nullable(),
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const busca = data.busca ? data.busca.replace(/[\\%_]/g, (c) => "\\" + c) : null;
    return comPlataforma(context.userId, async (tx) => {
      const linhas = await tx.consultar<AssinaturaPlataforma & { total: number; ordem: unknown }>(
        // Assinaturas recorrentes + licenças por dias de acesso (a última compra paga de cada
        // conta, no período dela: "R$ 863,10/trimestre" — 0253). A licença não se cancela
        // aqui: ela só não é renovada (e não tem id de assinatura).
        `select x.*, (count(*) over ())::int as total
           from (
             select a.id::text as id, a.tenant_id, t.nome as conta, t.tipo::text as conta_tipo, p.nome as plano,
                    a.status::text as status, a.ciclo::text as ciclo, a.valor::float8 as valor,
                    (a.valor / ${MESES_SQL("a.ciclo::text")})::float8 as mrr,
                    a.quantidade_usuarios::int as quantidade_usuarios, a.inicio_em::text as inicio_em,
                    a.proxima_cobranca_em::text as proxima_cobranca_em,
                    a.cancelada_em::text as cancelada_em, a.motivo_cancelamento,
                    false as licenca, a.criado_em as ordem
               from nucleo.assinaturas a
               join nucleo.tenants t on t.id = a.tenant_id
               left join nucleo.planos p on p.id = a.plano_id
             union all
             select 'licenca:' || l.tenant_id, l.tenant_id, l.conta, l.conta_tipo, p.nome,
                    case when l.conta_status = 'ativo' and l.acesso_ate >= current_date then 'ativa'
                         when l.conta_status = 'ativo' then 'vencida' else 'inadimplente' end,
                    l.periodo, l.valor::float8, (l.valor / l.meses)::float8,
                    null::int, l.pago_em::date::text, l.acesso_ate::text, null::text, null::text,
                    true, l.pago_em
               from (${ULTIMA_LICENCA_PAGA}) l
               left join nucleo.planos p on p.id = l.plano_id
           ) x
          where ($1::text is null or x.conta ilike '%' || $1 || '%')
          order by (x.cancelada_em is null) desc, x.ordem desc nulls last, x.id
          limit ${POR_PAGINA_ASSINATURAS} offset $2`,
        [busca, (data.pagina - 1) * POR_PAGINA_ASSINATURAS],
      );
      const assinaturas = linhas.map(
        ({ total: _t, ordem: _o, ...a }) => a as AssinaturaPlataforma,
      );
      const contas = await tx.consultar<{ id: string; nome: string; tipo: string }>(
        `select id, nome, tipo::text as tipo from nucleo.tenants
          where deleted_at is null and tipo <> 'plataforma' order by nome`,
      );
      const planos = await tx.consultar<{
        id: string;
        nome: string;
        publico: string;
        preco_mensal: number;
        preco_anual: number | null;
      }>(
        `select id, nome, publico::text as publico, preco_mensal::float8 as preco_mensal,
                preco_anual::float8 as preco_anual
           from nucleo.planos where ativo order by ordem, nome`,
      );
      return { assinaturas, total: linhas[0]?.total ?? 0, contas, planos };
    });
  });

/**
 * Cria (ou substitui) a assinatura da conta: cancela a anterior, emite a primeira fatura
 * na hora (`plataforma.faturar_agora`) e tira a conta do teste. As seguintes saem pela
 * rotina `faturar_assinaturas`.
 */
export const criarAssinaturaPlataforma = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.receita", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid("Escolha a conta."),
        planoId: z.string().uuid("Escolha o plano."),
        ciclo: z.enum(["mensal", "trimestral", "anual"]),
        valor: z.number().positive("Informe o valor cobrado.").max(1_000_000),
        quantidadeUsuarios: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, async (tx) => {
      await tx.consultar(
        `update nucleo.assinaturas set status = 'cancelada', cancelada_em = now(),
                motivo_cancelamento = 'substituída por nova assinatura'
          where tenant_id = $1 and cancelada_em is null`,
        [data.tenantId],
      );
      const nova = await tx.uma<{ id: string }>(
        `insert into nucleo.assinaturas
           (tenant_id, plano_id, status, ciclo, quantidade_usuarios, valor, inicio_em, proxima_cobranca_em)
         values ($1, $2, 'ativa', $3, $4, $5, current_date, current_date) returning id`,
        [data.tenantId, data.planoId, data.ciclo, data.quantidadeUsuarios, data.valor],
      );
      if (!nova) throw new Error("Não foi possível criar a assinatura.");
      await tx.consultar("select plataforma.faturar_agora($1)", [nova.id]);
      await tx.consultar(
        "select nucleo.alterar_status_tenant($1, 'ativo'::nucleo.status_tenant, 'assinatura ativada pelo Agilliza')",
        [data.tenantId],
      );
    });
    return { ok: true as const };
  });

export const cancelarAssinaturaPlataforma = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.receita", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        motivo: z.string().trim().min(5, "Escreva o motivo do cancelamento.").max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        `update nucleo.assinaturas set status = 'cancelada', cancelada_em = now(), motivo_cancelamento = $2
          where id = $1 and cancelada_em is null returning id`,
        [data.id, data.motivo],
      ),
    );
    if (!r) throw new Error("Assinatura não encontrada ou já cancelada.");
    return { ok: true as const };
  });

/** Fatura avulsa para uma conta (serviço extra, ajuste, cobrança combinada). */
export const emitirFaturaAvulsa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.receita", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid("Escolha a conta."),
        descricao: z.string().trim().min(3, "Descreva o que está sendo cobrado.").max(200),
        valor: z.number().positive("Valor inválido.").max(1_000_000),
        vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vencimento inválido."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, (tx) =>
      tx.consultar(
        `insert into nucleo.faturas_plataforma (tenant_id, assinatura_id, descricao, valor, vencimento, status)
         values ($1, (select id from nucleo.assinaturas where tenant_id = $1 and cancelada_em is null
                      order by criado_em desc limit 1),
                 $2, $3, $4::date, 'pendente')`,
        [data.tenantId, data.descricao, data.valor, data.vencimento],
      ),
    );
    return { ok: true as const };
  });

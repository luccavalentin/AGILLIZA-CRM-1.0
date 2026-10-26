/**
 * ImobMatch Gestão (pedido do dono, 28/10/2026): a gestão sistêmica e financeira do
 * ImobMatch inteira no Agilliza correspondente.
 *
 * Duas portas, como em toda a gestão da plataforma:
 *   · a permissão do Agilliza, aqui: `imobmatch.visao`, `imobmatch.financeiro`,
 *     `imobmatch.planos` e `imobmatch.config` (ver / editar);
 *   · a da plataforma, no banco, pela ponte: o mapa da migração 0460 do Corretor dá a cada
 *     módulo só a permissão dele (`imobmatch.ver`, `imobmatch.financeiro`, `planos.editar`,
 *     `config.editar`) e as funções `plataforma.imobmatch_*` conferem de novo.
 * Nenhuma regra de dinheiro mora aqui: a classificação das faturas, os totais, a
 * inadimplência, o que é plano do ImobMatch e quais parâmetros podem mudar são do banco.
 * A moderação e os banners continuam nas funções que já existiam (`imobmatch.functions.ts`,
 * `patrocinados.functions.ts`, comunidade e chat).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { Json } from "@/integrations/supabase/types";

const VER_VISAO = exigirPermissao(["imobmatch.visao", "view"], ["imobmatch.financeiro", "view"]);
const VER_FINANCEIRO = exigirPermissao(["imobmatch.financeiro", "view"]);
const VER_ASSINATURAS = exigirPermissao(
  ["imobmatch.moderacao", "view"],
  ["saas.imobmatch", "view"],
  ["imobmatch.financeiro", "view"],
);
const VER_PLANOS = exigirPermissao(["imobmatch.planos", "view"]);
const EDITAR_PLANOS = exigirPermissao(["imobmatch.planos", "edit"]);
const VER_CONFIG = exigirPermissao(["imobmatch.config", "view"]);
const EDITAR_CONFIG = exigirPermissao(["imobmatch.config", "edit"]);

/**
 * A ponte em nome da pessoa: `um` roda uma consulta que devolve `r` (jsonb da função do banco).
 * Chamada como `ponte(context)` — é assim que o teste das telas × 911 acha as funções do banco.
 */
async function ponte(context: { userId: string }) {
  const { comPlataforma } = await import("./ponte.server");
  return {
    comPlataforma: <R>(fn: Parameters<typeof comPlataforma<R>>[1]) =>
      comPlataforma<R>(context.userId, fn),
    um: async <T>(sql: string, params: unknown[] = []): Promise<T> => {
      const r = await comPlataforma(context.userId, (tx) => tx.uma<{ r: T }>(sql, params));
      return r!.r;
    },
  };
}

/* ───────────────────────────── tipos (jsonb das funções do banco) ───────────────────────────── */

export type ProdutoImobMatch = "pro" | "anunciante" | "patrocinio";
export type SituacaoFatura = "paga" | "pendente" | "vencida" | "cancelada" | "estornada";

export interface VisaoGeralImobMatch {
  gerado_em: string;
  usuarios: { consumidores: number; novos_30d: number; novos_mes: number };
  anunciantes: { particulares: number; particulares_no_ar: number; profissionais_no_ar: number };
  pro: { contas_com_pro: number; pro_avulso: number; creci_pendentes: number };
  anuncios: {
    no_ar: number;
    em_revisao: number;
    moderados: number;
    novos_30d: number;
    denuncias_abertas: number;
  };
  leads: {
    total: number;
    mes: number;
    d30: number;
    visitas_30d: number;
    conversas_30d: number;
    sem_resposta: number;
  };
  patrocinio: { patrocinadores_ativos: number; campanhas_no_ar: number };
  serie_leads: { mes: string; leads: number; consumidores: number }[];
  ve_dinheiro: boolean;
  /** Só para quem vê o dinheiro do ImobMatch (o banco devolve `null` aos demais). */
  receita: {
    mes_recebido: number;
    mes_anterior_recebido: number;
    a_receber: number;
    inadimplencia: number;
    por_produto_mes: Record<ProdutoImobMatch, number>;
    serie: { mes: string; total: number }[];
  } | null;
}

export interface FinanceiroImobMatch {
  periodo: { de: string; ate: string };
  totais: {
    recebido: number;
    faturas_pagas: number;
    ticket_medio: number;
    a_receber: number;
    a_receber_qtd: number;
    inadimplencia: number;
    inadimplencia_qtd: number;
    contas_inadimplentes: number;
    estornado: number;
    canceladas_qtd: number;
  };
  por_produto: {
    produto: ProdutoImobMatch;
    recebido: number;
    faturas: number;
    a_receber: number;
    inadimplencia: number;
  }[];
  por_canal: { canal: string; recebido: number; faturas: number }[];
  por_mes: { mes: string; pro: number; anunciante: number; patrocinio: number; total: number }[];
  assinaturas: {
    pro_ativas: number;
    pro_teste: number;
    anunciantes_ativos: number;
    vencendo_7d: number;
    cancelamentos_periodo: number;
    cancelamento_agendado: number;
  };
  loja: {
    loja: "apple" | "google";
    ativas: number;
    renovacao_automatica: number;
    canceladas: number;
    reembolsadas_periodo: number;
    transacoes_periodo: number;
    valor_periodo: number;
    pedidos_validando: number;
  }[];
  pix: {
    cobrancas_em_aberto: number;
    cobrancas_em_aberto_valor: number;
    pagas_pix: number;
    pagas_pix_valor: number;
  };
  patrocinio: {
    compras_pagas: number;
    compras_pagas_valor: number;
    aguardando_pagamento: number;
    aguardando_pagamento_valor: number;
    patrocinadores_ativos: number;
    campanhas_no_ar: number;
  };
  inadimplentes: {
    tenant_id: string;
    conta: string;
    tipo_conta: string;
    produtos: ProdutoImobMatch[];
    valor: number;
    faturas: number;
    desde: string;
  }[];
}

export interface FaturaImobMatch {
  id: string;
  tenant_id: string;
  conta: string;
  tipo_conta: string;
  produto: ProdutoImobMatch;
  plano: string | null;
  descricao: string | null;
  canal: string;
  valor: number;
  vencimento: string;
  situacao: SituacaoFatura;
  pago_em: string | null;
  criado_em: string;
}

export interface ListaFaturasImobMatch {
  total: number;
  valor_total: number;
  limite: number;
  itens: FaturaImobMatch[];
}

export interface AssinaturaImobMatch {
  tenant_id: string;
  conta: string;
  tipo_conta: string;
  status: string;
  produto: "pro" | "anunciante";
  plano: string;
  acesso_ate: string | null;
  trial_ate: string | null;
  criado_em: string;
  loja: "apple" | "google" | null;
  renova_na_loja: boolean;
  cancela_em: string | null;
  anuncios_no_ar: number;
  /** Só para quem vê dinheiro. */
  ultimo_pagamento: string | null;
}

export type SituacaoAssinatura = "ativo" | "trial" | "vencendo" | "cancelando" | "inativo";

export interface ListaAssinaturasImobMatch {
  total: number;
  contagem: Record<SituacaoAssinatura, number>;
  itens: AssinaturaImobMatch[];
}

export interface PlanoImobMatch {
  id: string;
  codigo: string;
  nome: string;
  publico: string;
  produto: "imobmatch_pro" | "imobmatch_anunciante";
  descricao: string | null;
  preco_mensal: number;
  preco_trimestral: number | null;
  preco_semestral: number | null;
  preco_anual: number | null;
  vende_mensal: boolean;
  dias_acesso: number | null;
  ativo: boolean;
  anuncios_max: string | null;
  contas: number;
}

export interface ProdutoLojaImobMatch {
  id: string;
  loja: "apple" | "google";
  app: string;
  plano: string;
  periodo: string;
  produto_id: string;
  plano_base: string | null;
  preco: number | null;
  preco_site: number | null;
  ativo: boolean;
}

export interface PacoteBannerResumo {
  id: string;
  nome: string;
  espaco: string;
  periodo: string;
  dias: number;
  preco: number;
  a_venda: boolean;
}

export interface PlanosImobMatch {
  pode_editar: boolean;
  planos: PlanoImobMatch[];
  loja: ProdutoLojaImobMatch[];
  pacotes_banner: PacoteBannerResumo[];
}

export interface ParametroImobMatch {
  chave: string;
  valor: Json;
  descricao: string | null;
  atualizado_em: string;
  editavel: boolean;
}

export interface ParametrosImobMatch {
  pode_editar: boolean;
  parametros: ParametroImobMatch[];
  recomendacao: { [chave: string]: Json } | null;
  feed: { [chave: string]: Json } | null;
}

/* ───────────────────────────── validação ───────────────────────────── */

const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const PERIODO = z
  .object({ de: DATA, ate: DATA })
  .refine((p) => p.de <= p.ate, { message: "O início do período vem antes do fim." });

const dinheiro = z
  .number({ invalid_type_error: "Valor inválido." })
  .min(0, "Valor não pode ser negativo.")
  .max(999_999.99, "Valor muito alto.");

/* ───────────────────────────── leituras ───────────────────────────── */

/** Números do ImobMatch (a receita só vem para quem vê o dinheiro). */
export const lerVisaoGeralImobMatch = createServerFn({ method: "GET" })
  .middleware([VER_VISAO])
  .handler(async ({ context }) =>
    (await ponte(context)).um<VisaoGeralImobMatch>(
      "select plataforma.imobmatch_visao_geral() as r",
    ),
  );

/** Receita por produto, canal e mês; loja, Pix, patrocínio, assinaturas e inadimplência. */
export const lerFinanceiroImobMatch = createServerFn({ method: "GET" })
  .middleware([VER_FINANCEIRO])
  .inputValidator((d: unknown) => PERIODO.parse(d))
  .handler(async ({ data, context }) =>
    (await ponte(context)).um<FinanceiroImobMatch>(
      "select plataforma.imobmatch_financeiro($1::date, $2::date) as r",
      [data.de, data.ate],
    ),
  );

/** As faturas do ImobMatch no período (a tela pede até 200; a exportação, até 5.000). */
export const lerFaturasImobMatch = createServerFn({ method: "GET" })
  .middleware([VER_FINANCEIRO])
  .inputValidator((d: unknown) =>
    z
      .object({
        de: DATA,
        ate: DATA,
        produto: z.enum(["pro", "anunciante", "patrocinio"]).nullable().default(null),
        situacao: z
          .enum(["paga", "pendente", "vencida", "cancelada", "estornada"])
          .nullable()
          .default(null),
        busca: z.string().trim().max(80).default(""),
        limite: z.number().int().min(1).max(5000).default(200),
      })
      .refine((p) => p.de <= p.ate, { message: "O início do período vem antes do fim." })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    (await ponte(context)).um<ListaFaturasImobMatch>(
      "select plataforma.imobmatch_faturas($1::date, $2::date, $3, $4, $5, $6) as r",
      [data.de, data.ate, data.produto, data.situacao, data.busca || null, data.limite],
    ),
  );

/** Contas do Pro avulso e anunciantes particulares (planos, renovação e cancelamentos). */
export const lerAssinaturasImobMatch = createServerFn({ method: "GET" })
  .middleware([VER_ASSINATURAS])
  .inputValidator((d: unknown) =>
    z
      .object({
        produto: z.enum(["pro", "anunciante"]).nullable().default(null),
        situacao: z
          .enum(["ativo", "trial", "vencendo", "cancelando", "inativo"])
          .nullable()
          .default(null),
        busca: z.string().trim().max(80).default(""),
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) =>
    (await ponte(context)).um<ListaAssinaturasImobMatch>(
      "select plataforma.imobmatch_assinaturas($1, $2, $3, $4) as r",
      [data.produto, data.situacao, data.busca || null, data.pagina],
    ),
  );

/** Planos do ImobMatch, produtos das lojas e pacotes de banner. */
export const lerPlanosImobMatch = createServerFn({ method: "GET" })
  .middleware([VER_PLANOS])
  .handler(async ({ context }) =>
    (await ponte(context)).um<PlanosImobMatch>("select plataforma.imobmatch_planos() as r"),
  );

/** Parâmetros do ImobMatch e dos banners, a recomendação e o feed (só leitura nos dois últimos). */
export const lerParametrosImobMatch = createServerFn({ method: "GET" })
  .middleware([VER_CONFIG])
  .handler(async ({ context }) =>
    (await ponte(context)).um<ParametrosImobMatch>("select plataforma.imobmatch_parametros() as r"),
  );

/* ───────────────────────────── edições ───────────────────────────── */

/** Preços, venda e limite de anúncios de um plano do ImobMatch (o banco recusa plano do CRM). */
export const salvarPlanoImobMatch = createServerFn({ method: "POST" })
  .middleware([EDITAR_PLANOS])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        descricao: z.string().trim().max(500).nullable(),
        preco_mensal: dinheiro,
        preco_trimestral: dinheiro.nullable(),
        preco_semestral: dinheiro.nullable(),
        preco_anual: dinheiro.nullable(),
        vende_mensal: z.boolean(),
        ativo: z.boolean(),
        anuncios_max: z
          .string()
          .trim()
          .regex(/^(\d{1,5})?$/, "Limite de anúncios: um número de 1 a 99999 (vazio = sem limite).")
          .default(""),
      })
      .refine(
        (v) =>
          v.vende_mensal ||
          v.preco_trimestral != null ||
          v.preco_semestral != null ||
          v.preco_anual != null,
        {
          message:
            "O plano precisa vender algum período: ligue o mensal ou informe o preço de um pacote.",
          path: ["vende_mensal"],
        },
      )
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...campos } = data;
    await (
      await ponte(context)
    ).um("select plataforma.imobmatch_salvar_plano($1, $2::jsonb) as r", [
      id,
      JSON.stringify(campos),
    ]);
    return { ok: true as const };
  });

/** Produto da App Store / Google Play (função da loja do Corretor, `planos.editar`). */
export const salvarProdutoLojaImobMatch = createServerFn({ method: "POST" })
  .middleware([EDITAR_PLANOS])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        produto_id: z
          .string()
          .trim()
          .regex(/^[a-z0-9][a-z0-9._]{2,99}$/, "Código do produto na loja inválido."),
        plano_base: z
          .string()
          .trim()
          .regex(/^([a-z0-9][a-z0-9-]{0,62})?$/, "Plano base inválido.")
          .default(""),
        preco: z
          .number({ invalid_type_error: "Preço inválido." })
          .positive("O preço da loja precisa ser maior que zero.")
          .max(999_999.99)
          .nullable(),
        ativo: z.boolean(),
      })
      .refine((v) => !v.ativo || v.preco != null, {
        message: "Para vender na loja, informe o preço.",
        path: ["preco"],
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte(context);
    await comPlataforma((tx) =>
      tx.uma("select imobmatch.configurar_produto_loja($1, $2, $3, $4, $5)", [
        data.id,
        data.produto_id,
        data.plano_base || null,
        data.preco,
        data.ativo,
      ]),
    );
    return { ok: true as const };
  });

/** Um parâmetro do ImobMatch (inteiro). Os de cobrança e o "aceita sandbox" o banco recusa. */
export const salvarParametroImobMatch = createServerFn({ method: "POST" })
  .middleware([EDITAR_CONFIG])
  .inputValidator((d: unknown) =>
    z
      .object({
        chave: z
          .string()
          .regex(/^(imobmatch|patrocinio)\.[a-z0-9_.]{2,60}$/, "Parâmetro inválido."),
        valor: z
          .number({ invalid_type_error: "Use um número inteiro." })
          .int("Use um número inteiro.")
          .min(0, "Não pode ser negativo.")
          .max(1_000_000_000, "Valor alto demais."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await (
      await ponte(context)
    ).um("select plataforma.imobmatch_salvar_parametro($1, $2::jsonb) as r", [
      data.chave,
      JSON.stringify(data.valor),
    ]);
    return { ok: true as const };
  });

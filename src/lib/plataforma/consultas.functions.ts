/**
 * Consultas pagas (Serasa Premium e SPC Brasil vendidas às licenças do Agilliza Tech por créditos
 * pré-pagos), no Agilliza.
 *
 * Os dois produtos usam a MESMA carteira de créditos e o MESMO APIFULL_TOKEN (0550 do Corretor).
 * Cada um tem o seu preço em créditos por consulta, o seu ligado/desligado e o seu custo de
 * fornecedor com vigência. O banco decide quem pode o quê:
 *   · ver indicadores e pedidos → `cobranca.ler` (só leitura, 0303 do Corretor) ou
 *     `cobranca.plataforma` (ou `receita.ler`/`integracoes.ver`);
 *   · ligar/desligar e mudar o preço em créditos → `plataforma.configurar_produto_consulta`
 *     (config.editar + planos.editar; créditos de 1 a 100 e acima do custo vigente);
 *   · ver o custo do fornecedor → `cobranca.ler` ou `planos.editar`; registrar → `planos.editar`
 *     (RLS de `custos_fornecedor`). Pela ponte, planos.editar só vem com o "editar" de Consultas.
 *
 * O preço do crédito em reais (o mesmo para os dois) não muda por aqui.
 * Margem de contribuição = receita − custo do fornecedor − taxa do pagamento. Não é lucro líquido.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export const PRODUTOS_CONSULTA = ["serasa-premium", "spc-brasil"] as const;
export type ProdutoConsulta = (typeof PRODUTOS_CONSULTA)[number];

/** Conta de um período: a mesma para o total e para cada produto. */
export interface ContaConsultas {
  pedidos: number;
  pagos: number;
  concluidas: number;
  falhas: number;
  reconciliar: number;
  estornadas: number;
  receita_bruta: number;
  custo_fornecedor: number;
  taxas_pagamento: number;
  margem_contribuicao: number;
}

export interface IndicadoresConsultas extends ContaConsultas {
  pagas_sem_entrega: number;
  canceladas: number;
  taxas_desconhecidas: number;
  estornos: number;
  /** Mesma conta separada por produto (0550). Produto sem pedido no período não aparece. */
  por_produto?: Partial<Record<ProdutoConsulta, ContaConsultas & { creditos: number }>>;
}

export interface PedidoConsulta {
  id: string;
  criado_em: string;
  conta: string;
  produto: string | null;
  documento_mascarado: string | null;
  preco: number;
  custo_fornecedor: number | null;
  taxa_pagamento: number | null;
  situacao_financeira: string;
  situacao_consulta: string;
  tipo_falha: string | null;
  ultimo_erro: string | null;
  execucoes: number;
  pago_em: string | null;
  concluida_em: string | null;
  pago_com?: string | null;
  creditos?: number | null;
}

export interface CustoFornecedor {
  produto: ProdutoConsulta;
  custo: number;
  vigente_desde: string;
  observacao: string | null;
}

/** O que a plataforma configura em cada produto (sem o custo, que tem permissão própria). */
export interface ProdutoConfigurado {
  produto: ProdutoConsulta;
  rotulo: string;
  ativo: boolean;
  /** Créditos que uma consulta debita. */
  creditos: number;
  /** Ligado e com custo vigente: as licenças conseguem consultar (falta só o token, se faltar). */
  vendavel: boolean;
}

/** Situações aceitas no filtro (financeira ou da consulta), como na Gestão. */
export const SITUACOES_PEDIDO = [
  "aguardando_pagamento",
  "pago",
  "cancelado",
  "estornado",
  "contestado",
  "na_fila",
  "executando",
  "concluida",
  "falhou",
  "reconciliar",
  "nao_executada",
] as const;
export type SituacaoPedido = (typeof SITUACOES_PEDIDO)[number];

export const POR_PAGINA_PEDIDOS = 50;

const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

/** "6,72" / "1.234,56" / "6.72" → número com 2 casas (mesma leitura da Gestão). */
function dinheiro(v: string): number {
  const t = String(v).trim();
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export const lerConsultasPagas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.consultas", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        de: DATA,
        ate: DATA,
        situacao: z.enum(SITUACOES_PEDIDO).nullable().optional(),
        produto: z.enum(PRODUTOS_CONSULTA).nullable().optional(),
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .refine((v) => v.de <= v.ate, { message: "A data inicial é depois da final." })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      // O mesmo `pode(s, ...)` da Gestão, mas perguntado ao banco: é ele que aplica.
      const pode = await tx.uma<{ produtos: boolean; custos: boolean }>(
        `select (seguranca.auth_e_plataforma('config.editar')
                 and seguranca.auth_e_plataforma('planos.editar')) as produtos,
                (seguranca.auth_e_plataforma('planos.editar')
                 or seguranca.auth_e_plataforma('cobranca.ler')) as custos`,
      );
      const ind = await tx.uma<{ r: IndicadoresConsultas }>(
        "select plataforma.indicadores_consultas_pagas($1::date, $2::date, $3) as r",
        [data.de, data.ate, data.produto ?? null],
      );
      const lista = await tx.uma<{ r: { pedidos: PedidoConsulta[]; total: number } }>(
        "select plataforma.pedidos_consulta($1, $2, $3) as r",
        [data.situacao ?? null, data.pagina, data.produto ?? null],
      );
      const produtos = await tx.consultar<ProdutoConfigurado>(
        "select produto, rotulo, ativo, creditos, vendavel from crm.produtos_consulta()",
      );
      // Preço do crédito da carteira (R$), o mesmo para Serasa e SPC.
      const credito = await tx.uma<{ preco: number | null }>(
        `select coalesce((valor ->> 'preco_credito')::float8, (valor ->> 'preco')::float8) as preco
           from plataforma.configuracoes where chave = 'consulta_paga.serasa_premium'`,
      );
      const custos = pode?.custos
        ? await tx.consultar<CustoFornecedor>(
            `select produto, custo::float8 as custo, vigente_desde::text as vigente_desde, observacao
               from (select x.*, row_number() over (partition by x.produto order by x.vigente_desde desc) as n
                       from plataforma.custos_fornecedor x
                      where x.produto in ('serasa-premium', 'spc-brasil')) c
              where n <= 5
              order by produto, vigente_desde desc`,
          )
        : null;
      return {
        indicadores: ind?.r ?? null,
        pedidos: lista?.r?.pedidos ?? [],
        total: Number(lista?.r?.total ?? 0),
        produtos,
        precoCredito: credito?.preco ?? null,
        custos,
        podeEditarProdutos: Boolean(pode?.produtos),
        podeVerCustos: Boolean(pode?.custos),
      };
    });
  });

/**
 * Liga/desliga um produto e define o preço dele em créditos por consulta. Vale para as
 * consultas novas; quem já consultou mantém o que pagou. O banco recusa zero, negativo,
 * mais de 100 e preço abaixo do custo vigente; o antes/depois fica na auditoria.
 */
export const salvarProdutoConsulta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.consultas", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        produto: z.enum(PRODUTOS_CONSULTA),
        creditos: z
          .number()
          .int()
          .min(1, "Mínimo de 1 crédito.")
          .max(100, "Máximo de 100 créditos."),
        ativo: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ r: { produto: string; ativo: boolean; creditos: number } }>(
        "select plataforma.configurar_produto_consulta($1, $2, $3) as r",
        [data.produto, data.creditos, data.ativo],
      );
      return { ok: true as const, ...(r?.r ?? {}) };
    });
  });

/** Novo custo do fornecedor de um produto, com vigência a partir de agora. Não altera pedidos já feitos. */
export const registrarCustoConsulta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.consultas", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        produto: z.enum(PRODUTOS_CONSULTA).default("serasa-premium"),
        custo: z.string().trim().max(20),
        observacao: z.string().trim().max(300).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const custo = dinheiro(data.custo);
    if (!Number.isFinite(custo) || custo < 0 || custo > 1000) {
      throw new Error("Informe um custo entre R$ 0,00 e R$ 1.000,00.");
    }
    const { comPlataforma } = await import("./ponte.server");
    const ok = await comPlataforma(context.userId, async (tx) => {
      const pode = await tx.uma<{ ok: boolean }>(
        "select seguranca.auth_e_plataforma('planos.editar') as ok",
      );
      if (!pode?.ok) return false;
      await tx.consultar(
        `insert into plataforma.custos_fornecedor (produto, custo, observacao, criado_por)
         values ($1, $2, nullif($3, ''), seguranca.auth_usuario_id())`,
        [data.produto, custo, data.observacao],
      );
      return true;
    });
    if (!ok) {
      throw new Error("Seu acesso à plataforma não pode registrar o custo do fornecedor.");
    }
    return { ok: true as const };
  });

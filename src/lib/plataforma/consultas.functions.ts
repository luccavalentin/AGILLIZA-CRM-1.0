/**
 * Consultas pagas (Serasa Premium vendida por unidade às licenças do Corretor 2.0), no Agilliza.
 *
 * Mesmas leituras e escritas da Gestão (apps/web/src/app/[portal]/consultas-pagas):
 * `plataforma.indicadores_consultas_pagas`, `plataforma.pedidos_consulta`, a oferta em
 * `plataforma.configuracoes` ('consulta_paga.serasa_premium') e a tabela de custos
 * `plataforma.custos_fornecedor`. O banco decide quem pode o quê:
 *   · ver indicadores e pedidos → `cobranca.ler` (só leitura, 0303 do Corretor) ou
 *     `cobranca.plataforma` (ou `receita.ler`/`integracoes.ver`);
 *   · trocar o preço → `config.editar` (RLS de `plataforma.configuracoes`);
 *   · ver o custo do fornecedor → `cobranca.ler` ou `planos.editar`; registrar → `planos.editar`
 *     (RLS de `custos_fornecedor`). Pela ponte, planos.editar só vem com o "editar" de Consultas.
 *
 * Margem de contribuição = receita − custo do fornecedor − taxa do pagamento. Não é lucro líquido.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export interface IndicadoresConsultas {
  pedidos: number;
  pagos: number;
  concluidas: number;
  falhas: number;
  reconciliar: number;
  pagas_sem_entrega: number;
  estornadas: number;
  canceladas: number;
  receita_bruta: number;
  custo_fornecedor: number;
  taxas_pagamento: number;
  taxas_desconhecidas: number;
  estornos: number;
  margem_contribuicao: number;
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
}

export interface CustoFornecedor {
  custo: number;
  vigente_desde: string;
  observacao: string | null;
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

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const lerConsultasPagas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.consultas", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        de: DATA,
        ate: DATA,
        situacao: z.enum(SITUACOES_PEDIDO).nullable().optional(),
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .refine((v) => v.de <= v.ate, { message: "A data inicial é depois da final." })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      // O mesmo `pode(s, ...)` da Gestão, mas perguntado ao banco: é ele que aplica.
      const pode = await tx.uma<{ preco: boolean; custos: boolean }>(
        `select seguranca.auth_e_plataforma('config.editar') as preco,
                (seguranca.auth_e_plataforma('planos.editar')
                 or seguranca.auth_e_plataforma('cobranca.ler')) as custos`,
      );
      const ind = await tx.uma<{ r: IndicadoresConsultas }>(
        "select plataforma.indicadores_consultas_pagas($1::date, $2::date) as r",
        [data.de, data.ate],
      );
      const lista = await tx.uma<{ r: { pedidos: PedidoConsulta[]; total: number } }>(
        "select plataforma.pedidos_consulta($1, $2) as r",
        [data.situacao ?? null, data.pagina],
      );
      const oferta = await tx.uma<{ preco: number | null; ativo: boolean }>(
        `select (valor ->> 'preco')::float8 as preco, coalesce((valor ->> 'ativo')::boolean, false) as ativo
           from plataforma.configuracoes where chave = 'consulta_paga.serasa_premium'`,
      );
      const custos = pode?.custos
        ? await tx.consultar<CustoFornecedor>(
            `select custo::float8 as custo, vigente_desde::text as vigente_desde, observacao
               from plataforma.custos_fornecedor
              where produto = 'serasa-premium' order by vigente_desde desc limit 5`,
          )
        : null;
      return {
        indicadores: ind?.r ?? null,
        pedidos: lista?.r?.pedidos ?? [],
        total: Number(lista?.r?.total ?? 0),
        oferta: oferta ?? null,
        custos,
        podeEditarPreco: Boolean(pode?.preco),
        podeVerCustos: Boolean(pode?.custos),
      };
    });
  });

/**
 * Novo preço de venda. Vale para os pedidos abertos daqui em diante; quem já pediu
 * mantém o preço gravado no próprio pedido. O antes/depois fica na auditoria de
 * `plataforma.configuracoes`.
 */
export const salvarPrecoConsulta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.consultas", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ preco: z.string().trim().max(20), ativo: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const preco = dinheiro(data.preco);
    if (!Number.isFinite(preco) || preco <= 0 || preco > 1000) {
      throw new Error("Informe um preço entre R$ 0,01 e R$ 1.000,00.");
    }
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, async (tx) => {
      const pode = await tx.uma<{ ok: boolean }>(
        "select seguranca.auth_e_plataforma('config.editar') as ok",
      );
      if (!pode?.ok) return { erro: "sem_permissao" as const };
      const custo = await tx.uma<{ custo: number }>(
        `select custo::float8 as custo from plataforma.custos_fornecedor
          where produto = 'serasa-premium' and vigente_desde <= now()
          order by vigente_desde desc limit 1`,
      );
      if (custo && preco <= Number(custo.custo)) {
        return { erro: "abaixo_do_custo" as const, custo: Number(custo.custo) };
      }
      const salvo = await tx.uma<{ chave: string }>(
        `update plataforma.configuracoes
            set valor = valor || jsonb_build_object('preco', $1::numeric, 'ativo', $2::boolean),
                atualizado_por = seguranca.auth_usuario_id(), atualizado_em = now()
          where chave = 'consulta_paga.serasa_premium'
          returning chave`,
        [preco, data.ativo],
      );
      if (!salvo) return { erro: "sem_configuracao" as const };
      return { erro: null };
    });
    if (r.erro === "sem_permissao") {
      throw new Error("Seu acesso à plataforma não pode alterar o preço da consulta.");
    }
    if (r.erro === "abaixo_do_custo") {
      throw new Error(`O preço precisa ser maior que o custo vigente (${brl(r.custo ?? 0)}).`);
    }
    if (r.erro === "sem_configuracao") {
      throw new Error("A venda de consulta paga ainda não foi configurada na plataforma.");
    }
    return { ok: true as const };
  });

/** Novo custo do fornecedor, com vigência a partir de agora. Não altera pedidos já feitos. */
export const registrarCustoConsulta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.consultas", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
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
         values ('serasa-premium', $1, nullif($2, ''), seguranca.auth_usuario_id())`,
        [custo, data.observacao],
      );
      return true;
    });
    if (!ok) {
      throw new Error("Seu acesso à plataforma não pode registrar o custo do fornecedor.");
    }
    return { ok: true as const };
  });

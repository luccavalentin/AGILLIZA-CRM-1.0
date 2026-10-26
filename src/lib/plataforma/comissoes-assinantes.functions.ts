/**
 * Comissão dos assinantes (Corretor 2.0, migração 0229): o corretor ou a imobiliária
 * que envia a proposta ao correspondente recebe um percentual do valor financiado,
 * liberado só quando o contrato é REGISTRADO em cartório. Antes disso a comissão não
 * existe — não aparece nem soma em relatório.
 *
 * "a_conferir" (migração 0481 do Corretor): a base veio só do valor que a própria conta
 * informou (sem valor do Agilliza). Não soma no "a pagar"; o Agilliza confere a base
 * (pode corrigi-la) e passa para "a pagar" por `plataforma.conferir_comissao_assinante`
 * (migração 0495), ou cancela com motivo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export type StatusComissaoAssinante = "a_conferir" | "a_pagar" | "paga" | "cancelada";

/** Situações que podem ser filtradas na lista. */
export const STATUS_COMISSAO_ASSINANTE = ["a_conferir", "a_pagar", "paga", "cancelada"] as const;

export interface TotaisComissaoAssinante {
  a_pagar: number;
  /** Comissões cuja base veio só do valor da conta (0481): fora do "a pagar". */
  a_conferir: number;
  pagas: number;
  quantidade: number;
}

/** Totais como vêm do banco; banco anterior à 0481 não traz "a_conferir". */
export function normalizarTotais(
  t: Partial<TotaisComissaoAssinante> | null | undefined,
): TotaisComissaoAssinante {
  return {
    a_pagar: Number(t?.a_pagar ?? 0),
    a_conferir: Number(t?.a_conferir ?? 0),
    pagas: Number(t?.pagas ?? 0),
    quantidade: Number(t?.quantidade ?? 0),
  };
}

export interface ComissaoAssinante {
  id: string;
  conta: string;
  tipo: "corretor" | "imobiliaria" | "parceiro";
  tenant_id: string;
  proposta: string;
  numero_agilliza: string | null;
  cliente: string | null;
  base: number;
  percentual: number;
  valor: number;
  status: StatusComissaoAssinante;
  registrado_em: string;
  paga_em: string | null;
  observacao: string | null;
}

export interface ConfigComissaoAssinante {
  padrao: number;
  por_conta: { tenant_id: string; conta: string; tipo: string; percentual: number }[];
}

/**
 * O que fica na observação ao conferir: sem anotação, o texto antigo ("A conferir: …")
 * seria mantido pelo banco e a comissão "a pagar" continuaria dizendo que falta conferir.
 */
export function observacaoDaConferencia(nota: string, base: number): string {
  const n = nota.trim().replace(/\s+/g, " ");
  const valor = base.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const texto = `Conferida no Agilliza: base de ${valor}.${n ? ` ${n}` : ""}`;
  return texto.slice(0, 500);
}

/** Teto da base conferida — o mesmo da função do banco (0495). */
export const BASE_MAXIMA_CONFERENCIA = 100_000_000;

/**
 * Comissão recalculada como o banco faz na conferência: percentual GUARDADO na comissão,
 * arredondado a centavos (meio centavo para cima).
 */
export function calcularComissao(base: number, percentual: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(percentual) || base <= 0) return 0;
  const centavos = Math.round(base * 100);
  return Math.round((centavos * percentual) / 100 + Number.EPSILON * 100) / 100;
}

/** Mensagem do campo de base, ou null quando a base pode ser enviada. */
export function problemaNaBase(base: number): string | null {
  if (!Number.isFinite(base) || base <= 0) return "Informe a base conferida (maior que zero).";
  if (base > BASE_MAXIMA_CONFERENCIA) return "A base passa de R$ 100 milhões. Confira o valor.";
  return null;
}

async function ponte() {
  return import("./ponte.server");
}

const DATA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

export const listarComissoesAssinantes = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.comissoes", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(STATUS_COMISSAO_ASSINANTE).nullable().optional(),
        de: DATA,
        ate: DATA,
        busca: z.string().trim().max(120).nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const lista = await tx.uma<{
        j: { itens: ComissaoAssinante[]; totais: Partial<TotaisComissaoAssinante> };
      }>("select plataforma.comissoes_assinantes($1, $2::date, $3::date, $4) as j", [
        data.status ?? null,
        data.de ?? null,
        data.ate ?? null,
        data.busca || null,
      ]);
      const config = await tx.uma<{ j: ConfigComissaoAssinante }>(
        "select plataforma.config_comissao_assinante() as j",
      );
      return {
        itens: lista?.j.itens ?? [],
        totais: normalizarTotais(lista?.j.totais),
        config: config?.j ?? { padrao: 0.25, por_conta: [] },
      };
    });
  });

const PERCENTUAL = z.number().min(0, "De 0 a 10%.").max(10, "De 0 a 10%.");

/** Percentual padrão (tenantId null) ou próprio de uma conta (percentual null tira o próprio). */
export const definirComissaoAssinante = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.comissoes", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({ tenantId: z.string().uuid().nullable(), percentual: PERCENTUAL.nullable() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.definir_comissao_assinante($1, $2)", [
        data.tenantId,
        data.percentual,
      ]),
    );
    return { ok: true as const };
  });

/**
 * Dar baixa (paga), voltar para "a pagar" ou cancelar (com motivo). Uma comissão "a_conferir"
 * só sai daqui CANCELADA: passar para "a pagar" é pela conferência
 * (`conferirComissaoAssinante`, que grava a base conferida). O banco recusa o atalho
 * (0498, código 55000) e a frase dele chega à tela; ninguém volta para "a conferir".
 */
export const atualizarComissaoAssinante = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.comissoes", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["a_pagar", "paga", "cancelada"]),
        observacao: z.string().trim().max(500).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.atualizar_comissao_assinante($1, $2, $3)", [
        data.id,
        data.status,
        data.observacao || null,
      ]),
    );
    return { ok: true as const };
  });

/**
 * Conferência de uma comissão "a_conferir" (0495): grava a base conferida (a informada ou
 * a corrigida), recalcula o valor com o percentual guardado e passa para "a pagar". O banco
 * confere de novo a permissão, a situação, a base e trava a linha (duas conferências ao
 * mesmo tempo: a segunda é recusada).
 */
export const conferirComissaoAssinante = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.comissoes", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        base: z
          .number()
          .positive("Informe a base conferida (maior que zero).")
          .max(BASE_MAXIMA_CONFERENCIA, "A base passa de R$ 100 milhões. Confira o valor."),
        observacao: z.string().trim().max(500).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: { status: string; base: number; percentual: number; valor: number } }>(
        "select plataforma.conferir_comissao_assinante($1, $2, $3) as j",
        [data.id, data.base, data.observacao || null],
      ),
    );
    return {
      ok: true as const,
      base: Number(r?.j.base ?? data.base),
      valor: Number(r?.j.valor ?? 0),
    };
  });

/** Contas para escolher ao definir um percentual próprio. */
export const contasParaComissao = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.comissoes", "edit"])])
  .inputValidator((d: unknown) => z.object({ busca: z.string().trim().max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const termo = data.busca.replace(/[\\%_]/g, (c) => "\\" + c);
    return comPlataforma(context.userId, (tx) =>
      tx.consultar<{ id: string; nome: string; tipo: string }>(
        `select id, nome, tipo::text as tipo from nucleo.tenants
          where deleted_at is null and tipo <> 'plataforma' and nome ilike '%' || $1 || '%'
          order by nome limit 20`,
        [termo],
      ),
    );
  });

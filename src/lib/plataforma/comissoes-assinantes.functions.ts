/**
 * Comissão dos assinantes (Agilliza Tech, migração 0229): o corretor ou a imobiliária
 * que envia a proposta ao correspondente recebe um percentual do valor financiado,
 * liberado só quando o contrato é REGISTRADO em cartório. Antes disso a comissão não
 * existe — não aparece nem soma em relatório.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export type StatusComissaoAssinante = "a_pagar" | "paga" | "cancelada";

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
        status: z.enum(["a_pagar", "paga", "cancelada"]).nullable().optional(),
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
        j: { itens: ComissaoAssinante[]; totais: { a_pagar: number; pagas: number; quantidade: number } };
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
        totais: lista?.j.totais ?? { a_pagar: 0, pagas: 0, quantidade: 0 },
        config: config?.j ?? { padrao: 0.25, por_conta: [] },
      };
    });
  });

const PERCENTUAL = z.number().min(0, "De 0 a 10%.").max(10, "De 0 a 10%.");

/** Percentual padrão (tenantId null) ou próprio de uma conta (percentual null tira o próprio). */
export const definirComissaoAssinante = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.comissoes", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ tenantId: z.string().uuid().nullable(), percentual: PERCENTUAL.nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.definir_comissao_assinante($1, $2)", [data.tenantId, data.percentual]),
    );
    return { ok: true as const };
  });

/** Dar baixa (paga), voltar para "a pagar" ou cancelar (com motivo). */
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

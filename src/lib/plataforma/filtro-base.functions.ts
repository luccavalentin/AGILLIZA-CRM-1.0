/**
 * Servidor do filtro "Sua base" | "Assinantes" (pedido de 26/10/2026; regras em `filtro-base.ts`).
 *
 * Tudo passa pela ponte (`comPlataforma`): o banco do Agilliza Tech confere a permissão de
 * plataforma da pessoa (migração 0315) — aqui só a porta de entrada do Agilliza (`saas.contas`).
 * As listas de grupo vêm com o CPF/CNPJ MASCARADO (LGPD); o documento inteiro continua só na
 * visão de uma conta (`listarClientesDaConta`, auditada).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { ContaFiltro } from "./filtro-base";

const UUID = z.string().uuid();
const GRUPO = z.enum(["vinculados", "assinantes"]);
const TERMO = z.string().trim().max(120).optional().nullable();
const PAGINA = z.number().int().min(1).max(1000).default(1);

/** Contas para o combobox (busca e página no servidor). `id` resolve uma conta vinda da URL. */
export const buscarContasDoFiltro = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.contas", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        grupo: GRUPO.optional().nullable(),
        termo: TERMO,
        id: UUID.optional().nullable(),
        pagina: PAGINA,
        porPagina: z.number().int().min(5).max(50).default(20),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: { contas: ContaFiltro[]; total: number; por_pagina: number } }>(
        "select plataforma.contas_para_filtro($1::jsonb) as r",
        [
          JSON.stringify({
            grupo: data.grupo ?? null,
            termo: data.termo || null,
            id: data.id ?? null,
            pagina: data.pagina,
            por_pagina: data.porPagina,
          }),
        ],
      ),
    );
    return {
      contas: r?.r?.contas ?? [],
      total: Number(r?.r?.total ?? 0),
      porPagina: Number(r?.r?.por_pagina ?? data.porPagina),
    };
  });

export interface ClienteDoGrupo {
  id: string;
  codigo: string;
  nome: string;
  documento_mascarado: string | null;
  email: string | null;
  celular: string | null;
  status_funil: string;
  responsavel: string | null;
  criado_em: string;
  licenca_id: string;
  conta: string;
  conta_tipo: string;
}

/** Carteiras de clientes de um grupo (ou de uma conta dele), paginadas no servidor. */
export const listarClientesDoGrupo = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.contas", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        grupo: GRUPO,
        licenca: UUID.optional().nullable(),
        termo: TERMO,
        etapa: z.string().max(30).optional().nullable(),
        pagina: PAGINA,
        porPagina: z.number().int().min(5).max(100).default(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const { ETAPA_CLIENTE_ASSINANTE } = await import("./contas.functions");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: { clientes: ClienteDoGrupo[]; total: number; contas: number } }>(
        "select plataforma.clientes_do_grupo($1::jsonb) as r",
        [
          JSON.stringify({
            grupo: data.grupo,
            licenca: data.licenca ?? null,
            termo: data.termo || null,
            etapa: data.etapa && ETAPA_CLIENTE_ASSINANTE[data.etapa] ? data.etapa : null,
            pagina: data.pagina,
            por_pagina: data.porPagina,
          }),
        ],
      ),
    );
    return {
      clientes: r?.r?.clientes ?? [],
      total: Number(r?.r?.total ?? 0),
      contas: Number(r?.r?.contas ?? 0),
    };
  });

/** Simulações de um grupo no formato da lista nativa do Agilliza (mesmos cartões e ações). */
export const listarSimulacoesDoGrupo = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.contas", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        grupo: GRUPO,
        licenca: UUID.optional().nullable(),
        termo: TERMO,
        semNoAgilliza: z.boolean().default(false),
        pagina: PAGINA,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const { simulacaoDaContaNoFormatoAgilliza } = await import("./conta-nativa.functions");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: { simulacoes: unknown[]; total: number; por_pagina: number } }>(
        "select plataforma.simulacoes_da_conta($1::jsonb) as r",
        [
          JSON.stringify({
            grupo: data.grupo,
            licenca: data.licenca ?? null,
            termo: data.termo || null,
            sem_no_agilliza: data.semNoAgilliza,
            pagina: data.pagina,
            por_pagina: 20,
          }),
        ],
      ),
    );
    return {
      itens: (r?.r?.simulacoes ?? []).map((s) =>
        simulacaoDaContaNoFormatoAgilliza(s as Parameters<typeof simulacaoDaContaNoFormatoAgilliza>[0]),
      ),
      total: Number(r?.r?.total ?? 0),
      porPagina: Number(r?.r?.por_pagina ?? 20),
    };
  });

/** Filtros das propostas dos assinantes (os mesmos da Gestão do Agilliza Tech). */
export const FILTROS_PROPOSTAS_GRUPO = z.object({
  grupo: GRUPO,
  licenca: UUID.optional().nullable(),
  termo: TERMO,
  status: z.string().max(40).optional().nullable(),
  banco: z
    .string()
    .regex(/^[a-z_]{2,30}$/)
    .optional()
    .nullable(),
  de: z.string().date().optional().nullable(),
  ate: z.string().date().optional().nullable(),
  usuario: UUID.optional().nullable(),
  analista: z.union([UUID, z.literal("sem")]).optional().nullable(),
  aceite: z.enum(["todas", "pendentes", "minhas"]).default("todas"),
  semNoAgilliza: z.boolean().default(false),
  pagina: PAGINA,
});
export type FiltrosPropostasGrupo = z.infer<typeof FILTROS_PROPOSTAS_GRUPO>;

/** Propostas de um grupo, com as mesmas ações da fila (vínculo com o Agilliza anotado). */
export const listarPropostasDoGrupo = createServerFn({ method: "GET" })
  // Quem atende a fila (saas.fila) também lê as propostas dos assinantes (mesma consulta da fila).
  .middleware([exigirPermissao(["saas.contas", "view"], ["saas.fila", "view"])])
  .inputValidator((d: unknown) => FILTROS_PROPOSTAS_GRUPO.parse(d))
  .handler(async ({ data, context }) => {
    if (data.de && data.ate && data.de > data.ate) {
      throw new Error("A data inicial deve ser anterior à final.");
    }
    const { comPlataforma } = await import("./ponte.server");
    const { ROTULO_PROPOSTA_ASSINANTE } = await import("./fila.functions");
    const { anotarVinculoAgilliza } = await import("./fila.server");
    const r = await comPlataforma(context.userId, async (tx) => {
      const lido = await tx.uma<{
        r: {
          propostas: import("./fila.functions").PropostaAssinante[];
          total: number;
          volume: number;
          pendentes: number;
          minhas: number;
          atrasadas: number;
          por_pagina: number;
          situacoes: Record<string, number>;
        };
      }>("select plataforma.consultar_propostas($1::jsonb) as r", [
        JSON.stringify({
          grupo: data.grupo,
          licenca: data.licenca ?? null,
          termo: data.termo || null,
          status: data.status && ROTULO_PROPOSTA_ASSINANTE[data.status] ? data.status : null,
          banco: data.banco ?? null,
          de: data.de ?? null,
          ate: data.ate ?? null,
          usuario: data.licenca ? (data.usuario ?? null) : null,
          analista: data.analista ?? null,
          aceite: data.aceite,
          sem_no_agilliza: data.semNoAgilliza,
          pagina: data.pagina,
          por_pagina: 50,
        }),
      ]);
      await anotarVinculoAgilliza(tx, lido?.r?.propostas ?? []);
      return lido;
    });
    return {
      itens: r?.r?.propostas ?? [],
      total: Number(r?.r?.total ?? 0),
      volume: Number(r?.r?.volume ?? 0),
      pendentes: Number(r?.r?.pendentes ?? 0),
      minhas: Number(r?.r?.minhas ?? 0),
      atrasadas: Number(r?.r?.atrasadas ?? 0),
      porPagina: Number(r?.r?.por_pagina ?? 50),
      situacoes: r?.r?.situacoes ?? {},
    };
  });

/** Usuários de uma conta (filtro "Responsável" quando um assinante está escolhido). */
export const listarUsuariosDaConta = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.contas", "view"], ["saas.fila", "view"])])
  .inputValidator((d: unknown) => z.object({ licenca: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, (tx) =>
      tx.consultar<{ id: string; nome: string }>(
        "select id, nome from plataforma.usuarios_da_licenca($1) order by nome",
        [data.licenca],
      ),
    );
  });

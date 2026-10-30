import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireClienteSession } from "@/lib/portal/session.server";
import { FORMA_CHAVE } from "./rota";
import type { EstadoTour, PublicoTour } from "./tipos";

/*
 * Tour guiado: o progresso de cada pessoa fica no banco (migração 20261027130001), não só no
 * navegador — trocar de aparelho não reabre o que já foi visto.
 *
 * - Equipe: funções `tour_*` com o JWT da pessoa (o banco usa `auth.uid()`; nada para anon).
 * - Cliente do portal: sessão própria em cookie selado; funções `portal_cliente_tour_*` que só
 *   o service_role executa, com o id do cliente tirado do cookie (nunca do corpo).
 *
 * Falha de rede ou de banco nunca quebra a tela: o estado volta null (o tour não abre
 * sozinho) e a gravação devolve false.
 */

const ESTADOS = ["andamento", "concluido", "pulado"] as const;
const chave = z.string().regex(FORMA_CHAVE);
const ESQ_ESTADO = z.object({ telas: z.array(z.string()).max(200) });
const ESQ_REGISTRO = z.object({
  tela: chave,
  versao: z.number().int().min(1).max(1000),
  estado: z.enum(ESTADOS),
  passo: z.number().int().min(0).max(100),
});
const ESQ_REINICIAR = z.object({ tela: chave.nullable().default(null) });
const ESQ_AUTOMATICO = z.object({ ligado: z.boolean() });

/** As chaves que valem (forma certa, sem repetir, no máximo 40 — o limite do banco). */
export function telasValidas(telas: string[]): string[] {
  return [...new Set(telas)].filter((t) => FORMA_CHAVE.test(t)).slice(0, 40);
}

type Rpc = {
  rpc: (
    n: string,
    a: Record<string, unknown>,
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
};
async function rpc<T>(db: unknown, nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (db as Rpc).rpc(nome, args);
  if (error) throw new Error(error.message);
  return data as T;
}
async function dbCliente() {
  const { portalDb } = await import("@/lib/portal/portal-db.server");
  return portalDb();
}

// ------------------------------------------------------------------------- equipe ---
export const tourEstadoEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => ESQ_ESTADO.parse(d))
  .handler(async ({ context, data }): Promise<EstadoTour | null> => {
    try {
      return await rpc<EstadoTour>(context.supabase, "tour_estado", {
        p_telas: telasValidas(data.telas),
      });
    } catch {
      return null;
    }
  });

export const tourRegistrarEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => ESQ_REGISTRO.parse(d))
  .handler(async ({ context, data }): Promise<boolean> => {
    try {
      await rpc(context.supabase, "tour_registrar", {
        p_tela: data.tela,
        p_versao: data.versao,
        p_estado: data.estado,
        p_passo: data.passo,
      });
      return true;
    } catch {
      return false;
    }
  });

export const tourReiniciarEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => ESQ_REINICIAR.parse(d))
  .handler(async ({ context, data }): Promise<boolean> => {
    try {
      await rpc(context.supabase, "tour_reiniciar", { p_tela: data.tela });
      return true;
    } catch {
      return false;
    }
  });

export const tourAutomaticoEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => ESQ_AUTOMATICO.parse(d))
  .handler(async ({ context, data }): Promise<boolean> => {
    try {
      await rpc(context.supabase, "tour_automatico", { p_ligado: data.ligado });
      return true;
    } catch {
      return false;
    }
  });

// ------------------------------------------------------------------------ cliente ---
export const tourEstadoCliente = createServerFn({ method: "POST" })
  .validator((d: unknown) => ESQ_ESTADO.parse(d))
  .handler(async ({ data }): Promise<EstadoTour | null> => {
    const sess = requireClienteSession();
    try {
      return await rpc<EstadoTour>(await dbCliente(), "portal_cliente_tour_estado", {
        _cid: sess.cid,
        p_telas: telasValidas(data.telas),
      });
    } catch {
      return null;
    }
  });

export const tourRegistrarCliente = createServerFn({ method: "POST" })
  .validator((d: unknown) => ESQ_REGISTRO.parse(d))
  .handler(async ({ data }): Promise<boolean> => {
    const sess = requireClienteSession();
    try {
      await rpc(await dbCliente(), "portal_cliente_tour_registrar", {
        _cid: sess.cid,
        p_tela: data.tela,
        p_versao: data.versao,
        p_estado: data.estado,
        p_passo: data.passo,
      });
      return true;
    } catch {
      return false;
    }
  });

export const tourReiniciarCliente = createServerFn({ method: "POST" })
  .validator((d: unknown) => ESQ_REINICIAR.parse(d))
  .handler(async ({ data }): Promise<boolean> => {
    const sess = requireClienteSession();
    try {
      await rpc(await dbCliente(), "portal_cliente_tour_reiniciar", {
        _cid: sess.cid,
        p_tela: data.tela,
      });
      return true;
    } catch {
      return false;
    }
  });

export const tourAutomaticoCliente = createServerFn({ method: "POST" })
  .validator((d: unknown) => ESQ_AUTOMATICO.parse(d))
  .handler(async ({ data }): Promise<boolean> => {
    const sess = requireClienteSession();
    try {
      await rpc(await dbCliente(), "portal_cliente_tour_automatico", {
        _cid: sess.cid,
        p_ligado: data.ligado,
      });
      return true;
    } catch {
      return false;
    }
  });

/** As quatro operações do tour para cada público (o motor e o botão de ajuda usam). */
export const API_TOUR: Record<
  PublicoTour,
  {
    estado: (telas: string[]) => Promise<EstadoTour | null>;
    registrar: (
      tela: string,
      versao: number,
      estado: (typeof ESTADOS)[number],
      passo: number,
    ) => Promise<boolean>;
    reiniciar: (tela?: string) => Promise<boolean>;
    automatico: (ligado: boolean) => Promise<boolean>;
  }
> = {
  equipe: {
    estado: (telas) => tourEstadoEquipe({ data: { telas } }).catch(() => null),
    registrar: (tela, versao, estado, passo) =>
      tourRegistrarEquipe({ data: { tela, versao, estado, passo } }).catch(() => false),
    reiniciar: (tela) => tourReiniciarEquipe({ data: { tela: tela ?? null } }).catch(() => false),
    automatico: (ligado) => tourAutomaticoEquipe({ data: { ligado } }).catch(() => false),
  },
  cliente: {
    estado: (telas) => tourEstadoCliente({ data: { telas } }).catch(() => null),
    registrar: (tela, versao, estado, passo) =>
      tourRegistrarCliente({ data: { tela, versao, estado, passo } }).catch(() => false),
    reiniciar: (tela) => tourReiniciarCliente({ data: { tela: tela ?? null } }).catch(() => false),
    automatico: (ligado) => tourAutomaticoCliente({ data: { ligado } }).catch(() => false),
  },
};

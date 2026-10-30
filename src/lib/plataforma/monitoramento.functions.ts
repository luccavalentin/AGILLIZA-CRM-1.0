/**
 * Monitoramento e incidentes da plataforma (Agilliza Tech + banco único), no Agilliza.
 * `listar_incidentes` pagina de 50 em 50 (POR_PAGINA_INCIDENTES).
 * Mesmas leituras da Gestão: `plataforma.painel_tecnico()` e `plataforma.listar_incidentes`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { Json } from "@/integrations/supabase/types";

export interface RotinaPlataforma {
  nome: string;
  ativo: boolean;
  ultimo_fim: string | null;
  ultimo_erro: string | null;
  ultimo_status: string | null;
}

export interface PainelTecnico {
  gerado_em: string;
  fila?: { pendentes: number; mortas_24h: number; mais_antiga: string | null };
  jobs?: RotinaPlataforma[];
  banco?: {
    uso_pct: number | null;
    conexoes: number | null;
    max_conexoes: number | null;
    cache_hit_pct: number | null;
    deadlocks_total: number | null;
    aguardando_bloqueio: number | null;
    ociosas_em_transacao: number | null;
    consulta_mais_longa_s: number | null;
    transacao_mais_longa_s: number | null;
    medido_em: string | null;
  };
  coletas?: {
    worker?: {
      dados?: { nome?: string; memoria_mb?: number; faixas?: string[] };
      coletado_em?: string;
    };
  };
  incidentes?: { abertos: number; criticos: number };
  webhooks_24h?: { recebidos: number; com_erro: number; recusados: number };
  provedores_1h?: {
    provedor: string;
    chamadas: number;
    falhas_fornecedor: number;
    recusas: number;
    p95_ms: number | null;
  }[];
  consultas_pagas?: { reconciliar: number; pagas_sem_entrega: number };
  propostas_erro_envio_1h?: number;
}

export interface Incidente {
  id: string;
  chave: string;
  severidade: "info" | "aviso" | "alta" | "critica";
  origem: string;
  categoria: string;
  titulo: string;
  detalhe: Json;
  conta: string | null;
  status: "aberto" | "reconhecido" | "resolvido";
  responsavel: string | null;
  ocorrencias: number;
  primeira_em: string;
  ultima_em: string;
  resolvido_em: string | null;
  resolucao: string | null;
}

export interface ListaIncidentes {
  incidentes: Incidente[];
  total: number;
  abertos: number;
  criticos: number;
}

export const POR_PAGINA_INCIDENTES = 50;

export const lerMonitoramento = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.monitoramento", "view"])])
  .validator((d: unknown) =>
    z
      .object({
        status: z.enum(["aberto", "reconhecido", "resolvido"]).optional().nullable(),
        // `listar_incidentes` devolve 50 por página; antes só a primeira era lida.
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      const painel = await tx.uma<{ r: PainelTecnico }>("select plataforma.painel_tecnico() as r");
      const lista = await tx.uma<{ r: ListaIncidentes }>(
        "select plataforma.listar_incidentes($1, $2) as r",
        [data.status ?? null, data.pagina],
      );
      return {
        painel: painel?.r ?? ({ gerado_em: new Date().toISOString() } as PainelTecnico),
        lista: lista?.r ?? { incidentes: [], total: 0, abertos: 0, criticos: 0 },
      };
    });
  });

export const agirIncidente = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.monitoramento", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        acao: z.enum(["reconhecer", "resolver", "reabrir"]),
        texto: z.string().trim().max(1000).optional().nullable(),
      })
      .refine((v) => v.acao !== "resolver" || (v.texto ?? "").length >= 5, {
        message: "Para resolver, descreva o que foi feito (pelo menos 5 caracteres).",
        path: ["texto"],
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.atualizar_incidente($1, $2, null, $3)", [
        data.id,
        data.acao,
        data.texto || null,
      ]),
    );
    return { ok: true as const };
  });

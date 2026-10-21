/**
 * Integrações e filas da plataforma (Corretor 2.0 + banco único), no Agilliza.
 *
 * Mesmas leituras e escritas da Gestão (apps/web/src/app/[portal]/integracoes e
 * integracoes-credito): `plataforma.resumo_filas()`, `plataforma.filas(...)` (payload já
 * mascarado pelo banco), `plataforma.jobs`, o agregado de `integracao.integracoes_log`,
 * `plataforma.log_recente(...)`, `plataforma.credenciais_listar()` (só dicas, nunca o valor)
 * e `integracao.reprocessar_mortas(...)`.
 *
 * O banco exige `integracoes.ver` para ler (e para ligar/desligar job, pela RLS de
 * `plataforma.jobs`) e `integracoes.reprocessar` para devolver mensagem morta à fila.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { Json } from "@/integrations/supabase/types";

export interface ResumoFila {
  faixa: string;
  status: string;
  total: number;
  mais_antiga: string | null;
}

export interface MensagemFila {
  id: string;
  tipo: string;
  tenant_id: string | null;
  conta: string | null;
  faixa: string;
  status: string;
  tentativas: number;
  max_tentativas: number;
  erro: string | null;
  payload: Json;
  criado_em: string;
  proximo_em: string | null;
  processado_em: string | null;
}

export interface JobPlataforma {
  nome: string;
  cron: string;
  descricao: string | null;
  ativo: boolean;
  ultimo_status: string | null;
  ultimo_erro: string | null;
  ultimo_inicio: string | null;
  ultimo_fim: string | null;
  proxima_execucao: string | null;
}

export interface ProvedorChamadas {
  provedor: string;
  chamadas: number;
  erros: number;
  latencia_ms: number | null;
  ultima: string | null;
}

export interface LinhaLog {
  id: string;
  provedor: string;
  endpoint: string | null;
  metodo: string | null;
  status_http: number | null;
  duracao_ms: number | null;
  erro: string | null;
  referencia: string | null;
  criado_em: string;
}

export interface CredencialSituacao {
  provedor: string;
  ambiente: string;
  dicas: Json;
  base_url: string | null;
  ativo: boolean;
  observacao: string | null;
  atualizado_por: string | null;
  atualizado_em: string;
}

/** Os provedores de que o crédito depende (a "Integrações de crédito" da Gestão + APIFull). */
export const PROVEDORES_DO_CREDITO = ["homefin", "serasa", "boavista", "apifull"] as const;

export const STATUS_FILA = ["pendente", "processando", "erro", "morto", "concluido"] as const;
export type StatusFila = (typeof STATUS_FILA)[number];

function ambiente(): "producao" | "homologacao" {
  return (process.env.PROVEDOR_AMBIENTE ?? "homologacao") === "producao"
    ? "producao"
    : "homologacao";
}

export const lerIntegracoes = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.integracoes", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(STATUS_FILA).nullable().optional(),
        faixa: z.string().trim().max(60).nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const amb = ambiente();
    return comPlataforma(context.userId, async (tx) => {
      const pode = await tx.uma<{ reprocessar: boolean }>(
        "select seguranca.auth_e_plataforma('integracoes.reprocessar') as reprocessar",
      );
      const resumo = await tx.consultar<ResumoFila>(
        `select faixa, status, total::int as total, mais_antiga::text as mais_antiga
           from plataforma.resumo_filas()`,
      );
      const mensagens = await tx.consultar<MensagemFila>(
        `select id, tipo, tenant_id, conta, faixa, status, tentativas, max_tentativas, erro, payload,
                criado_em::text as criado_em, proximo_em::text as proximo_em,
                processado_em::text as processado_em
           from plataforma.filas($1::text, $2::text, 150)`,
        [data.status ?? null, data.faixa || null],
      );
      const jobs = await tx.consultar<JobPlataforma>(
        `select nome, cron, descricao, ativo, ultimo_status::text as ultimo_status, ultimo_erro,
                ultimo_inicio::text as ultimo_inicio, ultimo_fim::text as ultimo_fim,
                proxima_execucao::text as proxima_execucao
           from plataforma.jobs order by nome`,
      );
      const provedores = await tx.consultar<ProvedorChamadas>(
        `select l.provedor,
                count(*)::int as chamadas,
                (count(*) filter (where l.status_http >= 400 or l.erro is not null))::int as erros,
                round(avg(l.duracao_ms))::int as latencia_ms,
                max(l.criado_em)::text as ultima
           from integracao.integracoes_log l
          where l.criado_em > now() - interval '7 days'
          group by l.provedor
          order by count(*) desc`,
      );
      const log = await tx.consultar<LinhaLog>(
        `select id, provedor, endpoint, metodo, status_http, duracao_ms, erro, referencia,
                criado_em::text as criado_em
           from plataforma.log_recente(120, false)`,
      );
      const credenciais = await tx.consultar<CredencialSituacao>(
        `select provedor, ambiente, dicas, base_url, ativo, observacao, atualizado_por,
                atualizado_em::text as atualizado_em
           from plataforma.credenciais_listar()
          where ambiente = $1 and provedor = any ($2::text[])`,
        [amb, [...PROVEDORES_DO_CREDITO]],
      );
      return {
        ambiente: amb,
        resumo,
        mensagens,
        jobs,
        provedores,
        log,
        credenciais,
        podeReprocessar: Boolean(pode?.reprocessar),
      };
    });
  });

/** Devolve mensagens mortas à fila (zera as tentativas). Única escrita no outbox. */
export const reprocessarMortas = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.integracoes", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        ids: z
          .array(z.string().uuid())
          .min(1, "Selecione ao menos uma mensagem.")
          .max(500, "Selecione no máximo 500 mensagens."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ n: number }>("select integracao.reprocessar_mortas($1::uuid[])::int as n", [
        data.ids,
      ]),
    );
    return { ok: true as const, devolvidas: Number(r?.n ?? 0) };
  });

/** Liga ou desliga uma rotina agendada da plataforma (RLS de `plataforma.jobs`). */
export const alternarJobPlataforma = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.integracoes", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().regex(/^[a-z_]{3,60}$/, "Rotina inválida."),
        ativo: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ nome: string }>(
        "update plataforma.jobs set ativo = $2 where nome = $1 returning nome",
        [data.nome, data.ativo],
      ),
    );
    if (!r) throw new Error("Rotina não encontrada (ou o banco recusou a alteração).");
    return { ok: true as const };
  });

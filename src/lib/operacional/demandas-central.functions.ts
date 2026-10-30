/**
 * Demandas (C36): Central, Kanban, ações e configuração da fila justa.
 *
 * Tudo passa pelas funções do banco (migração 20261027040001), chamadas com a sessão da
 * pessoa (cliente do Supabase com o token dela): o banco confere correspondente, permissão,
 * trava de corrida e grava o porquê de cada atribuição. Aqui só validamos a forma da
 * entrada e traduzimos o retorno.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  DemandaEscopo,
  DemandaOrigem,
  DemandaPrioridade,
  DemandaStatus,
} from "./demandas-regras";

export interface DemandaCentralItem {
  id: string;
  numero: string | null;
  tipo: string;
  titulo: string;
  status: DemandaStatus;
  prioridade: DemandaPrioridade;
  origem_tipo: DemandaOrigem;
  conta_id: string | null;
  conta_nome: string | null;
  solicitante_nome: string | null;
  ref_tipo: string | null;
  ref_id: string | null;
  ref_codigo: string | null;
  ref_status: string | null;
  cliente_id: string | null;
  nome_cliente: string | null;
  proposta_id: string | null;
  simulacao_id: string | null;
  responsavel_id: string | null;
  nome_responsavel: string | null;
  criador_id: string | null;
  nome_criador: string | null;
  fila_id: string | null;
  nome_fila: string | null;
  atribuicao_motivo: string | null;
  atribuida_em: string | null;
  prazo_sla: string | null;
  sla_inicio: string | null;
  sla_horas: number | null;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
  nao_lidas: number;
  ultima_mensagem_em: string | null;
}

export interface DemandaContadores {
  minhas: number;
  criadas: number;
  equipe: number;
  sem_responsavel: number;
  atrasadas: number;
  vencendo: number;
  aguardando: number;
  concluidas_hoje: number;
}

export interface DemandaCentral {
  contadores: DemandaContadores;
  itens: DemandaCentralItem[];
  eu: string;
  pode_gerir: boolean;
  minha_carga: number;
  meu_limite: number | null;
  estou_ausente: boolean;
}

export interface TipoDemanda {
  codigo: string;
  nome: string;
  sla_horas: number;
  ativo: boolean;
  ordem: number;
  padrao: boolean;
}

export interface CandidatoFila {
  user_id: string;
  nome: string;
  carga: number;
  limite: number | null;
  ausente: boolean;
  ultima_atribuicao_em: string | null;
  disponivel: boolean;
}

export interface FilaDemanda {
  id: string;
  nome: string;
  descricao: string | null;
  tipos: string[];
  origens: DemandaOrigem[];
  ativa: boolean;
  ordem: number;
  pendentes: number;
  membros: CandidatoFila[];
}

export interface PessoaDemanda {
  user_id: string;
  nome: string;
  acesso_tipo: string | null;
  papeis: string[];
  carga: number;
  limite: number | null;
  ausente: boolean;
  ausente_desde: string | null;
  ausente_ate: string | null;
  ausencia_motivo: string | null;
  ultima_atribuicao_em: string | null;
}

export interface ConfigDemandas {
  pode_gerir: boolean;
  eu: string;
  recebe_assinantes: boolean;
  outro_recebe: boolean;
  tipos: TipoDemanda[];
  filas: FilaDemanda[];
  pessoas: PessoaDemanda[];
}

const UUID = z.string().uuid();

/** RPC das funções novas (os tipos gerados do Supabase ainda não as conhecem). */
async function rpc<T>(supabase: unknown, nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (
    supabase as {
      rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc(nome, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const centralDemandas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        escopo: z.enum(["minhas", "criadas", "equipe", "sem_responsavel"]).default("minhas"),
        status: z.array(z.enum(["aberta", "em_andamento", "aguardando", "concluida", "cancelada"])).max(5).optional(),
        tipo: z.string().max(40).optional().nullable(),
        origem: z.enum(["interno", "assinante", "vinculado"]).optional().nullable(),
        prioridade: z.enum(["p1", "p2", "p3"]).optional().nullable(),
        responsavel_id: UUID.optional().nullable(),
        fila_id: UUID.optional().nullable(),
        sla: z.enum(["atrasadas", "vencendo", "no_prazo"]).optional().nullable(),
        termo: z.string().trim().max(120).optional().nullable(),
        encerradas_dias: z.number().int().min(0).max(90).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<DemandaCentral> => {
    const filtros: Record<string, unknown> = { escopo: data.escopo as DemandaEscopo };
    if (data.status?.length) filtros.status = data.status;
    if (data.tipo) filtros.tipo = data.tipo;
    if (data.origem) filtros.origem = data.origem;
    if (data.prioridade) filtros.prioridade = data.prioridade;
    if (data.responsavel_id) filtros.responsavel_id = data.responsavel_id;
    if (data.fila_id) filtros.fila_id = data.fila_id;
    if (data.sla) filtros.sla = data.sla;
    if (data.termo) filtros.termo = data.termo;
    if (data.encerradas_dias !== undefined) filtros.encerradas_dias = data.encerradas_dias;
    return rpc<DemandaCentral>(context.supabase, "demanda_central", { p: filtros });
  });

export const criarDemandaNaFila = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        tipo: z.string().trim().min(2).max(40),
        titulo: z.string().trim().min(2, "Dê um título à demanda.").max(160),
        descricao: z.string().trim().max(4000).optional().nullable(),
        prioridade: z.enum(["p1", "p2", "p3"]).default("p2"),
        cliente_id: UUID.optional().nullable(),
        proposta_id: UUID.optional().nullable(),
        simulacao_id: UUID.optional().nullable(),
        responsavel_id: UUID.optional().nullable(),
        fila_id: UUID.optional().nullable(),
        conta_id: UUID.optional().nullable(),
        participantes: z.array(UUID).max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const id = await rpc<string>(context.supabase, "demanda_criar", { p: data });
    // Participantes ficam sabendo (o responsável já é avisado pelo banco na atribuição).
    const participantes = [...new Set(data.participantes ?? [])].filter(
      (u) => u !== context.userId && u !== data.responsavel_id,
    );
    if (participantes.length) {
      const corr = await rpc<string>(context.supabase, "correspondente_do_usuario", {
        _user_id: context.userId,
      });
      for (const uid of participantes) {
        await context.supabase.rpc("emitir_notificacao", {
          _user_id: uid,
          _corr: corr,
          _tipo: "demanda.criada",
          _titulo: "Nova demanda: " + data.titulo,
          _corpo: data.descricao ?? "",
          _link: "/operacional/demandas/" + id,
        });
      }
    }
    return { id };
  });

export const assumirDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "demanda_assumir", { p_dem: data.id });
    return { ok: true as const };
  });

export const pegarProximaDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const id = await rpc<string | null>(context.supabase, "demanda_pegar_proxima", {});
    return { id };
  });

export const reatribuirDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: UUID,
        para: UUID.nullable(),
        motivo: z.string().trim().min(5, "Explique o motivo em poucas palavras.").max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await rpc<{ ok: boolean; responsavel_id?: string; motivo?: string }>(
      context.supabase,
      "demanda_reatribuir",
      { p_dem: data.id, p_para: data.para, p_motivo: data.motivo },
    );
    return r;
  });

export const mudarStatusDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: UUID,
        status: z.enum(["aberta", "em_andamento", "aguardando", "concluida", "cancelada"]),
        motivo: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "demanda_mudar_status", {
      p_dem: data.id,
      p_status: data.status,
      p_motivo: data.motivo ?? null,
    });
    return { ok: true as const };
  });

export const configDemandas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConfigDemandas> =>
    rpc<ConfigDemandas>(context.supabase, "demanda_config_ler", {}),
  );

export const salvarTipoDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        codigo: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z][a-z0-9_]{1,39}$/, "Use letras minúsculas, números e _ no código."),
        nome: z.string().trim().min(2).max(60),
        sla_horas: z.number().min(0.5, "O prazo mínimo é meia hora útil.").max(720),
        ativo: z.boolean().default(true),
        ordem: z.number().int().min(0).max(1000).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "demanda_tipo_salvar", {
      p_codigo: data.codigo,
      p_nome: data.nome,
      p_sla_horas: data.sla_horas,
      p_ativo: data.ativo,
      p_ordem: data.ordem,
    });
    return { ok: true as const };
  });

export const salvarFilaDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: UUID.optional().nullable(),
        nome: z.string().trim().min(2, "Dê um nome à fila.").max(60),
        descricao: z.string().trim().max(300).optional().nullable(),
        tipos: z.array(z.string().max(40)).max(50).default([]),
        origens: z.array(z.enum(["interno", "assinante", "vinculado"])).max(3).default([]),
        ativa: z.boolean().default(true),
        ordem: z.number().int().min(0).max(1000).default(100),
        membros: z.array(UUID).max(200).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const id = await rpc<string>(context.supabase, "demanda_fila_salvar", { p: data });
    return { id };
  });

export const excluirFilaDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "demanda_fila_excluir", { p_id: data.id });
    return { ok: true as const };
  });

export const salvarDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        user_id: UUID,
        limite: z.number().int().min(1).max(500).nullable(),
        ausente_desde: z.string().datetime({ offset: true }).nullable(),
        ausente_ate: z.string().datetime({ offset: true }).nullable(),
        motivo: z.string().trim().max(200).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "demanda_pessoa_salvar", {
      p_user: data.user_id,
      p_limite: data.limite,
      p_ausente_desde: data.ausente_desde,
      p_ausente_ate: data.ausente_ate,
      p_motivo: data.motivo,
    });
    return { ok: true as const };
  });

export const salvarRecebeAssinantes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ recebe: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "demanda_config_salvar", { p_recebe_assinantes: data.recebe });
    return { ok: true as const };
  });

export const redistribuirDemandas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const n = await rpc<number>(context.supabase, "demanda_redistribuir_agora", {});
    return { distribuidas: n ?? 0 };
  });

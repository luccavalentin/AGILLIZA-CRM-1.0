/**
 * Automações no Agilliza correspondente: a AgillizaTech posta nas PRÓPRIAS redes.
 *
 * O motor é o do Agilliza Tech (migrações 0227–0231, banco único): pela ponte (0175), no
 * contexto da plataforma, as funções social.* trabalham na conta da plataforma. O login
 * oficial das redes passa pela página do Corretor com um pedido de uso único (0231).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { REDES, validarDestino, type Rede } from "./catalogo";

export interface RedeConectada {
  id: string;
  rede: Rede;
  nome: string;
  usuario: string | null;
  avatar_url: string | null;
  status: "ativa" | "expirada" | "revogada" | "erro";
  ultimo_erro: string | null;
}

export interface DestinoPost {
  id: string;
  conta_id: string;
  rede: Rede;
  conta: string;
  formato: string;
  legenda_propria: string | null;
  status: "pendente" | "publicando" | "publicado" | "falhou" | "cancelado";
  erro: string | null;
  url: string | null;
  metricas: Record<string, number | null> | null;
}

export type StatusPost =
  | "rascunho"
  | "aguardando_aprovacao"
  | "agendado"
  | "publicando"
  | "publicado"
  | "parcial"
  | "falhou"
  | "cancelado";

export interface PostResumo {
  id: string;
  legenda: string;
  status: StatusPost;
  agendado_para: string | null;
  publicado_em: string | null;
  midias: { id: string; posicao: number }[];
  destinos: DestinoPost[];
  link_url: string | null;
  cliques: number | null;
  leads: number | null;
}

export interface PostDetalhe extends PostResumo {
  token_aprovacao: string | null;
  comentarios: { autor: string; do_cliente: boolean; tipo: string; corpo: string; em: string }[];
}

export interface Relatorio {
  totais: Record<
    | "publicados"
    | "falhas"
    | "alcance"
    | "curtidas"
    | "comentarios"
    | "compartilhamentos"
    | "visualizacoes"
    | "cliques"
    | "leads",
    number
  >;
  por_rede: {
    rede: Rede;
    publicados: number;
    falhas: number;
    alcance: number;
    curtidas: number;
    comentarios: number;
  }[];
}

async function ponte() {
  return import("@/lib/plataforma/ponte.server");
}

const UUID = z.string().uuid();
const VER = exigirPermissao(["marketing.automacoes", "view"]);
const EDITAR = exigirPermissao(["marketing.automacoes", "edit"]);

export const listarRedesAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: RedeConectada[] }>("select social.minhas_contas() as j"),
    );
    return r?.j ?? [];
  });

export const removerRedeAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select social.remover_conta($1)", [data.id]),
    );
    return { ok: true as const };
  });

/** Endereço para conectar uma rede: pedido de uso único (10 min) no Corretor. */
export const linkConectarRedeAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .inputValidator((d: unknown) =>
    z
      .object({
        conector: z.enum(["meta", "linkedin", "youtube", "google_business", "tiktok", "teste"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const voltar = `${(process.env.VITE_SITE_URL ?? "https://crm.agillizatech.com.br").replace(/\/$/, "")}/automacoes`;
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ t: string }>("select social.pedir_conexao($1, $2) as t", [data.conector, voltar]),
    );
    const corretor = (process.env.CORRETOR_URL_PUBLICA ?? "https://agillizatech.com.br").replace(
      /\/$/,
      "",
    );
    return {
      url: `${corretor}/api/social/conectar/${data.conector}?pedido=${encodeURIComponent(r!.t)}`,
    };
  });

export const postsDoPeriodoAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) =>
    z.object({ de: z.string().datetime(), ate: z.string().datetime() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: PostResumo[] }>("select social.posts_do_periodo($1, $2) as j", [
        data.de,
        data.ate,
      ]),
    );
    return r?.j ?? [];
  });

export const carregarPostAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: PostDetalhe | null }>("select social.post($1) as j", [data.id]),
    );
    return r?.j ?? null;
  });

const DESTINO = z.object({
  conta_id: UUID,
  rede: z.string(),
  formato: z.string().max(20),
  legenda_propria: z.string().max(63206).nullable().optional(),
});

/** Valida pelas regras de cada rede (as mesmas do Corretor) e grava. */
export const salvarPostAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: UUID.nullable(),
        legenda: z.string().max(63206),
        agendadoPara: z.string().datetime().nullable(),
        destinos: z.array(DESTINO).max(30),
        midias: z.array(z.object({ id: UUID, mime: z.string() })).max(10),
        intencao: z.enum(["rascunho", "aprovacao", "agendar"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.intencao !== "rascunho") {
      const erros = data.destinos.flatMap((x) =>
        REDES[x.rede as Rede]
          ? validarDestino(
              x.rede as Rede,
              x.formato,
              x.legenda_propria ?? data.legenda,
              data.midias,
            )
          : [],
      );
      if (erros.length) throw new Error(erros.join(" "));
    }
    if (
      data.intencao === "agendar" &&
      data.agendadoPara &&
      Date.parse(data.agendadoPara) < Date.now() - 5 * 60_000
    ) {
      throw new Error("A data da publicação já passou. Escolha um horário a partir de agora.");
    }
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>("select social.salvar_post($1, $2, $3, $4, $5, $6, null) as id", [
        data.id,
        data.legenda,
        data.agendadoPara,
        JSON.stringify(
          data.destinos.map((x) => ({
            conta_id: x.conta_id,
            formato: x.formato,
            legenda_propria: x.legenda_propria ?? null,
          })),
        ),
        data.midias.map((m) => m.id),
        data.intencao,
      ]),
    );
    return { id: r!.id };
  });

export const cancelarPostAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select social.cancelar_post($1)", [data.id]),
    );
    return { ok: true as const };
  });

export const repetirFalhasAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ n: number }>("select social.repetir_falhas($1) as n", [data.id]),
    );
    return { n: r?.n ?? 0 };
  });

export const relatorioAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) =>
    z.object({ de: z.string().datetime(), ate: z.string().datetime() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: Relatorio }>("select social.relatorio($1, $2) as j", [data.de, data.ate]),
    );
    return r?.j ?? null;
  });

const CONECTORES_VALIDOS = [
  "meta",
  "linkedin",
  "youtube",
  "google_business",
  "tiktok",
  "teste",
] as const;

/**
 * A postagem está ligada neste servidor? (SOCIAL_ATIVO=1; desligada, a página é a prévia "Em breve".)
 * SOCIAL_CONECTORES lista as redes já liberadas no Corretor (ex.: "meta,linkedin"); as outras
 * aparecem como "Em liberação". O endereço do Corretor serve ao link de aprovação do post.
 */
export const estadoAutomacoes = createServerFn({ method: "GET" }).handler(async () => ({
  ativo: process.env.SOCIAL_ATIVO === "1",
  conectores: (process.env.SOCIAL_CONECTORES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c): c is (typeof CONECTORES_VALIDOS)[number] =>
      (CONECTORES_VALIDOS as readonly string[]).includes(c),
    ),
  corretorUrl: (process.env.CORRETOR_URL_PUBLICA ?? "https://agillizatech.com.br").replace(
    /\/$/,
    "",
  ),
}));

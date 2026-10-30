/**
 * Automações no Agilliza correspondente: a AgillizaTech agenda e publica nas PRÓPRIAS redes,
 * no modelo do Postei (calendário, posts, novo post, mídia, relatórios e redes).
 *
 * O motor é o do Agilliza Tech (migrações 0227–0231, 0252 e 0440, banco único): pela ponte
 * (0175), no contexto da plataforma, as funções social.* trabalham na conta da plataforma —
 * nenhuma função daqui recebe id de conta. O login oficial das redes passa pela página do
 * Corretor com um pedido de uso único (0231) e volta para a escolha das contas (0440).
 *
 * Ligada por padrão para quem tem o módulo `marketing.automacoes`; `AUTOMACOES_AGILLIZA=0`
 * desliga (chave própria: não depende do SOCIAL_ATIVO dos assinantes).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { REDES, validarDestino, type Conector, type Rede } from "./catalogo";

/** Valor que atravessa a server function (JSON). */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
/** Opções de um destino: só valores simples (texto, número, sim/não). */
export type Opcoes = Record<string, string | number | boolean | null>;

export type SituacaoMetricas = "ok" | "parcial" | "sem_permissao" | "indisponivel" | "erro";

export interface RedeConectada {
  id: string;
  rede: Rede;
  nome: string;
  usuario: string | null;
  avatar_url: string | null;
  status: "ativa" | "expirada" | "revogada" | "erro";
  ultimo_erro: string | null;
  token_expira_em: string | null;
  escopos?: string[];
  tipo?: string | null;
  renovavel?: boolean;
  metricas_situacao?: SituacaoMetricas | null;
  metricas_aviso?: string | null;
  metricas_em?: string | null;
  criado_em?: string;
}

export interface MetricasDestino {
  alcance: number | null;
  impressoes: number | null;
  curtidas: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  salvos: number | null;
  visualizacoes: number | null;
  coletado_em?: string | null;
}

export interface DestinoPost {
  id: string;
  conta_id: string;
  rede: Rede;
  conta: string;
  conta_usuario?: string | null;
  conta_avatar?: string | null;
  formato: string;
  legenda_propria: string | null;
  opcoes?: Opcoes;
  status: "pendente" | "publicando" | "publicado" | "falhou" | "cancelado";
  tentativas?: number;
  erro: string | null;
  url: string | null;
  publicado_em?: string | null;
  proxima_tentativa_em?: string | null;
  metricas: MetricasDestino | null;
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

export interface MidiaDoPost {
  id: string;
  posicao: number;
  mime?: string | null;
  duracao_ms?: number | null;
}

export interface PostResumo {
  id: string;
  legenda: string;
  status: StatusPost;
  agendado_para: string | null;
  publicado_em: string | null;
  origem?: "manual" | "automacao";
  autor?: string | null;
  midias: MidiaDoPost[];
  destinos: DestinoPost[];
  link_url: string | null;
  cliques: number | null;
  leads: number | null;
  criado_em?: string;
  /** Endereço selado da primeira mídia (miniatura), quando a ponte de arquivos está ligada. */
  capa?: { url: string; mime: string } | null;
}

export interface PostDetalhe extends PostResumo {
  token_aprovacao: string | null;
  eventos?: { tipo: string; dados: { [k: string]: Json }; em: string }[];
  comentarios: { autor: string; do_cliente: boolean; tipo: string; corpo: string; em: string }[];
  /** Endereço selado de cada mídia do post. */
  urls?: Record<string, string>;
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

export interface ResumoSemana {
  agendados: number;
  publicados: number;
  falhas: number;
  rascunhos: number;
  aprovacao: number;
  proximo_em: string | null;
}

export type SituacaoFiltro =
  | "todos"
  | "agendados"
  | "publicados"
  | "falhas"
  | "rascunhos"
  | "aprovacao"
  | "automacao"
  | "cancelados";

export interface ListaPosts {
  itens: PostResumo[];
  total: number;
  contagens: Record<SituacaoFiltro, number>;
}

export interface ItemBiblioteca {
  id: string;
  mime: string;
  nome: string | null;
  bytes: number;
  largura: number | null;
  altura: number | null;
  duracao_ms: number | null;
  criado_em: string;
  origem: "enviada" | "imovel";
  imovel_codigo: string | null;
  imovel_titulo: string | null;
  usos: number;
  url?: string | null;
}

export interface Biblioteca {
  itens: ItemBiblioteca[];
  total: number;
  bytes_enviados: number;
}

export interface PostDoRelatorio {
  id: string;
  legenda: string;
  publicado_em: string;
  redes: Rede[];
  midia: string | null;
  alcance: number | null;
  impressoes: number | null;
  visualizacoes: number | null;
  curtidas: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  salvos: number | null;
  cliques: number | null;
  leads: number | null;
  capa?: { url: string; mime: string } | null;
}

export interface RelatorioPublicacao {
  dias: number;
  publicados: number;
  falhas: number;
  na_fila: number;
  antecedencia_media_h: number | null;
  semanal: { semana: string; n: number }[];
  por_dia_semana: { dia: number; n: number }[];
  por_hora: { hora: number; n: number }[];
  por_rede: {
    rede: Rede;
    publicados: number;
    falhas: number;
    alcance: number;
    visualizacoes: number;
    curtidas: number;
    comentarios: number;
    compartilhamentos: number;
    salvos: number;
  }[];
  fila: { dia: string; n: number }[];
  engajamento: {
    alcance: number;
    impressoes: number;
    visualizacoes: number;
    curtidas: number;
    comentarios: number;
    compartilhamentos: number;
    salvos: number;
    cliques: number;
    leads: number;
    com_metricas: number;
    ultima_coleta: string | null;
  };
  posts: PostDoRelatorio[];
}

export interface DiaMetricaConta {
  dia: string;
  seguidores: number | null;
  novos_seguidores: number | null;
  alcance: number | null;
  impressoes: number | null;
  visualizacoes: number | null;
  visitas_perfil: number | null;
  cliques_site: number | null;
  engajamento: number | null;
}

export interface MetricaConta {
  id: string;
  rede: Rede;
  nome: string;
  usuario: string | null;
  avatar_url: string | null;
  status: string;
  tipo: string | null;
  situacao: SituacaoMetricas | "pendente";
  aviso: string | null;
  coletado_em: string | null;
  seguidores: number | null;
  seguidores_inicio: number | null;
  publicacoes: number | null;
  novos_seguidores: number | null;
  alcance: number | null;
  impressoes: number | null;
  visualizacoes: number | null;
  visitas_perfil: number | null;
  cliques_site: number | null;
  engajamento: number | null;
  serie: DiaMetricaConta[];
}

export interface MetricasDaConta {
  dias: number;
  contas: MetricaConta[];
}

export interface ContaPendente {
  id: string;
  rede: Rede;
  nome: string;
  usuario: string | null;
  avatar_url: string | null;
  detalhe: string | null;
  conector: string;
  ja_conectada: boolean;
}

export interface InfoCriadorTiktok {
  apelido: string | null;
  usuario: string | null;
  avatar: string | null;
  privacidades: string[];
  comentarioDesativado: boolean;
  duetoDesativado: boolean;
  costuraDesativada: boolean;
  duracaoMaximaS: number | null;
}

async function ponte() {
  return import("@/lib/plataforma/ponte.server");
}

const UUID = z.string().uuid();
const VER = exigirPermissao(["marketing.automacoes", "view"]);
const EDITAR = exigirPermissao(["marketing.automacoes", "edit"]);

type Tx = {
  consultar<T>(sql: string, params?: unknown[]): Promise<T[]>;
  uma<T>(sql: string, params?: unknown[]): Promise<T | null>;
};

/** Miniatura (endereço selado) da primeira mídia de cada post, na mesma transação. */
async function comCapas<T extends { midias?: MidiaDoPost[] }>(
  tx: Tx,
  itens: T[],
): Promise<(T & { capa: { url: string; mime: string } | null })[]> {
  const { liberarMidias } = await import("@/lib/plataforma/midias.server");
  const primeiras = itens.map(
    (p) => [...(p.midias ?? [])].sort((a, b) => a.posicao - b.posicao)[0]?.id,
  );
  const lib = await liberarMidias(tx, primeiras);
  return itens.map((p, i) => {
    const id = primeiras[i];
    const l = id ? lib[id] : undefined;
    return { ...p, capa: l ? { url: l.url, mime: l.mime } : null };
  });
}

// ---------------------------------------------------------------- estado e redes ---

const CONECTORES_OFICIAIS: Conector[] = [
  "meta",
  "linkedin",
  "tiktok",
  "youtube",
  "google_business",
];

/** Endereço público do Corretor (login das redes, aprovação do cliente e endereços de retorno). */
function corretorUrl() {
  return (process.env.CORRETOR_URL_PUBLICA ?? "https://agillizatech.com.br").replace(/\/$/, "");
}

/**
 * As Automações estão ligadas neste servidor? Chave própria (`AUTOMACOES_AGILLIZA`, padrão
 * ligada): o Agilliza faz a gestão das redes da AgillizaTech mesmo com o "Em breve" dos
 * assinantes. Conectores: os oficiais sempre aparecem (sem a chave do app, o Corretor devolve
 * `erro=indisponivel`); a Rede de teste só com `SOCIAL_CONECTORES` contendo "teste".
 */
export const estadoAutomacoes = createServerFn({ method: "GET" }).handler(async () => {
  const extras = (process.env.SOCIAL_CONECTORES ?? "").split(",").map((c) => c.trim());
  return {
    ativo: process.env.AUTOMACOES_AGILLIZA !== "0",
    conectores: [
      ...CONECTORES_OFICIAIS,
      ...(extras.includes("teste") ? (["teste"] as Conector[]) : []),
    ],
    corretorUrl: corretorUrl(),
  };
});

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
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select social.remover_conta($1)", [data.id]),
    );
    return { ok: true as const };
  });

/** Endereço para conectar uma rede: pedido de uso único (10 min) no Corretor; volta em Redes. */
export const linkConectarRedeAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .validator((d: unknown) =>
    z
      .object({
        conector: z.enum(["meta", "linkedin", "youtube", "google_business", "tiktok", "teste"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const voltar = `${(process.env.VITE_SITE_URL ?? "https://crm.agillizatech.com.br").replace(/\/$/, "")}/automacoes/redes`;
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ t: string }>("select social.pedir_conexao($1, $2) as t", [data.conector, voltar]),
    );
    return {
      url: `${corretorUrl()}/api/social/conectar/${data.conector}?pedido=${encodeURIComponent(r!.t)}`,
    };
  });

/** Contas que o login da rede trouxe, esperando a escolha (sem token). */
export const contasPendentesAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) => z.object({ lote: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: ContaPendente[] }>("select social.contas_pendentes($1) as j", [data.lote]),
    );
    return r?.j ?? [];
  });

/** Conecta as contas escolhidas (decifra e cifra o token: precisa da chave-mestra). */
export const confirmarContasAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .validator((d: unknown) => z.object({ lote: UUID, ids: z.array(UUID).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(
      context.userId,
      (tx) =>
        tx.uma<{ n: number }>("select social.confirmar_contas($1, $2::uuid[]) as n", [
          data.lote,
          data.ids,
        ]),
      { kek: true },
    );
    return { n: r?.n ?? 0 };
  });

// ---------------------------------------------------------------------- posts ---

export const postsDoPeriodoAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) =>
    z.object({ de: z.string().datetime(), ate: z.string().datetime() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: PostResumo[] }>("select social.posts_do_periodo($1, $2) as j", [
        data.de,
        data.ate,
      ]);
      return comCapas(tx, r?.j ?? []);
    });
  });

export const resumoSemanaAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: ResumoSemana }>("select social.resumo_semana() as j"),
    );
    return r?.j ?? null;
  });

const FILTRO = z.object({
  situacao: z
    .enum([
      "todos",
      "agendados",
      "publicados",
      "falhas",
      "rascunhos",
      "aprovacao",
      "automacao",
      "cancelados",
    ])
    .default("todos"),
  rede: z
    .enum(["instagram", "facebook", "linkedin", "tiktok", "youtube", "google_business", "teste"])
    .nullable()
    .optional(),
  de: z.string().datetime().nullable().optional(),
  ate: z.string().datetime().nullable().optional(),
  busca: z.string().max(120).optional(),
  limite: z.number().int().min(1).max(200).optional(),
  pular: z.number().int().min(0).max(10000).optional(),
});

export const listarPostsAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) => FILTRO.parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: ListaPosts }>("select social.posts_lista($1::jsonb) as j", [
        JSON.stringify(data),
      ]);
      const j = r?.j ?? { itens: [], total: 0, contagens: {} as ListaPosts["contagens"] };
      return { ...j, itens: await comCapas(tx, j.itens) };
    });
  });

export const carregarPostAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: PostDetalhe | null }>("select social.post($1) as j", [data.id]);
      const p = r?.j ?? null;
      if (!p) return null;
      const { liberarMidias } = await import("@/lib/plataforma/midias.server");
      const lib = await liberarMidias(
        tx,
        p.midias.map((m) => m.id),
      );
      const urls = Object.fromEntries(Object.entries(lib).map(([id, l]) => [id, l.url]));
      const primeira = [...p.midias].sort((a, b) => a.posicao - b.posicao)[0];
      return {
        ...p,
        urls,
        capa:
          primeira && lib[primeira.id]
            ? { url: lib[primeira.id]!.url, mime: lib[primeira.id]!.mime }
            : null,
      } satisfies PostDetalhe;
    });
  });

const DESTINO = z.object({
  conta_id: UUID,
  rede: z.string(),
  formato: z.string().max(20),
  legenda_propria: z.string().max(63206).nullable().optional(),
  opcoes: z
    .record(z.string(), z.union([z.string().max(4000), z.number(), z.boolean(), z.null()]))
    .optional(),
});

/** Valida pelas regras de cada rede (as mesmas do Corretor) e grava. */
export const salvarPostAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .validator((d: unknown) =>
    z
      .object({
        id: UUID.nullable(),
        legenda: z.string().max(63206),
        agendadoPara: z.string().datetime().nullable(),
        destinos: z.array(DESTINO).max(30),
        midias: z
          .array(
            z.object({ id: UUID, mime: z.string(), duracaoMs: z.number().nullable().optional() }),
          )
          .max(35),
        intencao: z.enum(["rascunho", "aprovacao", "agendar"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    for (const x of data.destinos) {
      if (x.opcoes && JSON.stringify(x.opcoes).length > 8000)
        throw new Error("Opções da rede longas demais.");
    }
    if (data.intencao !== "rascunho") {
      const erros = data.destinos.flatMap((x) =>
        REDES[x.rede as Rede]
          ? validarDestino(
              x.rede as Rede,
              x.formato,
              x.legenda_propria ?? data.legenda,
              data.midias,
              x.opcoes ?? {},
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
            opcoes: x.opcoes ?? {},
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
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select social.cancelar_post($1)", [data.id]),
    );
    return { ok: true as const };
  });

export const repetirFalhasAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ n: number }>("select social.repetir_falhas($1) as n", [data.id]),
    );
    return { n: r?.n ?? 0 };
  });

export const duplicarPostAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>("select social.duplicar_post($1) as id", [data.id]),
    );
    return { id: r!.id };
  });

/** Arrastar no calendário: muda a data (o banco recusa o que já começou a sair). */
export const reagendarPostAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .validator((d: unknown) => z.object({ id: UUID, quando: z.string().datetime() }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select social.reagendar_post($1, $2)", [data.id, data.quando]),
    );
    return { ok: true as const };
  });

export const publicarAgoraAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select social.publicar_agora($1)", [data.id]),
    );
    return { ok: true as const };
  });

// ---------------------------------------------------------------------- mídia ---

export const bibliotecaAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) =>
    z
      .object({
        tipo: z.enum(["todos", "foto", "video"]).default("todos"),
        origem: z.enum(["todas", "enviadas", "imoveis"]).default("todas"),
        busca: z.string().max(80).optional(),
        limite: z.number().int().min(1).max(200).optional(),
        pular: z.number().int().min(0).max(10000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: Biblioteca }>("select social.biblioteca($1::jsonb) as j", [
        JSON.stringify(data),
      ]);
      const b = r?.j ?? { itens: [], total: 0, bytes_enviados: 0 };
      const { liberarMidias } = await import("@/lib/plataforma/midias.server");
      const lib = await liberarMidias(
        tx,
        b.itens.map((i) => i.id),
      );
      return { ...b, itens: b.itens.map((i) => ({ ...i, url: lib[i.id]?.url ?? null })) };
    });
  });

export const removerMidiaAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select social.remover_midia($1)", [data.id]),
    );
    return { ok: true as const };
  });

// ----------------------------------------------------------------- relatórios ---

export const relatorioAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) =>
    z.object({ de: z.string().datetime(), ate: z.string().datetime() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: Relatorio }>("select social.relatorio($1, $2) as j", [data.de, data.ate]),
    );
    return r?.j ?? null;
  });

const DIAS = z.object({ dias: z.number().int().min(7).max(365) });

export const relatorioPublicacaoAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) => DIAS.parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: RelatorioPublicacao }>(
        "select social.relatorio_publicacao($1) as j",
        [data.dias],
      );
      const j = r?.j ?? null;
      if (!j) return null;
      const { liberarMidias } = await import("@/lib/plataforma/midias.server");
      const lib = await liberarMidias(
        tx,
        j.posts.map((p) => p.midia),
      );
      return {
        ...j,
        posts: j.posts.map((p) => ({
          ...p,
          capa:
            p.midia && lib[p.midia] ? { url: lib[p.midia]!.url, mime: lib[p.midia]!.mime } : null,
        })),
      };
    });
  });

export const metricasContaAgz = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) => DIAS.parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: MetricasDaConta }>("select social.metricas_da_conta($1) as j", [data.dias]),
    );
    return r?.j ?? { dias: data.dias, contas: [] };
  });

// --------------------------------------------------------- TikTok: creator_info ---

const API_TIKTOK = "https://open.tiktokapis.com/v2";

type CredTiktok = { token: string | null; refresh: string | null; expira_em: string | null };

/** Renova o token do TikTok (vale 24 h) com as chaves do app cadastradas em Provedores. */
async function renovarTiktok(
  refresh: string,
): Promise<{ token: string; refresh: string | null; expira: string }> {
  const { credencialDoSistema } = await ponte();
  const c = await credencialDoSistema("tiktok");
  const chave = c?.segredo?.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY;
  const segredo = c?.segredo?.TIKTOK_CLIENT_SECRET || process.env.TIKTOK_CLIENT_SECRET;
  if (!chave || !segredo)
    throw new Error("As chaves do app do TikTok ainda não foram cadastradas em Provedores.");
  const r = await fetch(`${API_TIKTOK}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: chave,
      client_secret: segredo,
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const j = (await r?.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  if (!r?.ok || !j?.access_token)
    throw new Error("A conexão do TikTok venceu. Reconecte a conta em Automações › Redes.");
  return {
    token: j.access_token,
    refresh: j.refresh_token ?? null,
    expira: new Date(Date.now() + (j.expires_in ?? 86_400) * 1000).toISOString(),
  };
}

/**
 * O que a conta do TikTok permite AGORA (exigência da auditoria do TikTok: a tela de publicar
 * consulta o creator_info na hora). O token é aberto no servidor, só para a conta TikTok da
 * própria plataforma, e nunca volta ao navegador.
 */
export const infoCriadorTiktokAgz = createServerFn({ method: "POST" })
  .middleware([EDITAR])
  .validator((d: unknown) => z.object({ conta: UUID }).parse(d))
  .handler(async ({ data, context }): Promise<InfoCriadorTiktok> => {
    const { comPlataforma } = await ponte();
    const c = await comPlataforma(
      context.userId,
      (tx) =>
        tx.uma<{ c: CredTiktok }>("select social.credencial_para_consulta($1) as c", [data.conta]),
      { kek: true },
    );
    let token = c?.c?.token ?? null;
    if (!token)
      throw new Error("A conta do TikTok está sem autorização. Reconecte em Automações › Redes.");
    const vence = c?.c?.expira_em ? Date.parse(c.c.expira_em) : null;
    if (vence !== null && vence - Date.now() < 5 * 60_000) {
      if (!c?.c?.refresh)
        throw new Error("A conexão do TikTok venceu. Reconecte a conta em Automações › Redes.");
      const novo = await renovarTiktok(c.c.refresh);
      token = novo.token;
      await comPlataforma(
        context.userId,
        (tx) =>
          tx.consultar("select social.guardar_token_renovado($1, $2, $3, $4)", [
            data.conta,
            novo.token,
            novo.refresh,
            novo.expira,
          ]),
        { kek: true },
      );
    }
    const r = await fetch(`${API_TIKTOK}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as {
      data?: {
        creator_nickname?: string;
        creator_username?: string;
        creator_avatar_url?: string;
        privacy_level_options?: string[];
        comment_disabled?: boolean;
        duet_disabled?: boolean;
        stitch_disabled?: boolean;
        max_video_post_duration_sec?: number;
      };
      error?: { code?: string; message?: string };
    } | null;
    const codigo = j?.error?.code;
    if (!r || !j) throw new Error("O TikTok não respondeu agora. Tente de novo em instantes.");
    if (codigo === "access_token_invalid" || codigo === "scope_not_authorized")
      throw new Error(
        "O servidor renova a conexão do TikTok automaticamente; tente em alguns minutos ou reconecte a conta em Automações › Redes.",
      );
    if (codigo === "spam_risk_too_many_posts" || codigo === "reached_active_user_cap")
      throw new Error("A conta do TikTok atingiu o limite de posts por agora. Tente mais tarde.");
    if (!r.ok || (codigo && codigo !== "ok"))
      throw new Error("O TikTok recusou a consulta da conta. Tente de novo em instantes.");
    const d = j.data ?? {};
    return {
      apelido: d.creator_nickname ?? null,
      usuario: d.creator_username ?? null,
      avatar: d.creator_avatar_url ?? null,
      privacidades: (d.privacy_level_options ?? []).filter((p) => typeof p === "string"),
      comentarioDesativado: Boolean(d.comment_disabled),
      duetoDesativado: Boolean(d.duet_disabled),
      costuraDesativada: Boolean(d.stitch_disabled),
      duracaoMaximaS:
        typeof d.max_video_post_duration_sec === "number" ? d.max_video_post_duration_sec : null,
    };
  });

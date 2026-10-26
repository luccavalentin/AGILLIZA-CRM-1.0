/**
 * Marketplace de especialistas do Agilliza Tech, moderado pelo Agilliza correspondente.
 *
 * É a antiga tela "Marketplace (moderação)" da Gestão (`/gestao/especialistas` e
 * `/gestao/especialistas/metricas`). Duas portas: a permissão do Agilliza
 * (`saas.marketplace`, aqui) e a da plataforma (`marketplace.moderar`, no banco, pela
 * ponte). As consultas e as atualizações são as MESMAS da Gestão:
 *   · perfis e avaliações: leitura direta (política `extra_moderar`/`extra_ler`, 0017);
 *   · carteira: `ecossistema.carteira_de_anunciantes` (0065);
 *   · métricas: `ecossistema.metricas_anuncios_*` (0093) — o mesmo painel do anunciante.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { Json } from "@/integrations/supabase/types";

export type StatusEspecialista = "rascunho" | "em_analise" | "aprovado" | "recusado" | "suspenso";
export type ModeracaoAvaliacao = "publicada" | "em_revisao" | "removida";
export type CorteMetricas = "dia" | "semana" | "mes" | "ano";

export interface PerfilEspecialista {
  id: string;
  tenant_id: string;
  nome: string;
  slug: string;
  apresentacao: string | null;
  categorias: string[] | null;
  especialidades: string[] | null;
  /** No banco é `[{ uf, cidades[] }]` (jsonb), às vezes texto solto. */
  regioes: Json;
  registro_tipo: string | null;
  registro_numero: string | null;
  registro_uf: string | null;
  registro_validade: string | null;
  status: string;
  motivo_status: string | null;
  plano_codigo: string | null;
  nota_media: number | null;
  total_avaliacoes: number;
  publicado: boolean;
  oculto_inadimplencia: boolean;
  criado_em: string;
  aprovado_em: string | null;
  chamada: string | null;
  conta: string | null;
  aprovador: string | null;
  /** Endereços selados (1 h) da foto e da capa do anúncio, quando existem. */
  foto_url: string | null;
  capa_url: string | null;
}

export interface AvaliacaoMarketplace {
  id: string;
  especialista_id: string;
  nota: number;
  comentario: string | null;
  resposta: string | null;
  moderacao: string;
  criado_em: string;
  especialista: string | null;
}

export interface Anunciante {
  id: string;
  tenant_id: string;
  nome: string;
  conta: string | null;
  status: string;
  publicado: boolean;
  oculto_inadimplencia: boolean;
  plano_codigo: string | null;
  plano: string | null;
  mensalidade: number | null;
  assinatura_status: string | null;
  categorias: string[] | null;
  impressoes: number;
  cliques: number;
  conversoes: number;
  pessoas: number;
  nota_media: number | null;
  total_avaliacoes: number;
}

export interface CategoriaMarketplace {
  id: string;
  nome: string;
}

export interface LinhaAnunciante {
  especialista_id: string;
  nome: string;
  conta: string | null;
  categorias: string[] | null;
  status: string;
  no_ar: boolean;
  impressoes: number;
  visualizacoes: number;
  cliques: number;
  conversoes: number;
}

export interface PontoSerie {
  periodo: string;
  impressoes: number;
  visualizacoes: number;
  cliques: number;
  conversoes: number;
  pessoas: number | null;
}

export interface LinhaCanal {
  canal: string;
  cliques: number;
  conversoes: number;
}

/** Janela da carteira. Trinta dias é o ciclo da mensalidade (a mesma da Gestão). */
export const DIAS_CARTEIRA = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

async function ponte() {
  return import("./ponte.server");
}

/** Perfis, avaliações e a carteira de anunciantes (últimos 30 dias). */
export const lerModeracaoMarketplace = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.marketplace", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const perfis = await tx.consultar<PerfilEspecialista>(
        `select e.id, e.tenant_id, e.nome, e.slug::text as slug, e.apresentacao, e.categorias, e.especialidades,
                e.regioes, e.registro_tipo, e.registro_numero, e.registro_uf,
                e.registro_validade::text as registro_validade,
                e.status::text as status, e.motivo_status, e.plano_codigo::text as plano_codigo,
                e.nota_media::float8 as nota_media, e.total_avaliacoes::int as total_avaliacoes,
                e.publicado, e.oculto_inadimplencia, e.criado_em::text as criado_em,
                e.aprovado_em::text as aprovado_em, e.chamada,
                (select t.nome from nucleo.tenants t where t.id = e.tenant_id) as conta,
                (select u.nome from plataforma.usuarios(array[e.aprovado_por]) u) as aprovador,
                e.foto_midia_id::text as foto_url, e.capa_midia_id::text as capa_url
           from ecossistema.especialistas e
          where e.deleted_at is null
          order by (e.status = 'em_analise') desc, e.criado_em desc
          limit 200`,
      );

      // Foto e capa: a consulta acima traz os ids; aqui viram endereços selados, liberados
      // pela RLS de `integracao.midias` com o contexto de quem modera.
      const { liberarMidias } = await import("./midias.server");
      const imagens = await liberarMidias(
        tx,
        perfis.flatMap((p) => [p.foto_url, p.capa_url]),
      );
      for (const p of perfis) {
        p.foto_url = p.foto_url ? (imagens[p.foto_url]?.url ?? null) : null;
        p.capa_url = p.capa_url ? (imagens[p.capa_url]?.url ?? null) : null;
      }

      const avaliacoes = await tx.consultar<AvaliacaoMarketplace>(
        `select a.id, a.especialista_id, a.nota::int as nota, a.comentario, a.resposta,
                a.moderacao::text as moderacao, a.criado_em::text as criado_em,
                (select e.nome from ecossistema.especialistas e where e.id = a.especialista_id) as especialista
           from ecossistema.avaliacoes a
          order by (a.moderacao = 'em_revisao') desc, a.criado_em desc
          limit 100`,
      );

      // A carteira vem por função: junta anúncio, eventos (tabela fechada) e assinatura,
      // que é de outra tenência — nada disso se lê junto por RLS.
      const carteira = await tx.consultar<Anunciante>(
        `select id, tenant_id, nome, conta, status::text as status, publicado, oculto_inadimplencia,
                plano_codigo::text as plano_codigo, plano, mensalidade::float8 as mensalidade,
                assinatura_status::text as assinatura_status, categorias,
                impressoes::int as impressoes, cliques::int as cliques,
                conversoes::int as conversoes, pessoas::int as pessoas,
                nota_media::float8 as nota_media, total_avaliacoes::int as total_avaliacoes
           from ecossistema.carteira_de_anunciantes($1)`,
        [DIAS_CARTEIRA],
      );

      return { perfis, avaliacoes, carteira, dias: DIAS_CARTEIRA };
    });
  });

export type DecisaoEspecialista = "aprovar" | "nao_aprovar" | "suspender";

export interface DecisaoRegistrada {
  id: string;
  especialista_id: string;
  especialista: string;
  decisao: DecisaoEspecialista;
  status_antes: string | null;
  motivo: string | null;
  moderador: string | null;
  criado_em: string;
}

/**
 * Aprovar ou Não aprovar (e Suspender quem já está no ar), pela função da moderação
 * (0310 do Agilliza Tech): motivo obrigatório ao não aprovar ou suspender — ele vai para o
 * especialista —, histórico de cada decisão e aviso ao dono da conta.
 */
export const decidirEspecialista = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.marketplace", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().regex(UUID, "Especialista inválido."),
        decisao: z.enum(["aprovar", "nao_aprovar", "suspender"], { message: "Decisão inválida." }),
        motivo: z.string().trim().max(1000, "O motivo vai até 1000 letras.").default(""),
      })
      .superRefine((v, ctx) => {
        if (v.decisao !== "aprovar" && v.motivo.length < 10) {
          ctx.addIssue({
            code: "custom",
            path: ["motivo"],
            message: "Escreva o motivo (pelo menos 10 letras): ele vai para o especialista.",
          });
        }
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: { nome: string; status: string } }>(
        "select ecossistema.decidir_especialista($1, $2, $3) as r",
        [data.id, data.decisao, data.motivo || null],
      ),
    );
    if (!r?.r) throw new Error("Especialista não encontrado.");
    return r.r;
  });

/** Histórico das decisões (de um especialista, ou as últimas de todos). */
export const lerDecisoesMarketplace = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.marketplace", "view"])])
  .inputValidator((d: unknown) =>
    z.object({ especialista: z.string().regex(UUID).optional().nullable() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: DecisaoRegistrada[] }>("select ecossistema.decisoes_especialistas($1, 200) as j", [
        data.especialista ?? null,
      ]),
    );
    return r?.j ?? [];
  });

/** Publica de novo ou tira da vitrine uma avaliação (sem apagar; a nota é recalculada). */
export const moderarAvaliacao = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.marketplace", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().regex(UUID, "Avaliação inválida."),
        moderacao: z.enum(["publicada", "em_revisao", "removida"], {
          message: "Estado inválido.",
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        "update ecossistema.avaliacoes set moderacao = $2 where id = $1 returning id",
        [data.id, data.moderacao],
      ),
    );
    if (!r) throw new Error("Avaliação não encontrada.");
    return { ok: true as const };
  });

/**
 * Métricas do marketplace por período: o mesmo painel que o anunciante vê, sobre a
 * carteira inteira, uma profissão ou um anunciante só. O banco decide o que cada um vê.
 */
export const lerMetricasMarketplace = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.marketplace", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        de: z.string().regex(DATA, "Data inicial inválida."),
        ate: z.string().regex(DATA, "Data final inválida."),
        corte: z.enum(["dia", "semana", "mes", "ano"]),
        profissao: z.string().trim().max(120).optional().nullable(),
        anunciante: z.string().regex(UUID).optional().nullable(),
      })
      .refine((v) => v.de <= v.ate, { message: "A data inicial vem antes da final." })
      .refine(
        (v) =>
          (Date.parse(`${v.ate}T00:00:00Z`) - Date.parse(`${v.de}T00:00:00Z`)) / 86_400_000 <= 3660,
        { message: "O período vai até 10 anos." },
      )
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const categorias = await tx.consultar<CategoriaMarketplace>(
        "select id::text as id, nome from ecossistema.categorias where ativa order by ordem, nome",
      );
      const categoria = categorias.some((c) => c.id === data.profissao) ? data.profissao! : null;

      const anunciantes = await tx.consultar<LinhaAnunciante>(
        `select especialista_id, nome, conta, categorias, status::text as status, no_ar,
                impressoes::int as impressoes, visualizacoes::int as visualizacoes,
                cliques::int as cliques, conversoes::int as conversoes
           from ecossistema.metricas_anuncios_por_anunciante($1::date, $2::date, $3)`,
        [data.de, data.ate, categoria],
      );
      // O anunciante escolhido sai da mesma lista: id que não está nela (de outra
      // profissão) cai no marketplace inteiro, como na Gestão.
      const escolhido = data.anunciante
        ? (anunciantes.find((a) => a.especialista_id === data.anunciante) ?? null)
        : null;
      const especialista = escolhido?.especialista_id ?? null;

      const serie = await tx.consultar<PontoSerie>(
        `select periodo::text as periodo, impressoes::int as impressoes, visualizacoes::int as visualizacoes,
                cliques::int as cliques, conversoes::int as conversoes, pessoas::int as pessoas
           from ecossistema.metricas_anuncios_serie($1::date, $2::date, $3, $4::uuid, $5)`,
        [data.de, data.ate, data.corte, especialista, categoria],
      );
      const canais = await tx.consultar<LinhaCanal>(
        `select canal, cliques::int as cliques, conversoes::int as conversoes
           from ecossistema.metricas_anuncios_canais($1::date, $2::date, $3::uuid, $4)`,
        [data.de, data.ate, especialista, categoria],
      );

      return { categorias, categoria, anunciantes, escolhido, serie, canais };
    });
  });

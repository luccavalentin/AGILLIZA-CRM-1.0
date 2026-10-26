/**
 * Curadoria da Agilliza News (o "Radar" que corretores e imobiliárias leem no Agilliza Tech).
 *
 * Mesmas consultas da antiga Gestão (`apps/web/src/app/[portal]/radar/curadoria*.ts(x)`,
 * `news-acoes.ts`). Quem pode o quê é decidido no banco: as políticas `extra_curar` de
 * `radar.noticias`/`radar.posts` e a RLS global de `radar.fontes`/`radar.indicadores` exigem
 * a permissão de plataforma `radar.curar`, que a ponte dá a quem tem o módulo `saas.news`
 * (0181). Aqui só se barra o que é lixo evidente, para a mensagem de erro ser útil.
 *
 * Matéria de terceiro nunca é copiada: guardamos a URL, um título e uma chamada próprios.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const STATUS_NOTICIA = [
  "coletada",
  "resumida",
  "em_revisao",
  "aprovada",
  "publicada",
  "descartada",
] as const;
export type StatusNoticia = (typeof STATUS_NOTICIA)[number];

export interface NoticiaCuradoria {
  id: string;
  titulo: string | null;
  titulo_original: string;
  resumo: string | null;
  categoria: string | null;
  url_original: string;
  status: string;
  fixada: boolean;
  tempo_leitura_min: number | null;
  publicada_na_fonte_em: string | null;
  publicado_em: string | null;
  criado_em: string;
  fonte: string | null;
  revisor: string | null;
  imagem_url: string | null;
  publico: PublicoNews;
  inicio_em: string | null;
  fim_em: string | null;
}

/** Quem vê: todo o ecossistema, só assinantes (Agilliza Tech) ou só a equipe do Agilliza. */
export type PublicoNews = "todos" | "assinantes" | "equipe";
export const PUBLICOS_NEWS: { id: PublicoNews; nome: string }[] = [
  { id: "todos", nome: "Todos os usuários do ecossistema" },
  { id: "assinantes", nome: "Só assinantes (Agilliza Tech)" },
  { id: "equipe", nome: "Só a equipe do Agilliza" },
];

export interface FonteNews {
  id: string;
  nome: string;
  url_rss: string;
  categoria: string | null;
  ativa: boolean;
  erro: string | null;
  ultima_coleta_em: string | null;
  noticias: number;
  intervalo_min: number;
  proxima_coleta_em: string | null;
  ultimo_sucesso_em: string | null;
  falhas_seguidas: number;
  itens_ultima_coleta: number | null;
  novos_ultima_coleta: number | null;
  coletando_desde: string | null;
}

export interface ColetaNews {
  id: string;
  fonte_id: string;
  fonte: string;
  origem: "agenda" | "manual";
  iniciada_em: string;
  terminada_em: string | null;
  ok: boolean | null;
  itens: number | null;
  novos: number | null;
  erro: string | null;
}

export interface IndicadorNews {
  codigo: string;
  nome: string;
  serie_sgs: number;
  unidade: string;
  periodicidade: string;
  descricao: string | null;
  usado_reajuste: boolean;
  ativo: boolean;
  atualizado_em: string | null;
  pontos: number;
  ultima_data: string | null;
}

export interface CategoriaNews {
  id: string;
  nome: string;
}

export interface PostNews {
  id: string;
  titulo: string;
  corpo: string;
  categoria: string;
  status: string;
  fixado: boolean;
  tem_capa: boolean;
  capa_midia_id: string | null;
  /** Endereço selado da capa (1 h), só para quem pode vê-la. */
  capa_url: string | null;
  tempo_leitura_min: number | null;
  publicado_em: string | null;
  atualizado_em: string;
  autor: string | null;
  resumo: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  publico: PublicoNews;
  formato: "texto" | "markdown";
  origem: "news" | "base_conhecimento";
}

/** Um item do feed como o leitor vê, com a reação contada (audiência). */
export interface ItemFeedNews {
  id: string;
  tipo: "noticia" | "post";
  titulo: string | null;
  categoria_nome: string | null;
  fonte: string | null;
  url_externa: string | null;
  externa: boolean;
  fixado: boolean;
  publicado_em: string | null;
  curtidas: number;
  comentarios: number;
  publico: PublicoNews;
  fim_em: string | null;
}

export interface ComentarioNews {
  id: string;
  corpo: string;
  autor: string | null;
  meu: boolean;
  oculto: boolean;
  editado: boolean;
  criado_em: string;
}

const UUID = z.string().uuid("Identificador inválido.");
const TIPO_ITEM = z.enum(["noticia", "post"], {
  errorMap: () => ({ message: "Item inválido." }),
});
const PUBLICO = z.enum(["todos", "assinantes", "equipe"], {
  errorMap: () => ({ message: "Público inválido." }),
});
const DATA_HORA = z
  .string()
  .datetime({ offset: true, message: "Data inválida." })
  .nullable()
  .optional();

/** Janela de exibição: início (opcional) e fim por data ou por "dias no ar". */
function janela(d: { inicio_em?: string | null; fim_em?: string | null; dias?: number | null }) {
  const inicio = d.inicio_em ? new Date(d.inicio_em) : null;
  let fim = d.fim_em ? new Date(d.fim_em) : null;
  if (!fim && d.dias) {
    if (!Number.isInteger(d.dias) || d.dias < 1 || d.dias > 365) throw new Error("Dias no ar: de 1 a 365.");
    fim = new Date((inicio ?? new Date()).getTime() + d.dias * 86_400_000);
  }
  if (fim && fim.getTime() <= (inicio ?? new Date()).getTime()) {
    throw new Error("A data de fim precisa ser depois do início (e no futuro).");
  }
  return { inicio: inicio?.toISOString() ?? null, fim: fim?.toISOString() ?? null };
}

/** Tudo o que a tela de curadoria mostra, numa transação só. */
export const lerCuradoriaNews = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.news", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      const noticias = await tx.consultar<NoticiaCuradoria>(
        `select n.id, n.titulo, n.titulo_original, n.resumo, n.categoria, n.url_original, n.status,
                n.fixada, n.tempo_leitura_min::int as tempo_leitura_min,
                n.publicada_na_fonte_em::text as publicada_na_fonte_em,
                n.publicado_em::text as publicado_em, n.criado_em::text as criado_em,
                (select f.nome from radar.fontes f where f.id = n.fonte_id) as fonte,
                (select u.nome from plataforma.usuarios(array[n.revisado_por]) u) as revisor,
                n.imagem_url, n.publico, n.inicio_em::text as inicio_em, n.fim_em::text as fim_em
           from radar.noticias n
          order by (n.status not in ('publicada', 'descartada')) desc, n.criado_em desc
          limit 200`,
      );
      // Os cartões contam tudo; a lista acima para nas 200 mais recentes (fila primeiro).
      const contagem = await tx.uma<{ na_fila: number; publicadas: number }>(
        `select (count(*) filter (where status not in ('publicada', 'descartada')))::int as na_fila,
                (count(*) filter (where status = 'publicada'))::int as publicadas
           from radar.noticias`,
      );

      const fontes = await tx.consultar<FonteNews>(
        `select f.id, f.nome, f.url_rss, f.categoria, f.ativa, f.erro,
                f.ultima_coleta_em::text as ultima_coleta_em,
                (select count(*) from radar.noticias n where n.fonte_id = f.id)::int as noticias,
                f.intervalo_min, f.proxima_coleta_em::text as proxima_coleta_em,
                f.ultimo_sucesso_em::text as ultimo_sucesso_em, f.falhas_seguidas,
                f.itens_ultima_coleta, f.novos_ultima_coleta, f.coletando_desde::text as coletando_desde
           from radar.fontes f
          order by (f.url_rss is null), f.nome`,
      );
      const coletas = await tx.consultar<ColetaNews>(
        `select id, fonte_id, fonte, origem, iniciada_em::text as iniciada_em,
                terminada_em::text as terminada_em, ok, itens, novos, erro
           from radar.coletas_recentes(null, 40)`,
      );

      const indicadores = await tx.consultar<IndicadorNews>(
        `select i.codigo, i.nome, i.serie_sgs::int as serie_sgs, i.unidade, i.periodicidade,
                i.descricao, i.usado_reajuste, i.ativo, i.atualizado_em::text as atualizado_em,
                (select count(*) from radar.indicador_valores v where v.indicador = i.codigo)::int as pontos,
                (select max(v.data)::text from radar.indicador_valores v where v.indicador = i.codigo) as ultima_data
           from radar.indicadores i order by i.nome`,
      );

      const categorias = await tx.consultar<CategoriaNews>(
        "select id, nome from radar.categorias where ativa order by ordem, nome",
      );

      // Publicações próprias (inclusive rascunhos, que só a curadoria enxerga pela RLS).
      const posts = await tx.consultar<PostNews>(
        `select p.id, p.titulo, p.corpo, p.categoria, p.status, p.fixado,
                (p.capa_midia_id is not null) as tem_capa, p.capa_midia_id, null::text as capa_url,
                p.tempo_leitura_min::int as tempo_leitura_min,
                p.publicado_em::text as publicado_em, p.atualizado_em::text as atualizado_em,
                (select u.nome from plataforma.usuarios(array[p.autor_id]) u) as autor,
                p.resumo, p.inicio_em::text as inicio_em, p.fim_em::text as fim_em, p.publico,
                p.formato, p.origem
           from radar.posts p
          order by (p.status = 'rascunho') desc, coalesce(p.publicado_em, p.criado_em) desc
          limit 100`,
      );

      const { liberarMidias } = await import("./midias.server");
      const capas = await liberarMidias(
        tx,
        posts.map((p) => p.capa_midia_id),
      );
      for (const p of posts)
        p.capa_url = p.capa_midia_id ? (capas[p.capa_midia_id]?.url ?? null) : null;

      // O que está no ar, com curtidas e comentários contados pela mesma função do leitor.
      const feed = await tx.consultar<ItemFeedNews>(
        `select id, tipo, titulo, categoria_nome, fonte, url_externa, externa, fixado,
                publicado_em::text as publicado_em, curtidas::int as curtidas,
                comentarios::int as comentarios, publico, fim_em::text as fim_em
           from radar.feed(null, null, 120)`,
      );

      return {
        noticias,
        contagem: contagem ?? { na_fila: 0, publicadas: 0 },
        fontes,
        coletas,
        indicadores,
        categorias,
        posts,
        feed,
      };
    });
  });

/** Curar uma notícia coletada: título e resumo próprios, categoria, destaque e situação. */
export const curarNoticia = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: UUID,
        titulo: z.string().max(300).default(""),
        resumo: z.string().max(2000).default(""),
        categoria: z.string().max(60).default(""),
        tempoLeitura: z.union([z.string(), z.number(), z.null()]).optional(),
        fixada: z.boolean(),
        status: z.enum(STATUS_NOTICIA, { errorMap: () => ({ message: "Situação inválida." }) }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const titulo = data.titulo.trim();
    const resumo = data.resumo.trim();
    if (data.status === "publicada" && (titulo.length < 8 || resumo.length < 20)) {
      throw new Error(
        "Publicar exige título próprio e um resumo de pelo menos 20 caracteres — é isso que o corretor lê.",
      );
    }
    const minutos =
      data.tempoLeitura === "" || data.tempoLeitura == null
        ? null
        : Math.trunc(Number(data.tempoLeitura));
    if (minutos != null && (!Number.isFinite(minutos) || minutos < 1 || minutos > 60)) {
      throw new Error("Tempo de leitura fora da faixa (1 a 60 minutos).");
    }
    const slug = titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90);

    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        `update radar.noticias
            set titulo = nullif($2, ''), slug = nullif($3, ''), resumo = nullif($4, ''),
                categoria = nullif($5, ''), tempo_leitura_min = $6, fixada = $7, status = $8,
                revisado_por = seguranca.auth_usuario_id(),
                publicado_em = case when $8 = 'publicada' then coalesce(publicado_em, now()) else null end
          where id = $1 returning id`,
        [data.id, titulo, slug, resumo, data.categoria, minutos, data.fixada, data.status],
      ),
    );
    if (!r) throw new Error("Notícia não encontrada (ou o banco recusou a alteração).");
    return {
      ok: true as const,
      mensagem: data.status === "publicada" ? "Notícia publicada na News." : "Notícia salva.",
    };
  });

export const alternarFonteNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: UUID, ativa: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ nome: string }>("update radar.fontes set ativa = $2 where id = $1 returning nome", [
        data.id,
        data.ativa,
      ]),
    );
    if (!r) throw new Error("Fonte não encontrada.");
    return { ok: true as const, mensagem: `${r.nome} ${data.ativa ? "ativada" : "desativada"}.` };
  });

export const alternarIndicadorNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        codigo: z.string().regex(/^[a-z_]{2,30}$/, "Indicador inválido."),
        ativo: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ nome: string }>(
        "update radar.indicadores set ativo = $2 where codigo = $1 returning nome",
        [data.codigo, data.ativo],
      ),
    );
    if (!r) throw new Error("Indicador não encontrado.");
    return { ok: true as const, mensagem: `${r.nome} ${data.ativo ? "ativado" : "desativado"}.` };
  });

/**
 * Apontar uma matéria de um portal: guarda URL, título, chamada e o ENDEREÇO da imagem de
 * pré-visualização — nunca o texto. Ela abre na página do veículo. Agenda (início/fim ou
 * dias no ar), público e destaque como os posts.
 */
export const apontarMateria = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        url: z.string().max(1000),
        titulo: z.string().max(300),
        resumo: z.string().max(1000).default(""),
        categoria: z.string().min(1, "Escolha a categoria.").max(60),
        fonte: z.string().max(120).default(""),
        imagem_url: z.string().max(1000).nullable().optional(),
        publico: PUBLICO.default("todos"),
        fixada: z.boolean().default(false),
        inicio_em: DATA_HORA,
        fim_em: DATA_HORA,
        dias: z.number().int().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const url = data.url.trim();
    if (!/^https?:\/\/[\w.-]+\.[a-z]{2,}(:\d+)?(\/|$|\?)/i.test(url)) {
      throw new Error("Informe o endereço completo da matéria, começando com https:// (ou http://).");
    }
    if (data.titulo.trim().length < 10) {
      throw new Error("O título precisa de pelo menos 10 caracteres.");
    }
    const imagem = data.imagem_url?.trim() || null;
    if (imagem && !/^https:\/\/[^\s]+$/.test(imagem)) throw new Error("A imagem precisa ser um endereço https://.");
    const { inicio, fim } = janela(data);
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, (tx) =>
      tx.consultar(
        `insert into radar.noticias
           (fonte_id, url_original, titulo_original, titulo, slug, resumo, categoria, status,
            publicado_em, revisado_por, tempo_leitura_min, imagem_url, publico, fixada, inicio_em, fim_em)
         values (radar.fonte_por_nome($5, $4), $1, $2, $2,
                 nucleo.slug_unico('radar.noticias', $2), $3, $4, 'publicada',
                 now(), seguranca.auth_usuario_id(), 3, $6, $7, $8, $9::timestamptz, $10::timestamptz)`,
        [
          url,
          data.titulo.trim(),
          data.resumo.trim() || null,
          data.categoria,
          data.fonte.trim() || null,
          imagem,
          data.publico,
          data.fixada,
          inicio,
          fim,
        ],
      ),
    );
    return {
      ok: true as const,
      mensagem: inicio && new Date(inicio) > new Date() ? "Matéria agendada." : "Matéria no ar. Ela abre na página do veículo.",
    };
  });

/** Pré-visualização de um link (título, descrição, imagem, veículo) buscada pelo servidor. */
export const previaLinkNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) => z.object({ url: z.string().min(8).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const { buscarPrevia, RecusaLink } = await import("./previa-link.server");
    try {
      return await buscarPrevia(data.url);
    } catch (e) {
      if (e instanceof RecusaLink) throw new Error(e.message);
      console.error("[previaLinkNews]", (e as Error)?.message);
      throw new Error("Não foi possível ler este endereço.");
    }
  });

/**
 * Publicar (ou salvar como rascunho) conteúdo próprio da Agilliza — abre dentro do sistema.
 *
 * Capa: a imagem sobe antes por `enviarCapaNews` (armazenamento do Corretor, ponte de
 * arquivos) e chega aqui pelo id. `capaMidiaId` ausente mantém a capa atual; `null` tira.
 * A capa trocada sai do ar com o post (mesma regra da Gestão).
 */
export const publicarPost = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: UUID.nullable().optional(),
        titulo: z.string().max(300),
        corpo: z.string().max(60000),
        categoria: z.string().min(1, "Escolha a categoria.").max(60),
        publicar: z.boolean(),
        capaMidiaId: UUID.nullable().optional(),
        resumo: z.string().max(400).default(""),
        publico: PUBLICO.default("todos"),
        fixado: z.boolean().default(false),
        formato: z.enum(["texto", "markdown"]).default("markdown"),
        inicio_em: DATA_HORA,
        fim_em: DATA_HORA,
        dias: z.number().int().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.titulo.trim().length < 10) {
      throw new Error("O título precisa de pelo menos 10 caracteres.");
    }
    if (data.corpo.trim().length < 80) {
      throw new Error(
        "O texto precisa de pelo menos 80 caracteres — menos que isso é uma chamada, não uma publicação.",
      );
    }
    const { minutosDeLeitura } = await import("@/lib/conhecimento/markdown");
    const minutos = Math.min(60, minutosDeLeitura(data.corpo));
    const status = data.publicar ? "publicado" : "rascunho";
    const { inicio, fim } = janela(data);
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, async (tx) => {
      if (data.id) {
        const antes = await tx.uma<{ capa_midia_id: string | null }>(
          "select capa_midia_id from radar.posts where id = $1",
          [data.id],
        );
        if (!antes) throw new Error("Publicação não encontrada.");
        await tx.consultar(
          `update radar.posts
              set titulo = $2, corpo = $3, categoria = $4, tempo_leitura_min = $5,
                  status = $6, publicado_em = case when $6 = 'publicado' then coalesce(publicado_em, now()) end,
                  capa_midia_id = $7::uuid, resumo = nullif($8, ''), publico = $9, fixado = $10,
                  formato = $11, inicio_em = $12::timestamptz, fim_em = $13::timestamptz,
                  editado_em = now(), editado_por = seguranca.auth_usuario_id(), atualizado_em = now()
            where id = $1`,
          [
            data.id,
            data.titulo.trim(),
            data.corpo.trim(),
            data.categoria,
            minutos,
            status,
            data.capaMidiaId === undefined ? antes.capa_midia_id : data.capaMidiaId,
            data.resumo.trim(),
            data.publico,
            data.fixado,
            data.formato,
            inicio,
            fim,
          ],
        );
        if (
          antes.capa_midia_id &&
          data.capaMidiaId !== undefined &&
          data.capaMidiaId !== antes.capa_midia_id
        ) {
          await tx.consultar(
            "update integracao.midias set deleted_at = now() where id = $1 and entidade = 'radar_post'",
            [antes.capa_midia_id],
          );
        }
        return;
      }
      await tx.consultar(
        `insert into radar.posts
           (autor_id, titulo, slug, corpo, categoria, tempo_leitura_min, status, publicado_em, capa_midia_id,
            resumo, publico, fixado, formato, inicio_em, fim_em)
         values (seguranca.auth_usuario_id(), $1, nucleo.slug_unico('radar.posts', $1), $2, $3, $4, $5,
                 case when $5 = 'publicado' then now() end, $6::uuid, nullif($7, ''), $8, $9, $10,
                 $11::timestamptz, $12::timestamptz)`,
        [
          data.titulo.trim(),
          data.corpo.trim(),
          data.categoria,
          minutos,
          status,
          data.capaMidiaId ?? null,
          data.resumo.trim(),
          data.publico,
          data.fixado,
          data.formato,
          inicio,
          fim,
        ],
      );
    });
    return {
      ok: true as const,
      mensagem: !data.publicar
        ? "Rascunho salvo."
        : inicio && new Date(inicio) > new Date()
          ? "Publicação agendada."
          : "Publicado.",
    };
  });

/** Tirar do ar agora: post vai para "arquivado"; matéria apontada ganha fim imediato. */
export const tirarDoArNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) => z.object({ tipo: TIPO_ITEM, id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      data.tipo === "post"
        ? tx.uma<{ id: string }>(
            "update radar.posts set status = 'arquivado', atualizado_em = now() where id = $1 returning id",
            [data.id],
          )
        : tx.uma<{ id: string }>(
            "update radar.noticias set fim_em = now() where id = $1 and status = 'publicada' returning id",
            [data.id],
          ),
    );
    if (!r) throw new Error("Item não encontrado.");
    return { ok: true as const, mensagem: "Saiu do ar." };
  });

/* ─────────────── Fontes e coletor de RSS (0338) ─────────────── */

export const salvarFonteNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: UUID.nullable().optional(),
        nome: z.string().max(120),
        url: z.string().max(500),
        categoria: z.string().min(1, "Escolha a categoria.").max(60),
        intervalo_min: z.number().int().min(15, "Mínimo de 15 minutos.").max(1440, "Máximo de 24 horas."),
        ativa: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, (tx) =>
      tx.uma("select radar.salvar_fonte($1, $2, $3, $4, $5, $6) as id", [
        data.id ?? null,
        data.nome.trim(),
        data.url.trim(),
        data.categoria,
        data.intervalo_min,
        data.ativa,
      ]),
    );
    return { ok: true as const, mensagem: data.id ? "Fonte atualizada." : "Fonte cadastrada. A primeira coleta sai em instantes." };
  });

export const removerFonteNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: string }>("select radar.remover_fonte($1) as r", [data.id]),
    );
    return {
      ok: true as const,
      mensagem:
        r?.r === "mantida_como_veiculo"
          ? "Fonte retirada do coletor. Ela continua como veículo das matérias já publicadas."
          : "Fonte removida.",
    };
  });

/** "Coletar agora": uma fonte ou todas. O worker é acordado pelo outbox. */
export const coletarAgoraNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: UUID.nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ n: number }>("select radar.pedir_coleta($1) as n", [data.id ?? null]),
    );
    const n = Number(r?.n ?? 0);
    if (!n) throw new Error("Nenhuma fonte ativa com RSS para coletar.");
    return {
      ok: true as const,
      mensagem: n === 1 ? "Coleta pedida. O resultado aparece aqui em instantes." : `Coleta de ${n} fontes pedida.`,
    };
  });

/* ─────────────── Métricas estilo Ads (0340) ─────────────── */

export interface MetricasNews {
  periodo: { inicio: string; fim: string };
  totais: {
    impressoes: number;
    alcance: number;
    leitores: number;
    leituras: number;
    cliques: number;
    aberturas: number;
    ctr: number;
    compartilhamentos: number;
    tempo_medio_s: number | null;
    curtidas: number;
    comentarios: number;
  };
  compartilhamentos_por_canal: Partial<Record<"whatsapp" | "link" | "email" | "nativo", number>>;
  serie: Array<{ dia: string; impressoes: number; aberturas: number; compartilhamentos: number; alcance: number }>;
  por_portal: Array<{ portal: string; impressoes: number; aberturas: number; alcance: number }>;
  por_perfil: Array<{ perfil: string; impressoes: number; aberturas: number; alcance: number }>;
  ranking: Array<{
    item_tipo: "noticia" | "post";
    item_id: string;
    titulo: string | null;
    publico: string | null;
    impressoes: number;
    alcance: number;
    leituras: number;
    cliques: number;
    ctr: number;
    compartilhamentos: number;
    tempo_medio_s: number | null;
    curtidas: number;
    comentarios: number;
  }>;
}

export const lerMetricasNews = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.news", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
        fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
        item_tipo: TIPO_ITEM.nullable().optional(),
        item_id: UUID.nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MetricasNews> => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ m: MetricasNews }>("select radar.metricas($1::date, $2::date, $3, $4) as m", [
        data.inicio,
        data.fim,
        data.item_tipo ?? null,
        data.item_id ?? null,
      ]),
    );
    if (!r?.m) throw new Error("Não foi possível calcular as métricas.");
    return r.m;
  });

/* ─────────────── News da equipe do Agilliza (público todos/equipe) ─────────────── */

export interface ItemNewsEquipe {
  id: string;
  tipo: "noticia" | "post";
  titulo: string | null;
  resumo: string | null;
  categoria_nome: string | null;
  url_externa: string | null;
  fonte: string | null;
  externa: boolean;
  fixado: boolean;
  tempo_leitura_min: number | null;
  publicado_em: string | null;
  imagem_url: string | null;
  corpo: string | null;
  formato: "texto" | "markdown" | null;
}

/** O feed para quem trabalha no Agilliza (o banco confere que a pessoa é da equipe). */
export const lerNewsDaEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limite: z.number().int().min(1).max(60).default(20) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<ItemNewsEquipe[]> => {
    const { consultarNewsDaEquipe } = await import("./ponte.server");
    const r = await consultarNewsDaEquipe<ItemNewsEquipe>(
      `select id, tipo, titulo, resumo, categoria_nome, url_externa, fonte, externa, fixado,
              tempo_leitura_min, publicado_em::text as publicado_em, imagem_url, corpo, formato
         from radar.feed_da_equipe($1, $2)`,
      [context.userId, data.limite],
    );
    return r ?? [];
  });

export const registrarEventosNewsEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        eventos: z
          .array(
            z.object({
              tipo: z.enum(["impressao", "leitura", "clique", "compartilhamento", "tempo"]),
              item_tipo: TIPO_ITEM,
              item_id: UUID,
              canal: z.enum(["whatsapp", "link", "email", "nativo"]).optional(),
              segundos: z.number().int().min(0).max(3600).optional(),
            }),
          )
          .max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.eventos.length) return { n: 0 };
    try {
      const { consultarNewsDaEquipe } = await import("./ponte.server");
      const r = await consultarNewsDaEquipe<{ n: number }>("select radar.registrar_eventos_equipe($1, $2::jsonb) as n", [
        context.userId,
        JSON.stringify(data.eventos),
      ]);
      return { n: Number(r?.[0]?.n ?? 0) };
    } catch {
      return { n: 0 }; // medir nunca atrapalha ler
    }
  });

/** Comentários de um item (a curadoria também vê os ocultos, pela RLS). */
export const lerComentariosNews = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.news", "view"])])
  .inputValidator((d: unknown) => z.object({ tipo: TIPO_ITEM, itemId: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ c: ComentarioNews[] }>("select radar.comentarios_do_item($1, $2) as c", [
        data.tipo,
        data.itemId,
      ]),
    );
    return r?.c ?? [];
  });

/** Ocultar um comentário. O registro fica, com quem ocultou e o motivo. */
export const ocultarComentarioNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ id: UUID, motivo: z.string().max(1000).default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, (tx) =>
      tx.consultar(
        `update radar.comentarios
            set oculto_em = now(), oculto_por = seguranca.auth_usuario_id(), oculto_motivo = $2
          where id = $1`,
        [data.id, data.motivo.trim().slice(0, 300) || null],
      ),
    );
    return { ok: true as const, mensagem: "Comentário oculto. O registro continua guardado." };
  });

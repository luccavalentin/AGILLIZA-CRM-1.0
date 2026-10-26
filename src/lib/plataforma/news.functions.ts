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
}

export interface FonteNews {
  id: string;
  nome: string;
  url_rss: string;
  categoria: string | null;
  ativa: boolean;
  erro: string | null;
  ultima_coleta_em: string | null;
  noticias: number;
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
                (select u.nome from plataforma.usuarios(array[n.revisado_por]) u) as revisor
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
                (select count(*) from radar.noticias n where n.fonte_id = f.id)::int as noticias
           from radar.fontes f order by f.nome`,
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
                (select u.nome from plataforma.usuarios(array[p.autor_id]) u) as autor
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
                comentarios::int as comentarios
           from radar.feed(null, null, 120)`,
      );

      return {
        noticias,
        contagem: contagem ?? { na_fila: 0, publicadas: 0 },
        fontes,
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
 * Apontar uma matéria de um portal: guarda URL, título e chamada — nunca o texto. Ela abre
 * na página do veículo.
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
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const url = data.url.trim();
    if (!/^https:\/\/[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) {
      throw new Error("Informe o endereço completo da matéria, começando com https://.");
    }
    if (data.titulo.trim().length < 10) {
      throw new Error("O título precisa de pelo menos 10 caracteres.");
    }
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, (tx) =>
      tx.consultar(
        `insert into radar.noticias
           (fonte_id, url_original, titulo_original, titulo, slug, resumo, categoria, status,
            publicado_em, revisado_por, tempo_leitura_min)
         values (radar.fonte_por_nome($5, $4), $1, $2, $2,
                 nucleo.slug_unico('radar.noticias', $2), $3, $4, 'publicada',
                 now(), seguranca.auth_usuario_id(), 3)`,
        [
          url,
          data.titulo.trim(),
          data.resumo.trim() || null,
          data.categoria,
          data.fonte.trim() || null,
        ],
      ),
    );
    return { ok: true as const, mensagem: "Matéria no ar. Ela abre na página do veículo." };
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
    // 200 palavras por minuto, arredondado (estimativa, como na Gestão).
    const minutos = Math.max(1, Math.round(data.corpo.trim().split(/\s+/).length / 200));
    const status = data.publicar ? "publicado" : "rascunho";
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
                  capa_midia_id = $7::uuid,
                  atualizado_em = now()
            where id = $1`,
          [
            data.id,
            data.titulo.trim(),
            data.corpo.trim(),
            data.categoria,
            minutos,
            status,
            data.capaMidiaId === undefined ? antes.capa_midia_id : data.capaMidiaId,
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
           (autor_id, titulo, slug, corpo, categoria, tempo_leitura_min, status, publicado_em, capa_midia_id)
         values (seguranca.auth_usuario_id(), $1, nucleo.slug_unico('radar.posts', $1), $2, $3, $4, $5,
                 case when $5 = 'publicado' then now() end, $6::uuid)`,
        [
          data.titulo.trim(),
          data.corpo.trim(),
          data.categoria,
          minutos,
          status,
          data.capaMidiaId ?? null,
        ],
      );
    });
    return { ok: true as const, mensagem: data.publicar ? "Publicado." : "Rascunho salvo." };
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

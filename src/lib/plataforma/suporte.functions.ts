/**
 * Suporte da plataforma (Agilliza Tech) no Agilliza: o lado de QUEM ATENDE os chamados
 * abertos pelas contas (corretores, imobiliárias, parceiros).
 *
 * Mesmas consultas e funções da antiga Gestão (`apps/web/src/app/[portal]/suporte`):
 *   · fila: `comunicacao.suporte_chamados` com `plataforma.usuarios` para autor/responsável;
 *   · conversa: `comunicacao.fio_do_chamado`, `enviar_mensagem_suporte`, `editar_…`,
 *     `remover_…`, `reagir_…` e `marcar_fio_suporte_lido`;
 *   · situação, prioridade e "assumir": o mesmo UPDATE de `mudarChamado` da Gestão;
 *   · base de conhecimento: `comunicacao.base_conhecimento`, como a Gestão.
 * O prazo (`sla_ate`) sai do plano da conta por gatilho; a nota interna só é escondida da
 * conta pela política do banco. Quem decide permissão é o banco (`suporte.atender`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export const STATUS_CHAMADO = [
  "aberto",
  "em_atendimento",
  "aguardando_cliente",
  "resolvido",
  "fechado",
] as const;
export const PRIORIDADES_CHAMADO = ["baixa", "normal", "alta", "urgente"] as const;
export const RECORTES_CHAMADO = ["abertos", "atrasados", "sem-responsavel", "avaliados", "meus"] as const;
export const CATEGORIAS_ARTIGO = [
  "duvida",
  "erro",
  "financeiro",
  "sugestao",
  "integracao",
  "lgpd",
  "outro",
] as const;

export type StatusChamado = (typeof STATUS_CHAMADO)[number];
export type PrioridadeChamado = (typeof PRIORIDADES_CHAMADO)[number];
export type RecorteChamado = (typeof RECORTES_CHAMADO)[number];

export interface Chamado {
  id: string;
  codigo: string;
  tenant_id: string | null;
  assunto: string;
  descricao: string | null;
  categoria: string;
  prioridade: PrioridadeChamado;
  status: StatusChamado;
  perfil: string;
  url: string | null;
  ultimo_erro: string | null;
  sla_ate: string | null;
  criado_em: string;
  resolvido_em: string | null;
  /** Primeira resposta aberta de quem atende (0309). */
  primeira_resposta_em: string | null;
  atribuido_a: string | null;
  avaliacao: number | null;
  atrasado: boolean;
  conta: string | null;
  autor: string | null;
  responsavel: string | null;
  mensagens: number;
}

export interface ResumoSuporte {
  total: number;
  abertos: number;
  atrasados: number;
  sem_responsavel: number;
  avaliacoes: number;
  media: number | null;
  por_status: { status: StatusChamado; total: number }[];
}

export interface ContaComChamado {
  id: string;
  nome: string;
}

export interface AnexoMensagem {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  /** Endereço selado para abrir/baixar (1 h); `null` se o arquivo não está disponível. */
  url?: string | null;
}

/** Formato de `comunicacao.fio_do_chamado` (o mesmo da Gestão e do lado da conta). */
export interface MensagemChamado {
  id: string;
  lado: "conta" | "correspondente";
  interno: boolean;
  tipo: string;
  corpo: string | null;
  anexos: AnexoMensagem[];
  duracao_ms: number | null;
  autor: string | null;
  meu: boolean;
  responde_a: string | null;
  responde_corpo: string | null;
  responde_autor: string | null;
  reacoes: { [emoji: string]: string[] };
  editado: boolean;
  removido: boolean;
  lida: boolean;
  criado_em: string;
}

export interface ArtigoSuporte {
  id: string;
  titulo: string;
  slug: string;
  categoria: string;
  corpo: string;
  publicado: boolean;
  visualizacoes: number;
  atualizado_em: string;
}

const ID_CHAMADO = z.string().uuid("Chamado inválido.");
const ID_MENSAGEM = z.string().uuid("Mensagem inválida.");

async function ponte() {
  return import("./ponte.server");
}

export const POR_PAGINA_CHAMADOS = 50;

/** Fila de chamados (mesma consulta da Gestão, com filtros e página) + resumo e contas para o filtro. */
export const listarChamados = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.suporte", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(STATUS_CHAMADO).optional().nullable(),
        prioridade: z.enum(PRIORIDADES_CHAMADO).optional().nullable(),
        conta: z.string().uuid().optional().nullable(),
        recorte: z.enum(RECORTES_CHAMADO).optional().nullable(),
        busca: z.string().trim().max(120).optional().nullable(),
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const busca = data.busca ? data.busca.replace(/[\\%_]/g, (c) => "\\" + c) : null;
    return comPlataforma(context.userId, async (tx) => {
      const linhas = await tx.consultar<Chamado & { total_filtro: number }>(
        `select c.id, c.codigo, c.tenant_id, c.assunto, c.descricao, c.categoria, c.prioridade, c.status,
                c.perfil, c.url, c.ultimo_erro::text as ultimo_erro, to_json(c.sla_ate) #>> '{}' as sla_ate,
                to_json(c.criado_em) #>> '{}' as criado_em, to_json(c.resolvido_em) #>> '{}' as resolvido_em,
                to_json(c.primeira_resposta_em) #>> '{}' as primeira_resposta_em, c.atribuido_a,
                c.avaliacao::int as avaliacao,
                coalesce(c.sla_ate < now() and c.resolvido_em is null, false) as atrasado,
                (select t.nome from nucleo.tenants t where t.id = c.tenant_id) as conta,
                (select u.nome from plataforma.usuarios(array[c.aberto_por]) u) as autor,
                (select u.nome from plataforma.usuarios(array[c.atribuido_a]) u) as responsavel,
                (select count(*) from comunicacao.suporte_mensagens m where m.chamado_id = c.id)::int as mensagens,
                (count(*) over ())::int as total_filtro
           from comunicacao.suporte_chamados c
          where ($1::text is null or c.status = $1)
            and ($2::text is null or c.prioridade = $2)
            and ($3::uuid is null or c.tenant_id = $3)
            and ($4::text is null
                 or ($4 = 'abertos' and c.resolvido_em is null)
                 or ($4 = 'atrasados' and c.resolvido_em is null and c.sla_ate < now())
                 or ($4 = 'sem-responsavel' and c.resolvido_em is null and c.atribuido_a is null)
                 or ($4 = 'avaliados' and c.avaliacao is not null)
                 or ($4 = 'meus' and c.resolvido_em is null and c.atribuido_a = seguranca.auth_usuario_id()))
            and ($5::text is null or c.assunto ilike '%' || $5 || '%' or c.codigo ilike '%' || $5 || '%'
                 or exists (select 1 from nucleo.tenants t where t.id = c.tenant_id and t.nome ilike '%' || $5 || '%'))
          order by (c.resolvido_em is null) desc, (c.prioridade = 'urgente') desc, c.sla_ate nulls last, c.criado_em desc, c.id
          limit ${POR_PAGINA_CHAMADOS} offset $6`,
        [
          data.status ?? null,
          data.prioridade ?? null,
          data.conta ?? null,
          data.recorte ?? null,
          busca,
          (data.pagina - 1) * POR_PAGINA_CHAMADOS,
        ],
      );
      const chamados = linhas.map(({ total_filtro: _t, ...c }) => c as Chamado);

      // Os cartões contam a fila inteira (como na Gestão), não só o recorte filtrado.
      const resumo = await tx.uma<ResumoSuporte>(
        `select count(*)::int as total,
                count(*) filter (where resolvido_em is null)::int as abertos,
                count(*) filter (where resolvido_em is null and sla_ate < now())::int as atrasados,
                count(*) filter (where resolvido_em is null and atribuido_a is null)::int as sem_responsavel,
                count(avaliacao)::int as avaliacoes,
                round(avg(avaliacao), 1)::float8 as media,
                coalesce((select jsonb_agg(jsonb_build_object('status', s.status, 'total', s.n))
                            from (select status, count(*)::int as n
                                    from comunicacao.suporte_chamados group by status) s), '[]'::jsonb)
                  as por_status
           from comunicacao.suporte_chamados`,
      );

      const contas = await tx.consultar<ContaComChamado>(
        `select t.id, t.nome
           from nucleo.tenants t
          where exists (select 1 from comunicacao.suporte_chamados c where c.tenant_id = t.id)
          order by t.nome`,
      );

      return {
        chamados,
        totalFiltro: linhas[0]?.total_filtro ?? 0,
        contas,
        resumo: resumo ?? {
          total: 0,
          abertos: 0,
          atrasados: 0,
          sem_responsavel: 0,
          avaliacoes: 0,
          media: null,
          por_status: [],
        },
      };
    });
  });

/** A conversa do chamado, pela mesma função que serve os dois lados. */
export const lerFioChamado = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.suporte", "view"])])
  .inputValidator((d: unknown) => z.object({ id: ID_CHAMADO }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ r: MensagemChamado[] }>(
        "select comunicacao.fio_do_chamado($1) as r",
        [data.id],
      );
      const mensagens = r?.r ?? [];
      const { liberarMidias } = await import("./midias.server");
      const urls = await liberarMidias(
        tx,
        mensagens.flatMap((m) => (m.anexos ?? []).map((a) => a.id)),
      );
      for (const m of mensagens) {
        for (const a of m.anexos ?? []) a.url = urls[a.id]?.url ?? null;
      }
      return { mensagens };
    });
  });

/** Visto de leitura (o outro lado vê que a equipe leu): só de quem atende. */
export const marcarChamadoLido = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.suporte", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: ID_CHAMADO }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select comunicacao.marcar_fio_suporte_lido($1)", [data.id]),
    );
    return { ok: true as const };
  });

/**
 * Responder (ou deixar nota interna). As regras — lado, status, atribuição de quem
 * responde primeiro, nota interna só para quem atende — moram em
 * `comunicacao.enviar_mensagem_suporte`. Anexos sobem antes por `enviarAnexoSuporte`
 * (ponte de arquivos) e chegam aqui pelo id, como no fio do Corretor.
 */
export const enviarMensagemChamado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.suporte", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        chamadoId: ID_CHAMADO,
        corpo: z.string().trim().max(10_000, "A mensagem ficou longa demais."),
        anexos: z
          .array(
            z.object({
              id: z.string().uuid(),
              nome: z.string().max(200),
              tipo: z.string().max(100),
              tamanho: z.number().int().min(0),
            }),
          )
          .max(10, "Até dez arquivos por mensagem.")
          .default([]),
        interno: z.boolean().default(false),
        respondeA: z.string().uuid().optional().nullable(),
        chave: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.corpo && data.anexos.length === 0) {
      throw new Error("Escreva algo ou anexe um arquivo.");
    }
    // Mesma regra do fio do Corretor: o tipo serve para a tela escolher como desenhar.
    const tipo =
      data.anexos.length === 0
        ? "texto"
        : data.anexos.every((a) => a.tipo.startsWith("image/"))
          ? "imagem"
          : "arquivo";
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        "select comunicacao.enviar_mensagem_suporte($1, $2, $3::jsonb, $4, $5, $6, $7, $8) as id",
        [
          data.chamadoId,
          data.corpo,
          JSON.stringify(data.anexos),
          data.interno,
          tipo,
          null,
          data.respondeA ?? null,
          data.chave ?? null,
        ],
      ),
    );
    return { ok: true as const, id: r?.id ?? null };
  });

export const editarMensagemChamado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.suporte", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: ID_MENSAGEM,
        corpo: z
          .string()
          .trim()
          .min(1, "A mensagem não pode ficar vazia.")
          .max(10_000, "A mensagem ficou longa demais."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select comunicacao.editar_mensagem_suporte($1, $2)", [data.id, data.corpo]),
    );
    return { ok: true as const };
  });

export const removerMensagemChamado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.suporte", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: ID_MENSAGEM }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select comunicacao.remover_mensagem_suporte($1)", [data.id]),
    );
    return { ok: true as const };
  });

export const reagirMensagemChamado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.suporte", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ id: ID_MENSAGEM, emoji: z.string().trim().min(1).max(16) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select comunicacao.reagir_mensagem_suporte($1, $2)", [data.id, data.emoji]),
    );
    return { ok: true as const };
  });

/** Situação, prioridade e "assumir" — o mesmo UPDATE de `mudarChamado` da Gestão. */
export const mudarChamado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.suporte", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: ID_CHAMADO,
        status: z.enum(STATUS_CHAMADO).optional().nullable(),
        prioridade: z.enum(PRIORIDADES_CHAMADO).optional().nullable(),
        assumir: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        `update comunicacao.suporte_chamados
            set status = coalesce($2, status),
                prioridade = coalesce($3, prioridade),
                atribuido_a = case when $4 then seguranca.auth_usuario_id() else atribuido_a end,
                resolvido_em = case when $2 in ('resolvido', 'fechado') then coalesce(resolvido_em, now()) else resolvido_em end
          where id = $1 returning id`,
        [data.id, data.status ?? null, data.prioridade ?? null, Boolean(data.assumir)],
      ),
    );
    if (!r) throw new Error("Chamado não encontrado.");
    return { ok: true as const };
  });

/** Artigos da base de conhecimento (o que evita o próximo chamado igual). */
export const listarArtigosSuporte = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.suporte", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const artigos = await tx.consultar<ArtigoSuporte>(
        `select id, titulo, slug::text as slug, categoria, corpo, publicado,
                visualizacoes::int as visualizacoes, to_json(atualizado_em) #>> '{}' as atualizado_em
           from comunicacao.base_conhecimento order by categoria, titulo`,
      );
      return { artigos };
    });
  });

/** Cria ou altera um artigo — mesmas instruções de `salvarArtigo` da Gestão. */
export const salvarArtigoSuporte = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.suporte", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional().nullable(),
        titulo: z.string().trim().min(4, "Informe o título.").max(200),
        categoria: z.enum(CATEGORIAS_ARTIGO),
        corpo: z
          .string()
          .trim()
          .min(20, "Escreva o artigo (pelo menos 20 caracteres).")
          .max(50_000),
        publicado: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const slug = data.titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    await comPlataforma(context.userId, (tx) =>
      data.id
        ? tx.consultar(
            "update comunicacao.base_conhecimento set titulo = $2, categoria = $3, corpo = $4, publicado = $5 where id = $1",
            [data.id, data.titulo, data.categoria, data.corpo, data.publicado],
          )
        : tx.consultar(
            `insert into comunicacao.base_conhecimento (titulo, slug, categoria, corpo, publicado, criado_por)
             values ($1, $2, $3, $4, $5, seguranca.auth_usuario_id())`,
            [data.titulo, slug, data.categoria, data.corpo, data.publicado],
          ),
    );
    return { ok: true as const };
  });

/* ------------------------------------------- central de atendimento (0309 do Agilliza Tech) --- */

export interface AtendenteSuporte {
  id: string;
  nome: string;
  papel: string;
  eu: boolean;
  abertos: number;
}

export interface MetricasSuporte {
  dias: number;
  criados: number;
  resolvidos: number;
  primeira_resposta_media_min: number | null;
  primeira_resposta_mediana_min: number | null;
  resolucao_media_min: number | null;
  sem_resposta: number;
  prazo_cumprido_pct: number | null;
  avaliacao_media: number | null;
  fila_por_prioridade: Partial<Record<PrioridadeChamado, number>>;
  fila_por_status: Partial<Record<StatusChamado, number>>;
  por_atendente: { id: string; nome: string; abertos: number; resolvidos: number }[];
  por_dia: { dia: string; criados: number; resolvidos: number }[];
}

/** Equipe que atende (para atribuir), com a fila aberta de cada pessoa. */
export const listarAtendentes = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.suporte", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: AtendenteSuporte[] }>("select comunicacao.suporte_atendentes() as j"),
    );
    return r?.j ?? [];
  });

/** Atribui o chamado a alguém da equipe (null = devolve à fila). O banco confere quem atende. */
export const atribuirChamado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.suporte", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ id: ID_CHAMADO, atendente: z.string().uuid("Atendente inválido.").nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select comunicacao.suporte_atribuir($1, $2)", [data.id, data.atendente]),
    );
    return { ok: true as const };
  });

/** Métricas da central (primeira resposta, resolução, prazo cumprido, fila) do período. */
export const lerMetricasSuporte = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.suporte", "view"])])
  .inputValidator((d: unknown) =>
    z.object({ dias: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: MetricasSuporte }>("select comunicacao.suporte_metricas($1) as j", [data.dias]),
    );
    if (!r?.j) throw new Error("Não foi possível calcular as métricas.");
    return r.j;
  });

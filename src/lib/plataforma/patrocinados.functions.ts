/**
 * Banners patrocinados do ImobMatch geridos pelo Agilliza correspondente (frente F3 do
 * Corretor, migrações 0275–0278; contrato em `docs/imobmatch/CONTRATO-PATROCINADOS.md`).
 *
 * Duas portas, como em toda a gestão da plataforma:
 *   · a permissão do Agilliza: `saas.patrocinados` (ver / moderar) e, para preços e
 *     espaços, `saas.planos` (editar);
 *   · a da plataforma, no banco: `patrocinados.ler`, `patrocinados.moderar` e `planos.editar`.
 * Toda regra (aprovação, pausa, bloqueio, preço, medição) mora nas funções
 * `plataforma.patrocinio_*`. Aqui só se valida a forma da entrada e se sela o endereço da
 * imagem do criativo (a chave do arquivo nunca vai ao navegador).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VER = exigirPermissao(["saas.patrocinados", "view"]);
const MODERAR = exigirPermissao(["saas.patrocinados", "edit"]);
const VER_PRECOS = exigirPermissao(["saas.patrocinados", "view"], ["saas.planos", "view"]);
const EDITAR_PRECOS = exigirPermissao(["saas.planos", "edit"]);

async function ponte() {
  return import("./ponte.server");
}

/* ───────────────────────────── tipos (jsonb das funções do banco) ───────────────────────────── */

export type SituacaoCampanha =
  | "aguardando_pagamento"
  | "estornada"
  | "encerrada"
  | "pausada"
  | "no_ar"
  | "agendada"
  | "em_analise"
  | "reprovada"
  | "rascunho"
  | "cancelada";

export interface CampanhaBanner {
  id: string;
  nome: string;
  espaco: string;
  espaco_nome: string | null;
  inicio: string | null;
  fim: string | null;
  uf: string | null;
  cidade: string | null;
  finalidade: "comprar" | "alugar" | null;
  status: "ativa" | "pausada" | "cancelada";
  situacao: SituacaoCampanha;
  pausada_por: "patrocinador" | "plataforma" | null;
  pausa_motivo: string | null;
  periodo: string | null;
  dias: number | null;
  preco: number | null;
  criativos: number;
  aprovados: number;
  criado_em: string;
  patrocinador?: string;
  conta?: string;
}

export interface CriativoBanner {
  id: string;
  titulo: string;
  texto: string | null;
  botao: string;
  destino: string;
  status: string;
  situacao: string;
  motivo: string | null;
  enviado_em: string | null;
  decidido_em: string | null;
  versao: number;
  imagem: { largura: number; altura: number; bytes: number; mime: string } | null;
  /** Endereço selado (1 h) da imagem; null sem imagem ou sem a ponte de arquivos. */
  imagem_url: string | null;
  patrocinador: {
    conta: string;
    nome: string;
    razao_social: string | null;
    segmento?: string | null;
    site?: string | null;
    situacao: string;
  };
  campanha: CampanhaBanner | null;
  pago?: boolean;
  historico?: { acao: string; motivo: string | null; em: string; por: string | null }[];
  atualizado_em: string;
}

export interface Patrocinador {
  conta: string;
  nome: string;
  razao_social: string | null;
  tipo_pessoa: "PF" | "PJ";
  documento: string | null;
  segmento: string | null;
  site: string | null;
  responsavel: string | null;
  email: string | null;
  celular: string | null;
  situacao: "ativo" | "bloqueado";
  bloqueio_motivo: string | null;
  desde: string;
  pago_total: number;
  campanhas: number;
  no_ar: number;
  em_analise: number;
}

export type PeriodoPacote = "semana" | "mes" | "trimestre" | "semestre" | "ano";

export interface PacoteBanner {
  id: string;
  espaco: string;
  periodo: PeriodoPacote;
  dias: number;
  preco: number;
  nome: string;
  descricao: string | null;
  a_venda: boolean;
  peso: number;
  ordem: number;
  /** Da vitrine do banco (só pacote à venda): valor por mês e economia sobre o mensal. */
  por_mes: number | null;
  economia_pct: number | null;
}

export interface EspacoBanner {
  chave: string;
  nome: string;
  descricao: string | null;
  largura_min: number;
  altura_min: number;
  largura_max: number | null;
  proporcao: number | null;
  tolerancia: number | null;
  peso_max_kb: number;
  ativo: boolean;
  ordem: number;
  pacotes: PacoteBanner[];
}

export interface MetricasBanners {
  de: string;
  ate: string;
  totais: {
    impressoes: number;
    alcance: number;
    cliques: number;
    conversoes: number;
    robos: number;
    ctr: number | null;
  };
  receita: { valor: number; compras: number };
  a_receber: number;
  fila: number;
  patrocinadores: number;
  por_espaco: {
    espaco: string;
    nome: string;
    no_ar: number;
    impressoes: number;
    cliques: number;
    receita: number;
  }[];
  por_patrocinador: {
    conta: string;
    nome: string;
    impressoes: number;
    cliques: number;
    conversoes: number;
  }[];
}

/* ───────────────────────────── imagem selada ───────────────────────────── */

type CriativoDoBanco = Omit<CriativoBanner, "imagem_url"> & {
  imagem_chave?: string | null;
  imagem_mime?: string | null;
};

async function comImagem(c: CriativoDoBanco): Promise<CriativoBanner> {
  const { selarArquivo } = await import("./midias.server");
  const { imagem_chave, imagem_mime, ...resto } = c;
  return {
    ...resto,
    imagem_url: imagem_chave
      ? selarArquivo(imagem_chave, imagem_mime ?? c.imagem?.mime ?? "image/jpeg", `banner-${c.id}`)
      : null,
  };
}

const chamar = async <T>(userId: string, sql: string, params: unknown[] = []): Promise<T> => {
  const { comPlataforma } = await ponte();
  const r = await comPlataforma(userId, (tx) => tx.uma<{ r: T }>(sql, params));
  return r!.r;
};

const motivo = (min: number, msg: string) =>
  z.string().trim().min(min, msg).max(500, "Motivo longo demais (máximo 500 caracteres).");

/* ───────────────────────────── leituras ───────────────────────────── */

/** Criativos esperando aprovação (mais antigos primeiro), cada um com a prévia da imagem. */
export const lerFilaCriativos = createServerFn({ method: "GET" })
  .middleware([VER])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    const itens = await comPlataforma(context.userId, async (tx) => {
      const fila =
        (await tx.uma<{ r: CriativoDoBanco[] }>("select plataforma.patrocinio_fila(50) as r"))?.r ??
        [];
      // A chave da imagem só vem na ficha do criativo (uma por item, na mesma transação).
      return Promise.all(
        fila.map(async (k) => {
          const f = await tx.uma<{ r: CriativoDoBanco | null }>(
            "select plataforma.patrocinio_criativo($1) as r",
            [k.id],
          );
          return {
            ...k,
            imagem_chave: f?.r?.imagem_chave ?? null,
            imagem_mime: f?.r?.imagem_mime ?? null,
          };
        }),
      );
    });
    return Promise.all(itens.map(comImagem));
  });

/** Ficha de um criativo, com o histórico das decisões. */
export const lerCriativo = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) =>
    z.object({ id: z.string().regex(UUID, "Criativo inválido.") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const c = await chamar<CriativoDoBanco | null>(
      context.userId,
      "select plataforma.patrocinio_criativo($1) as r",
      [data.id],
    );
    if (!c) throw new Error("Criativo não encontrado.");
    return comImagem(c);
  });

/** Patrocinadores (busca no nome, razão social e e-mail). */
export const lerPatrocinadores = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) =>
    z.object({ busca: z.string().max(80).default("") }).parse(d ?? {}),
  )
  .handler(({ data, context }) =>
    chamar<Patrocinador[]>(
      context.userId,
      "select plataforma.patrocinio_patrocinadores($1, 200) as r",
      [data.busca.trim() || null],
    ),
  );

export const SITUACOES_CAMPANHA: SituacaoCampanha[] = [
  "no_ar",
  "agendada",
  "em_analise",
  "pausada",
  "aguardando_pagamento",
  "encerrada",
  "reprovada",
  "rascunho",
  "estornada",
  "cancelada",
];

/** Campanhas (de um patrocinador ou de todos), pela situação calculada no banco. */
export const lerCampanhas = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) =>
    z
      .object({
        conta: z.string().regex(UUID).nullable().default(null),
        situacao: z
          .enum(SITUACOES_CAMPANHA as [SituacaoCampanha, ...SituacaoCampanha[]])
          .nullable()
          .default(null),
      })
      .parse(d ?? {}),
  )
  .handler(({ data, context }) =>
    chamar<CampanhaBanner[]>(
      context.userId,
      "select plataforma.patrocinio_campanhas($1, $2) as r",
      [data.conta, data.situacao],
    ),
  );

/**
 * Espaços e todos os pacotes. "Por mês" e "economia" vêm da vitrine do próprio banco
 * (`publico.imobmatch_banner_vitrine`, a mesma conta que o comprador vê) — nada calculado aqui.
 */
export const lerPacotes = createServerFn({ method: "GET" })
  .middleware([VER_PRECOS])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const espacos =
        (await tx.uma<{ r: EspacoBanner[] }>("select plataforma.patrocinio_pacotes() as r"))?.r ??
        [];
      const vitrine =
        (
          await tx.uma<{
            r: {
              espaco: string;
              pacotes: { id: string; por_mes: number; economia_pct: number | null }[];
            }[];
          }>("select publico.imobmatch_banner_vitrine() as r")
        )?.r ?? [];
      const conta = new Map<string, { por_mes: number; economia_pct: number | null }>();
      for (const e of vitrine) for (const p of e.pacotes ?? []) conta.set(p.id, p);
      return espacos.map((e) => ({
        ...e,
        pacotes: (e.pacotes ?? []).map((p) => ({
          ...p,
          por_mes: conta.get(p.id)?.por_mes ?? null,
          economia_pct: conta.get(p.id)?.economia_pct ?? null,
        })),
      }));
    });
  });

/** Impressões, cliques, conversões, receita e os números por espaço e patrocinador. */
export const lerMetricasBanners = createServerFn({ method: "GET" })
  .middleware([VER])
  .validator((d: unknown) =>
    z
      .object({
        de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .refine((v) => v.de <= v.ate, "O início precisa ser antes do fim.")
      .parse(d),
  )
  .handler(({ data, context }) =>
    chamar<MetricasBanners>(context.userId, "select plataforma.patrocinio_metricas($1, $2) as r", [
      data.de,
      data.ate,
    ]),
  );

/* ───────────────────────────── decisões ───────────────────────────── */

/** Versão do criativo que o moderador está vendo: o banco recusa se ele mudou depois (0294). */
const versaoVista = z.number().int().positive("Versão do criativo inválida.");

/**
 * Aprova o criativo em análise (vai ao ar se a campanha estiver paga e no período). Leva a
 * versão que está na tela: se o patrocinador trocou o criativo enquanto a análise estava
 * aberta, o banco recusa ("O criativo mudou desde que você abriu. Analise de novo.").
 */
export const aprovarCriativo = createServerFn({ method: "POST" })
  .middleware([MODERAR])
  .validator((d: unknown) =>
    z.object({ id: z.string().regex(UUID, "Criativo inválido."), versao: versaoVista }).parse(d),
  )
  .handler(({ data, context }) =>
    chamar<{ situacao: string }>(
      context.userId,
      "select plataforma.patrocinio_aprovar($1, $2) as r",
      [data.id, data.versao],
    ),
  );

/** Reprova o criativo com o motivo que o patrocinador lê para corrigir (na versão que está na tela). */
export const reprovarCriativo = createServerFn({ method: "POST" })
  .middleware([MODERAR])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().regex(UUID, "Criativo inválido."),
        motivo: motivo(5, "Escreva o motivo (mínimo 5 caracteres). O patrocinador lê este texto."),
        versao: versaoVista,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await chamar(context.userId, "select plataforma.patrocinio_reprovar($1, $2, $3) as r", [
      data.id,
      data.motivo,
      data.versao,
    ]);
    return { ok: true as const };
  });

/** Pausa (com motivo) ou retoma uma campanha ou um criativo. Pausa da plataforma o patrocinador não desfaz. */
export const pausarBanner = createServerFn({ method: "POST" })
  .middleware([MODERAR])
  .validator((d: unknown) =>
    z
      .object({
        alvo: z.enum(["campanha", "criativo"]),
        id: z.string().regex(UUID, "Item inválido."),
        pausar: z.boolean(),
        motivo: z.string().max(500, "Motivo longo demais.").default(""),
      })
      .superRefine((v, ctx) => {
        if (v.pausar && v.motivo.trim().length < 5) {
          ctx.addIssue({
            code: "custom",
            path: ["motivo"],
            message: "Pausar exige motivo (mínimo 5 caracteres).",
          });
        }
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await chamar(context.userId, "select plataforma.patrocinio_pausar($1, $2, $3, $4) as r", [
      data.alvo,
      data.id,
      data.pausar,
      data.motivo.trim() || null,
    ]);
    return { ok: true as const };
  });

/** Bloqueia (com motivo) ou libera o patrocinador. Bloqueado, nada dele vai ao ar. */
export const bloquearPatrocinador = createServerFn({ method: "POST" })
  .middleware([MODERAR])
  .validator((d: unknown) =>
    z
      .object({
        conta: z.string().regex(UUID, "Patrocinador inválido."),
        bloquear: z.boolean(),
        motivo: z.string().max(500, "Motivo longo demais.").default(""),
      })
      .superRefine((v, ctx) => {
        if (v.bloquear && v.motivo.trim().length < 5) {
          ctx.addIssue({
            code: "custom",
            path: ["motivo"],
            message: "Bloquear exige motivo (mínimo 5 caracteres).",
          });
        }
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await chamar(context.userId, "select plataforma.patrocinio_bloquear($1, $2, $3) as r", [
      data.conta,
      data.bloquear,
      data.motivo.trim() || null,
    ]);
    return { ok: true as const };
  });

/** Cria (sem id) ou edita um pacote; `a_venda` põe à venda ou tira. Permissão de preços. */
export const salvarPacote = createServerFn({ method: "POST" })
  .middleware([EDITAR_PRECOS])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().regex(UUID).nullable().default(null),
        dados: z.object({
          espaco: z.string().max(40).optional(),
          periodo: z.enum(["semana", "mes", "trimestre", "semestre", "ano"]).optional(),
          dias: z.number().int().min(1, "Dias de 1 a 366.").max(366, "Dias de 1 a 366.").optional(),
          preco: z
            .number()
            .positive("O preço precisa ser maior que zero.")
            .max(10_000_000)
            .optional(),
          nome: z.string().trim().max(80).optional(),
          descricao: z.string().trim().max(300).optional(),
          a_venda: z.boolean().optional(),
          peso: z.number().int().min(1).max(1000).optional(),
        }),
      })
      .superRefine((v, ctx) => {
        if (!v.id && (!v.dados.espaco || !v.dados.periodo || !v.dados.dias || !v.dados.preco)) {
          ctx.addIssue({
            code: "custom",
            message: "Para criar, informe espaço, período, dias e preço.",
          });
        }
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const id = await chamar<string>(
      context.userId,
      "select plataforma.patrocinio_salvar_pacote($1, $2::jsonb) as r",
      [data.id, JSON.stringify(data.dados)],
    );
    return { id };
  });

/** Liga/desliga um espaço de banner ou muda o nome e a descrição. Permissão de preços. */
export const salvarEspaco = createServerFn({ method: "POST" })
  .middleware([EDITAR_PRECOS])
  .validator((d: unknown) =>
    z
      .object({
        chave: z.string().min(1).max(40),
        dados: z.object({
          nome: z.string().trim().max(60).optional(),
          descricao: z.string().trim().max(300).optional(),
          ativo: z.boolean().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await chamar(context.userId, "select plataforma.patrocinio_salvar_espaco($1, $2::jsonb) as r", [
      data.chave,
      JSON.stringify(data.dados),
    ]);
    return { ok: true as const };
  });

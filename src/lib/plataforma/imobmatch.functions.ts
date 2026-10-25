/**
 * Gestão de Parceiros e Anúncios do ImobMatch, feita pelo Agilliza correspondente.
 *
 * Duas portas, como em toda a gestão da plataforma:
 *   · a permissão do Agilliza (`saas.imobmatch`: ver / moderar), aqui;
 *   · a da plataforma, no banco, pela ponte: `imobmatch.ver`, `imobmatch.moderar` e
 *     `rede.verificar` (migração 0283 do Corretor).
 * Toda regra (revisão de duplicado, moderação, denúncia, CRECI, LGPD dos compradores) mora
 * nas funções `plataforma.imobmatch_*` do Corretor. Aqui só se valida a forma da entrada e
 * se sela o endereço das fotos (a chave do arquivo nunca vai ao navegador).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VER = exigirPermissao(["saas.imobmatch", "view"]);
const MODERAR = exigirPermissao(["saas.imobmatch", "edit"]);

async function ponte() {
  return import("./ponte.server");
}

/* ───────────────────────────── tipos (jsonb das funções do banco) ───────────────────────────── */

export type StatusAnuncio = "publicado" | "revisao" | "retirado" | "moderado";

export interface FotoAnuncio {
  id: string;
  /** Endereço selado (1 h) — vazio quando a ponte de arquivos não está configurada. */
  url: string | null;
}

export interface FichaAnuncio {
  id: string;
  codigo: string;
  slug: string;
  titulo: string | null;
  status: StatusAnuncio;
  motivo: string | null;
  anunciante: "profissional" | "proprietario";
  finalidade: string;
  tipo: string;
  uf: string | null;
  cidade: string | null;
  bairro: string | null;
  valor_venda: number | null;
  valor_locacao: number | null;
  preco_sob_consulta: boolean;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  area: number | null;
  publicado_em: string | null;
  retirado_em: string | null;
  criado_em: string;
  atualizado_em: string;
  conta: {
    id: string;
    nome: string;
    tipo: string;
    status: string;
    creci: string | null;
    creci_uf: string | null;
    verificado: boolean;
  };
  autorizacao: { tipo: string; exclusiva: boolean; inicio: string; fim: string | null } | null;
  amei: number;
  pedidos: number;
  denuncias_abertas: number;
  fotos: FotoAnuncio[];
  historico: { acao: string; motivo: string | null; em: string; operador: string | null }[];
}

export interface Pagina<T> {
  total: number;
  pagina: number;
  por_pagina: number;
  itens: T[];
}

export interface ResumoImobMatch {
  revisao: number;
  denuncias: number;
  moderados: number;
  creci_pendentes: number;
  no_ar: number;
}

export interface ItemRevisao {
  anuncio: FichaAnuncio;
  outros: FichaAnuncio[];
}

export type MotivoDenuncia =
  | "golpe"
  | "imovel_inexistente"
  | "ja_negociado"
  | "preco_enganoso"
  | "fotos_enganosas"
  | "duplicado"
  | "conteudo_improprio"
  | "outro";

export interface GrupoDenuncias {
  anuncio: FichaAnuncio;
  abertas: number;
  total: number;
  ultima: string;
  motivos: Partial<Record<MotivoDenuncia, number>>;
  denuncias: {
    id: string;
    motivo: MotivoDenuncia;
    detalhe: string | null;
    status: "aberta" | "procedente" | "improcedente";
    criado_em: string;
    decidida_em: string | null;
    /** E-mail mascarado ("m•••••@gmail.com"). */
    denunciante: string | null;
    denuncias_da_pessoa: number;
  }[];
}

export type SituacaoCreci = "sem_pedido" | "pendente" | "verificado" | "recusado" | "suspenso";

export interface Profissional {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  creci: string | null;
  creci_uf: string | null;
  creci_rede: string | null;
  creci_uf_rede: string | null;
  situacao: SituacaoCreci;
  como_empresa: boolean | null;
  motivo: string | null;
  verificado_em: string | null;
  pedido_em: string | null;
  verificador: string | null;
  criado_em: string;
  anuncios_no_ar: number;
}

export interface PaginaProfissionais {
  contagem: Record<"todos" | "pendentes" | "verificados" | "sem_pedido" | "fora", number>;
  pagina: number;
  por_pagina: number;
  itens: Profissional[];
}

export interface Anunciante {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  status_motivo: string | null;
  criado_em: string;
  acesso_ate: string | null;
  documento_mascarado: string | null;
  plano: string | null;
  produto: string | null;
  verificado: boolean;
  no_ar: number;
  em_revisao: number;
  moderados: number;
  denuncias_abertas: number;
  /** -1 = sem limite; null = sem regra no plano. */
  limite: number | null;
}

export interface Comprador {
  id: string;
  primeiro_nome: string;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  criado_em: string;
  confirmado: boolean;
  situacao: string;
  ultimo_acesso: string | null;
  aceita_novidades: boolean;
  amei: number;
  pedidos: number;
  denuncias: number;
}

export interface NumerosImobMatch {
  dias: number;
  gerado_em: string;
  totais: {
    no_ar: number;
    em_revisao: number;
    moderados: number;
    anunciantes_com_anuncio: number;
    compradores: number;
    amei: number;
    pedidos: number;
    conversas: number;
    denuncias_abertas: number;
  };
  periodo: {
    novos_anuncios: number;
    amei: number;
    pedidos: number;
    conversas: number;
    compradores: number;
    denuncias: number;
  };
  serie: {
    dia: string;
    novos_anuncios: number;
    amei: number;
    pedidos: number;
    conversas: number;
    compradores: number;
  }[];
  cidades: { cidade: string; uf: string | null; anuncios: number }[];
}

/* ───────────────────────────── fotos seladas ───────────────────────────── */

type FichaDoBanco = Omit<FichaAnuncio, "fotos"> & {
  fotos: { id: string; chave: string | null; mime: string | null }[];
};

function mimeDaChave(chave: string, mime: string | null): string {
  if (/\.webp$/i.test(chave)) return "image/webp";
  if (/\.png$/i.test(chave)) return "image/png";
  if (/\.jpe?g$/i.test(chave)) return "image/jpeg";
  return mime && mime.startsWith("image/") ? mime : "image/jpeg";
}

/** Troca a chave de cada foto por um endereço selado. A chave fica no servidor. */
async function comFotos(f: FichaDoBanco | null | undefined): Promise<FichaAnuncio> {
  const { selarArquivo } = await import("./midias.server");
  const fotos = (f?.fotos ?? []).map((x) => ({
    id: x.id,
    url: x.chave ? selarArquivo(x.chave, mimeDaChave(x.chave, x.mime), `foto-${x.id}`) : null,
  }));
  return { ...(f as FichaDoBanco), fotos };
}

const chamar = async <T>(userId: string, sql: string, params: unknown[] = []): Promise<T> => {
  const { comPlataforma } = await ponte();
  const r = await comPlataforma(userId, (tx) => tx.uma<{ r: T }>(sql, params));
  return r!.r;
};

const pagina = z.number().int().min(1).max(10_000).default(1);
const motivoLivre = z.string().max(200, "Motivo longo demais (máximo 200 caracteres).").default("");
const motivoObrigatorio = z
  .string()
  .trim()
  .min(10, "Escreva o motivo (mínimo 10 caracteres). O anunciante lê este texto.")
  .max(200, "Motivo longo demais (máximo 200 caracteres).");

/* ───────────────────────────── leituras ───────────────────────────── */

/** Contagens das abas (revisão, denúncias, moderados, CRECI a conferir, anúncios no ar). */
export const lerResumoImobMatch = createServerFn({ method: "GET" })
  .middleware([VER])
  .handler(({ context }) =>
    chamar<ResumoImobMatch>(context.userId, "select plataforma.imobmatch_resumo() as r"),
  );

/** Anúncios em revisão de possível duplicado, cada um com os outros do mesmo endereço. */
export const lerRevisao = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) => z.object({ pagina }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{
        r: Omit<Pagina<unknown>, "itens"> & {
          itens: { anuncio: FichaDoBanco; outros: FichaDoBanco[] }[];
        };
      }>("select plataforma.imobmatch_revisao($1) as r", [data.pagina]),
    );
    const p = r!.r;
    const itens: ItemRevisao[] = await Promise.all(
      p.itens.map(async (i) => ({
        anuncio: await comFotos(i.anuncio),
        outros: await Promise.all(i.outros.map(comFotos)),
      })),
    );
    return { ...p, itens } as Pagina<ItemRevisao>;
  });

/** Ficha de um anúncio pelo código (para moderar um anúncio fora da fila). */
export const lerAnuncioPorCodigo = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) =>
    z
      .object({
        codigo: z
          .string()
          .trim()
          .regex(/^(IMV-)?\d{1,12}$/i, "Use o código do anúncio, ex.: IMV-000123."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    comFotos(
      await chamar<FichaDoBanco>(context.userId, "select plataforma.imobmatch_anuncio($1) as r", [
        data.codigo.toUpperCase(),
      ]),
    ),
  );

/** Anúncios moderados, com busca pelo código, título, cidade ou conta. */
export const lerModerados = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) =>
    z.object({ busca: z.string().max(80).default(""), pagina }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const p = await chamar<Omit<Pagina<unknown>, "itens"> & { itens: FichaDoBanco[] }>(
      context.userId,
      "select plataforma.imobmatch_moderados($1, $2) as r",
      [data.busca.trim() || null, data.pagina],
    );
    return { ...p, itens: await Promise.all(p.itens.map(comFotos)) } as Pagina<FichaAnuncio>;
  });

export const SITUACOES_DENUNCIA = ["abertas", "decididas", "todas"] as const;

/** Denúncias agrupadas por anúncio (mais denunciados primeiro). */
export const lerDenuncias = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) =>
    z.object({ situacao: z.enum(SITUACOES_DENUNCIA).default("abertas"), pagina }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const p = await chamar<
      Omit<Pagina<unknown>, "itens"> & {
        itens: (Omit<GrupoDenuncias, "anuncio"> & { anuncio: FichaDoBanco })[];
      }
    >(context.userId, "select plataforma.imobmatch_denuncias($1, $2) as r", [
      data.situacao,
      data.pagina,
    ]);
    const itens: GrupoDenuncias[] = await Promise.all(
      p.itens.map(async (g) => ({ ...g, anuncio: await comFotos(g.anuncio) })),
    );
    return { ...p, itens } as Pagina<GrupoDenuncias>;
  });

export const FILTROS_PROFISSIONAIS = [
  "pendentes",
  "verificados",
  "sem_pedido",
  "fora",
  "todos",
] as const;

/** Profissionais do ImobMatch Pro com o CRECI e a situação da verificação. */
export const lerProfissionais = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) =>
    z
      .object({
        filtro: z.enum(FILTROS_PROFISSIONAIS).default("pendentes"),
        busca: z.string().max(80).default(""),
        pagina,
      })
      .parse(d ?? {}),
  )
  .handler(({ data, context }) =>
    chamar<PaginaProfissionais>(
      context.userId,
      "select plataforma.imobmatch_profissionais($1, $2, $3) as r",
      [data.filtro, data.busca.trim() || null, data.pagina],
    ),
  );

export const TIPOS_ANUNCIANTE = ["todos", "profissionais", "particulares"] as const;

/** Contas que anunciam (profissionais com o Pro e particulares). */
export const lerAnunciantes = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) =>
    z
      .object({
        tipo: z.enum(TIPOS_ANUNCIANTE).default("todos"),
        busca: z.string().max(80).default(""),
        pagina,
      })
      .parse(d ?? {}),
  )
  .handler(({ data, context }) =>
    chamar<Pagina<Anunciante> & { contagem: { profissionais: number; particulares: number } }>(
      context.userId,
      "select plataforma.imobmatch_anunciantes($1, $2, $3) as r",
      [data.tipo, data.busca.trim() || null, data.pagina],
    ),
  );

/** Compradores, só com o necessário (LGPD). A busca é pelo e-mail exato. */
export const lerCompradores = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z
          .string()
          .trim()
          .max(254)
          .refine(
            (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            "Digite o e-mail inteiro.",
          )
          .default(""),
        pagina,
      })
      .parse(d ?? {}),
  )
  .handler(({ data, context }) =>
    chamar<Pagina<Comprador> & { confirmados: number }>(
      context.userId,
      "select plataforma.imobmatch_compradores($1, $2) as r",
      [data.email || null, data.pagina],
    ),
  );

/** Totais e série diária do ImobMatch (7 a 90 dias). */
export const lerNumerosImobMatch = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d: unknown) =>
    z.object({ dias: z.number().int().min(7).max(90).default(30) }).parse(d ?? {}),
  )
  .handler(({ data, context }) =>
    chamar<NumerosImobMatch>(context.userId, "select plataforma.imobmatch_numeros($1) as r", [
      data.dias,
    ]),
  );

/* ───────────────────────────── decisões ───────────────────────────── */

/** Decide a revisão: publicar os dois, manter o outro (este sai) ou trocar (este fica). */
export const resolverRevisao = createServerFn({ method: "POST" })
  .middleware([MODERAR])
  .inputValidator((d: unknown) =>
    z
      .object({
        anuncioId: z.string().regex(UUID, "Anúncio inválido."),
        decisao: z.enum(["publicar", "manter_outro", "trocar"], { message: "Decisão inválida." }),
        motivo: motivoLivre,
      })
      .parse(d),
  )
  .handler(({ data, context }) =>
    chamar<{ id: string; status: StatusAnuncio }>(
      context.userId,
      "select plataforma.imobmatch_resolver_revisao($1, $2, $3) as r",
      [data.anuncioId, data.decisao, data.motivo.trim() || null],
    ).then((r) => ({ id: r.id, status: r.status })),
  );

/** Tira o anúncio do ar com motivo (o anunciante lê e não republica). */
export const moderarAnuncio = createServerFn({ method: "POST" })
  .middleware([MODERAR])
  .inputValidator((d: unknown) =>
    z
      .object({ anuncioId: z.string().regex(UUID, "Anúncio inválido."), motivo: motivoObrigatorio })
      .parse(d),
  )
  .handler(({ data, context }) =>
    chamar<{ id: string; status: StatusAnuncio }>(
      context.userId,
      "select plataforma.imobmatch_moderar($1, $2) as r",
      [data.anuncioId, data.motivo],
    ).then((r) => ({ id: r.id, status: r.status })),
  );

/** Desfaz a moderação: o anúncio volta ao anunciante, liberado para publicar de novo. */
export const reverterModeracao = createServerFn({ method: "POST" })
  .middleware([MODERAR])
  .inputValidator((d: unknown) =>
    z
      .object({ anuncioId: z.string().regex(UUID, "Anúncio inválido."), motivo: motivoLivre })
      .parse(d),
  )
  .handler(({ data, context }) =>
    chamar<{ id: string; status: StatusAnuncio }>(
      context.userId,
      "select plataforma.imobmatch_reverter_moderacao($1, $2) as r",
      [data.anuncioId, data.motivo.trim() || null],
    ).then((r) => ({ id: r.id, status: r.status })),
  );

/** Julga as denúncias abertas de um anúncio: procedente (modera) ou improcedente. */
export const decidirDenuncias = createServerFn({ method: "POST" })
  .middleware([MODERAR])
  .inputValidator((d: unknown) =>
    z
      .object({
        anuncioId: z.string().regex(UUID, "Anúncio inválido."),
        decisao: z.enum(["procedente", "improcedente"], { message: "Decisão inválida." }),
        motivo: motivoLivre,
      })
      .superRefine((v, ctx) => {
        if (v.decisao === "procedente" && v.motivo.trim().length < 10) {
          ctx.addIssue({
            code: "custom",
            path: ["motivo"],
            message: "Procedente tira o anúncio do ar: escreva o motivo (mínimo 10 caracteres).",
          });
        }
      })
      .parse(d),
  )
  .handler(({ data, context }) =>
    chamar<{ decididas: number }>(
      context.userId,
      "select plataforma.imobmatch_decidir_denuncias($1, $2, $3) as r",
      [data.anuncioId, data.decisao, data.motivo.trim() || null],
    ).then((r) => ({ decididas: r.decididas })),
  );

/** Verifica, recusa, suspende ou devolve para pendente o CRECI de um profissional. */
export const verificarCreci = createServerFn({ method: "POST" })
  .middleware([MODERAR])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().regex(UUID, "Profissional inválido."),
        status: z.enum(["pendente", "verificado", "recusado", "suspenso"], {
          message: "Situação inválida.",
        }),
        motivo: z.string().max(1000, "Motivo longo demais.").default(""),
      })
      .superRefine((v, ctx) => {
        if ((v.status === "recusado" || v.status === "suspenso") && v.motivo.trim().length < 10) {
          ctx.addIssue({
            code: "custom",
            path: ["motivo"],
            message: "Recusar ou suspender exige motivo (mínimo 10 caracteres).",
          });
        }
      })
      .parse(d),
  )
  .handler(({ data, context }) =>
    chamar<{ tenant_id: string; status: string }>(
      context.userId,
      "select plataforma.imobmatch_verificar_creci($1, $2, $3) as r",
      [data.tenantId, data.status, data.motivo.trim() || null],
    ),
  );

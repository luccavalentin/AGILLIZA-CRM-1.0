/**
 * Base de conhecimento (C19) e publicação de artigo na Agilliza News (C20).
 *
 * O artigo mora em `consultor_ia_base` (Agilliza); a News mora em `radar.posts` (Agilliza
 * Tech, banco único) e é escrita pela ponte, com a permissão de curadoria da News
 * (`saas.news` → `radar.curar`). Publicar de novo atualiza o MESMO post (um por artigo:
 * `origem = base_conhecimento`, `origem_ref = id do artigo`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { minutosDeLeitura, textoPuro } from "./markdown";

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("correspondente_id").eq("id", userId).maybeSingle();
  return data?.correspondente_id ?? null;
}

async function pode(supabase: any, userId: string, modulo: string, acao: string): Promise<boolean> {
  const { data } = await supabase.rpc("usuario_tem_permissao", { _user_id: userId, _modulo: modulo, _acao: acao });
  return data === true;
}

/** Para a tela: pasta de upload, e o que esta pessoa pode fazer. */
export const contextoBase = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["admin.parametros", "view"], ["saas.news", "edit"])])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const [corr, editar, news, global] = await Promise.all([
      correspondenteDoUsuario(supabase, userId),
      pode(supabase, userId, "admin.parametros", "edit"),
      pode(supabase, userId, "saas.news", "edit"),
      supabase.rpc("pode_editar_base_global", { _user_id: userId }).then((r: any) => r.data === true),
    ]);
    return { correspondenteId: corr as string | null, podeEditar: editar, podePublicarNews: news, podeGlobal: global };
  });

export interface VersaoArtigo {
  id: string;
  versao: number;
  titulo: string;
  conteudo: string;
  resumo: string | null;
  categoria: string;
  tags: string[];
  status: string;
  created_at: string;
}

export const listarVersoesArtigo = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["admin.parametros", "view"])])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<VersaoArtigo[]> => {
    const { supabase } = context as any;
    const { data: rows, error } = await supabase
      .from("consultor_ia_base_versoes")
      .select("id, versao, titulo, conteudo, resumo, categoria, tags, status, created_at")
      .eq("artigo_id", data.id)
      .order("versao", { ascending: false })
      .limit(100);
    if (error) throw new Error("Não foi possível carregar o histórico.");
    return (rows ?? []) as VersaoArtigo[];
  });

/** Volta o artigo para uma versão anterior (a atual vira mais uma versão no histórico). */
export const restaurarVersaoArtigo = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.parametros", "edit"])])
  .inputValidator((d: { id: string; versao: number }) =>
    z.object({ id: z.string().uuid(), versao: z.number().int().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: v } = await supabase
      .from("consultor_ia_base_versoes")
      .select("titulo, conteudo, resumo, categoria, tags")
      .eq("artigo_id", data.id)
      .eq("versao", data.versao)
      .maybeSingle();
    if (!v) throw new Error("Versão não encontrada.");
    const { data: alterados, error } = await supabase
      .from("consultor_ia_base")
      .update({ titulo: v.titulo, conteudo: v.conteudo, resumo: v.resumo, categoria: v.categoria, tags: v.tags, atualizado_por: userId })
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error("Não foi possível restaurar a versão.");
    if (!alterados?.length) throw new Error("Você não tem permissão para alterar este artigo.");
    return { ok: true, mensagem: `Versão ${data.versao} restaurada.` };
  });

export interface CategoriaBase {
  id: string;
  nome: string;
  global: boolean;
}

export const listarCategoriasBase = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["admin.parametros", "view"], ["crm.clientes", "view"])])
  .handler(async ({ context }): Promise<CategoriaBase[]> => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("consultor_ia_categorias")
      .select("id, nome, correspondente_id, ordem")
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    if (error) throw new Error("Não foi possível carregar as categorias.");
    return (data ?? []).map((c: any) => ({ id: c.id, nome: c.nome, global: c.correspondente_id === null }));
  });

export const criarCategoriaBase = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.parametros", "edit"])])
  .inputValidator((d: { nome: string }) =>
    z
      .object({
        nome: z
          .string()
          .trim()
          .min(2, "Nome curto demais.")
          .max(60)
          .regex(/^[\p{L}\p{N} _&/-]+$/u, "Use letras, números e espaços."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Conta não identificada.");
    const { error } = await supabase.from("consultor_ia_categorias").insert({ correspondente_id: corr, nome: data.nome });
    if (error) {
      if (error.code === "23505") throw new Error("Já existe uma categoria com esse nome.");
      throw new Error("Não foi possível criar a categoria.");
    }
    return { ok: true };
  });

/** Endereço temporário (10 min) de um anexo da base — só da pasta da própria conta. */
export const urlAnexoBase = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.parametros", "view"], ["crm.clientes", "view"])])
  .inputValidator((d: { caminho: string }) => z.object({ caminho: z.string().min(3).max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr || !data.caminho.startsWith(`${corr}/`) || data.caminho.includes("..")) {
      throw new Error("Anexo não encontrado.");
    }
    const { data: s, error } = await supabase.storage.from("conhecimento-anexos").createSignedUrl(data.caminho, 600);
    if (error || !s?.signedUrl) throw new Error("Anexo não encontrado.");
    return { url: s.signedUrl as string };
  });

/* ─────────────── Publicar o artigo na Agilliza News (C20) ─────────────── */

const PUBLICO = z.enum(["todos", "assinantes", "equipe"]);

export const publicarArtigoNaNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.parametros", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        publico: PUBLICO.default("todos"),
        categoria_news: z.string().min(1).max(60).default("agilliza"),
        destaque: z.boolean().default(false),
        dias: z.number().int().min(1).max(365).nullable().optional(),
        inicio_em: z.string().datetime({ offset: true }).nullable().optional(),
        fim_em: z.string().datetime({ offset: true }).nullable().optional(),
        capaMidiaId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!(await pode(supabase, userId, "saas.news", "edit"))) {
      throw new Error("Publicar na Agilliza News é de quem tem edição no módulo Agilliza News.");
    }
    const { data: artigo } = await supabase
      .from("consultor_ia_base")
      .select("id, titulo, conteudo, resumo, status, ativo")
      .eq("id", data.id)
      .maybeSingle();
    if (!artigo) throw new Error("Artigo não encontrado.");
    if (artigo.status !== "publicado" || !artigo.ativo) {
      throw new Error("Publique o artigo na base (e deixe-o ativo) antes de levá-lo à News.");
    }
    if (artigo.titulo.trim().length < 10) throw new Error("O título precisa de pelo menos 10 caracteres para ir à News.");
    if (artigo.conteudo.trim().length < 80) throw new Error("O artigo é curto demais para a News (mínimo 80 caracteres).");

    const inicio = data.inicio_em ? new Date(data.inicio_em) : null;
    let fim = data.fim_em ? new Date(data.fim_em) : null;
    if (!fim && data.dias) fim = new Date((inicio ?? new Date()).getTime() + data.dias * 86_400_000);
    if (fim && fim.getTime() <= (inicio ?? new Date()).getTime()) throw new Error("A data de fim precisa ser depois do início.");

    const resumo = (artigo.resumo?.trim() || textoPuro(artigo.conteudo).slice(0, 240)).slice(0, 400);
    const minutos = Math.min(60, minutosDeLeitura(artigo.conteudo));
    const { comPlataforma } = await import("@/lib/plataforma/ponte.server");
    const post = await comPlataforma(userId, (tx) =>
      tx.uma<{ id: string }>(
        `insert into radar.posts
           (autor_id, titulo, slug, corpo, categoria, tempo_leitura_min, status, publicado_em, capa_midia_id,
            resumo, publico, fixado, formato, origem, origem_ref, inicio_em, fim_em)
         values (seguranca.auth_usuario_id(), $1, nucleo.slug_unico('radar.posts', $1), $2, $3, $4, 'publicado', now(),
                 $5::uuid, $6, $7, $8, 'markdown', 'base_conhecimento', $9, $10::timestamptz, $11::timestamptz)
         on conflict (origem, origem_ref) where origem_ref is not null do update
           set titulo = excluded.titulo, corpo = excluded.corpo, categoria = excluded.categoria,
               tempo_leitura_min = excluded.tempo_leitura_min, status = 'publicado',
               publicado_em = coalesce(radar.posts.publicado_em, now()),
               capa_midia_id = coalesce(excluded.capa_midia_id, radar.posts.capa_midia_id),
               resumo = excluded.resumo, publico = excluded.publico, fixado = excluded.fixado,
               formato = 'markdown', inicio_em = excluded.inicio_em, fim_em = excluded.fim_em,
               editado_em = now(), editado_por = seguranca.auth_usuario_id(), atualizado_em = now()
         returning id`,
        [
          artigo.titulo.trim(),
          artigo.conteudo.trim(),
          data.categoria_news,
          minutos,
          data.capaMidiaId ?? null,
          resumo,
          data.publico,
          data.destaque,
          artigo.id,
          inicio?.toISOString() ?? null,
          fim?.toISOString() ?? null,
        ],
      ),
    );
    if (!post?.id) throw new Error("A News recusou a publicação.");
    await (supabase as any)
      .from("consultor_ia_base")
      .update({
        news_post_id: post.id,
        news_publicado_em: new Date().toISOString(),
        news_publico: data.publico,
        news_fim_em: fim?.toISOString() ?? null,
      })
      .eq("id", artigo.id);
    return {
      ok: true,
      post_id: post.id,
      mensagem: inicio && inicio > new Date() ? "Artigo agendado na Agilliza News." : "Artigo publicado na Agilliza News.",
    };
  });

export const despublicarArtigoDaNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.parametros", "view"])])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!(await pode(supabase, userId, "saas.news", "edit"))) {
      throw new Error("Tirar da Agilliza News é de quem tem edição no módulo Agilliza News.");
    }
    const { data: artigo } = await supabase.from("consultor_ia_base").select("id").eq("id", data.id).maybeSingle();
    if (!artigo) throw new Error("Artigo não encontrado.");
    const { comPlataforma } = await import("@/lib/plataforma/ponte.server");
    await comPlataforma(userId, (tx) =>
      tx.consultar(
        `update radar.posts set status = 'arquivado', atualizado_em = now()
          where origem = 'base_conhecimento' and origem_ref = $1`,
        [data.id],
      ),
    );
    await (supabase as any)
      .from("consultor_ia_base")
      .update({ news_post_id: null, news_publicado_em: null, news_publico: null, news_fim_em: null })
      .eq("id", data.id);
    return { ok: true, mensagem: "Artigo retirado da Agilliza News." };
  });

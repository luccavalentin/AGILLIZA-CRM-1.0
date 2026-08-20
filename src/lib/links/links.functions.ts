import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LinkUtil {
  id: string;
  titulo: string;
  url: string;
  descricao: string | null;
  categoria: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Normaliza a URL garantindo esquema http(s) e bloqueando esquemas perigosos. */
function normalizarUrl(url: string): string {
  const v = url.trim();
  // Bloqueia esquemas potencialmente perigosos (XSS / phishing local)
  if (/^\s*(javascript|data|vbscript|file):/i.test(v)) {
    throw new Error("Esquema de URL não permitido.");
  }
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("Somente URLs http(s) são permitidas.");
    }
    return u.toString();
  } catch {
    throw new Error("URL inválida.");
  }
}

/** Lista todos os links do repositório. */
export const listarLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LinkUtil[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("links_uteis")
      .select("*")
      .order("titulo", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as LinkUtil[];
  });

/** Cria um novo link. */
export const criarLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        titulo: z.string().trim().min(1, "Informe um título").max(200),
        url: z.string().trim().min(1, "Informe a URL").max(2000),
        descricao: z.string().trim().max(1000).optional().nullable(),
        categoria: z.string().trim().max(120).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<LinkUtil> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("links_uteis")
      .insert({
        titulo: data.titulo,
        url: normalizarUrl(data.url),
        descricao: data.descricao?.trim() || null,
        categoria: data.categoria?.trim() || null,
        criado_por: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as LinkUtil;
  });

/** Atualiza um link existente. */
export const atualizarLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        titulo: z.string().trim().min(1, "Informe um título").max(200),
        url: z.string().trim().min(1, "Informe a URL").max(2000),
        descricao: z.string().trim().max(1000).optional().nullable(),
        categoria: z.string().trim().max(120).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<LinkUtil> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("links_uteis")
      .update({
        titulo: data.titulo,
        url: normalizarUrl(data.url),
        descricao: data.descricao?.trim() || null,
        categoria: data.categoria?.trim() || null,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as LinkUtil;
  });

/** Exclui um link. */
export const excluirLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { error } = await supabase.from("links_uteis").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Categorias de links (com ícone e cor)
// ============================================================

export interface LinkCategoria {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  created_at: string;
  updated_at: string;
}

/** Lista as categorias cadastradas. */
export const listarCategoriasLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LinkCategoria[]> => {
    const { data, error } = await context.supabase
      .from("links_categorias")
      .select("*")
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as LinkCategoria[];
  });

/** Cria uma categoria. */
export const criarCategoriaLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        nome: z.string().trim().min(1, "Informe o nome").max(120),
        icone: z.string().trim().min(1).max(40).default("link"),
        cor: z.string().trim().min(1).max(30).default("azul"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<LinkCategoria> => {
    const { data: row, error } = await context.supabase
      .from("links_categorias")
      .insert({ nome: data.nome, icone: data.icone, cor: data.cor, criado_por: context.userId })
      .select("*")
      .single();
    if (error) {
      throw new Error(
        error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message,
      );
    }
    return row as LinkCategoria;
  });

/** Atualiza nome/ícone/cor de uma categoria e propaga a renomeação para os links. */
export const atualizarCategoriaLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().trim().min(1, "Informe o nome").max(120),
        icone: z.string().trim().min(1).max(40),
        cor: z.string().trim().min(1).max(30),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<LinkCategoria> => {
    const { supabase } = context;
    const { data: atual, error: errAtual } = await supabase
      .from("links_categorias")
      .select("nome")
      .eq("id", data.id)
      .single();
    if (errAtual) throw new Error(errAtual.message);

    const { data: row, error } = await supabase
      .from("links_categorias")
      .update({ nome: data.nome, icone: data.icone, cor: data.cor })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) {
      throw new Error(
        error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message,
      );
    }

    if (atual?.nome && atual.nome !== data.nome) {
      const { error: errLinks } = await supabase
        .from("links_uteis")
        .update({ categoria: data.nome })
        .eq("categoria", atual.nome);
      if (errLinks) throw new Error(errLinks.message);
    }
    return row as LinkCategoria;
  });

/** Exclui uma categoria. Os links vinculados ficam sem categoria (ou são reatribuídos). */
export const excluirCategoriaLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        moverPara: z.string().trim().max(120).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { data: atual, error: errAtual } = await supabase
      .from("links_categorias")
      .select("nome")
      .eq("id", data.id)
      .single();
    if (errAtual) throw new Error(errAtual.message);

    if (atual?.nome) {
      const { error: errLinks } = await supabase
        .from("links_uteis")
        .update({ categoria: data.moverPara?.trim() || null })
        .eq("categoria", atual.nome);
      if (errLinks) throw new Error(errLinks.message);
    }

    const { error } = await supabase.from("links_categorias").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

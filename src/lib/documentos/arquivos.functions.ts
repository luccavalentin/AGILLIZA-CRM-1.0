import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ArquivoNo {
  id: string;
  parent_id: string | null;
  tipo: "pasta" | "arquivo";
  nome: string;
  storage_path: string | null;
  content_type: string | null;
  tamanho: number | null;
  created_at: string;
}

export interface Migalha {
  id: string;
  nome: string;
}

async function correspondenteDoUsuario(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

/** Lista pastas e arquivos de um nível (parent_id null = raiz). */
export const listarNos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ parent_id: z.string().uuid().nullable().optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<ArquivoNo[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return [];

    let query = supabase
      .from("arquivos_nos")
      .select("id, parent_id, tipo, nome, storage_path, content_type, tamanho, created_at")
      .eq("correspondente_id", corr);

    query = data.parent_id ? query.eq("parent_id", data.parent_id) : query.is("parent_id", null);

    const { data: rows, error } = await query
      .order("tipo", { ascending: true })
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ArquivoNo[];
  });

/** Cria uma pasta. Se já existir uma pasta com o mesmo nome no nível, retorna a existente. */
export const criarPasta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        parent_id: z.string().uuid().nullable().optional(),
        nome: z.string().trim().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const parent = data.parent_id ?? null;
    let existente = supabase
      .from("arquivos_nos")
      .select("id")
      .eq("correspondente_id", corr)
      .eq("tipo", "pasta")
      .eq("nome", data.nome);
    existente = parent ? existente.eq("parent_id", parent) : existente.is("parent_id", null);
    const { data: jaExiste } = await existente.maybeSingle();
    if (jaExiste?.id) return { id: jaExiste.id };

    const { data: novo, error } = await supabase
      .from("arquivos_nos")
      .insert({
        correspondente_id: corr,
        parent_id: parent,
        tipo: "pasta",
        nome: data.nome,
        criado_por: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: novo.id };
  });

/** Registra um arquivo já enviado ao storage. */
export const registrarArquivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        parent_id: z.string().uuid().nullable().optional(),
        nome: z.string().trim().min(1).max(300),
        storage_path: z.string().min(1),
        content_type: z.string().nullable().optional(),
        tamanho: z.number().nonnegative().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: novo, error } = await supabase
      .from("arquivos_nos")
      .insert({
        correspondente_id: corr,
        parent_id: data.parent_id ?? null,
        tipo: "arquivo",
        nome: data.nome,
        storage_path: data.storage_path,
        content_type: data.content_type ?? null,
        tamanho: data.tamanho ?? null,
        criado_por: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: novo.id };
  });

export const renomearNo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), nome: z.string().trim().min(1).max(300) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");
    const { error } = await supabase
      .from("arquivos_nos")
      .update({ nome: data.nome })
      .eq("id", data.id)
      .eq("correspondente_id", corr);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moverNo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        novo_parent_id: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");
    if (data.novo_parent_id === data.id) throw new Error("Destino inválido.");
    const { error } = await supabase
      .from("arquivos_nos")
      .update({ parent_id: data.novo_parent_id ?? null })
      .eq("id", data.id)
      .eq("correspondente_id", corr);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui um nó (pasta recursiva ou arquivo), removendo os objetos do storage. */
export const excluirNo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    // Coleta todos os descendentes (BFS) dentro do escopo do correspondente.
    const idsParaExcluir: string[] = [data.id];
    const pathsStorage: string[] = [];
    let fronteira: string[] = [data.id];

    // Inclui o próprio nó (se for arquivo com storage_path).
    const { data: raiz } = await supabase
      .from("arquivos_nos")
      .select("storage_path")
      .eq("id", data.id)
      .eq("correspondente_id", corr)
      .maybeSingle();
    if (raiz?.storage_path) pathsStorage.push(raiz.storage_path);

    for (let i = 0; i < 100 && fronteira.length > 0; i++) {
      const { data: filhos } = await supabase
        .from("arquivos_nos")
        .select("id, storage_path")
        .eq("correspondente_id", corr)
        .in("parent_id", fronteira);
      const lista = (filhos ?? []) as { id: string; storage_path: string | null }[];
      if (lista.length === 0) break;
      fronteira = lista.map((f) => f.id);
      for (const f of lista) {
        idsParaExcluir.push(f.id);
        if (f.storage_path) pathsStorage.push(f.storage_path);
      }
    }

    if (pathsStorage.length > 0) {
      for (let i = 0; i < pathsStorage.length; i += 100) {
        await supabase.storage.from("arquivos").remove(pathsStorage.slice(i, i + 100));
      }
    }

    const { error } = await supabase
      .from("arquivos_nos")
      .delete()
      .eq("correspondente_id", corr)
      .in("id", idsParaExcluir);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Signed URL para abrir/baixar um arquivo. */
export const urlArquivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ url: string; nome: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");
    const { data: no } = await supabase
      .from("arquivos_nos")
      .select("nome, storage_path")
      .eq("id", data.id)
      .eq("correspondente_id", corr)
      .maybeSingle();
    if (!no?.storage_path) throw new Error("Arquivo não encontrado.");
    const { data: signed, error } = await supabase.storage
      .from("arquivos")
      .createSignedUrl(no.storage_path, 300, { download: no.nome });
    if (error || !signed?.signedUrl) throw new Error("Não foi possível gerar o link.");
    return { url: signed.signedUrl, nome: no.nome };
  });

/** Retorna o caminho (breadcrumb) até um nó. */
export const caminhoNo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid().nullable().optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<Migalha[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr || !data.id) return [];

    const trilha: Migalha[] = [];
    let atual: string | null = data.id;
    for (let i = 0; i < 50 && atual; i++) {
      const { data: no } = (await supabase
        .from("arquivos_nos")
        .select("id, nome, parent_id")
        .eq("id", atual)
        .eq("correspondente_id", corr)
        .maybeSingle()) as { data: { id: string; nome: string; parent_id: string | null } | null };
      if (!no) break;
      trilha.unshift({ id: no.id, nome: no.nome });
      atual = no.parent_id;
    }
    return trilha;
  });

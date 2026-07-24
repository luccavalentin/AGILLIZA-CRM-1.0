import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Categorias legadas associadas a cada pasta padrão (por slug). */
export const SLUG_CATEGORIAS: Record<string, string[]> = {
  comprador: ["comprador", "conjuge"],
  vendedor: ["vendedor", "vendedor_conjuge"],
  imovel: ["imovel"],
  outros: ["outros"],
};

/** Pastas padrão criadas automaticamente para cada cliente. */
const PASTAS_PADRAO: { nome: string; slug: string; ordem: number }[] = [
  { nome: "Comprador / Titular e Cônjuge", slug: "comprador", ordem: 0 },
  { nome: "Vendedor e Cônjuge", slug: "vendedor", ordem: 1 },
  { nome: "Imóvel", slug: "imovel", ordem: 2 },
  { nome: "Outros", slug: "outros", ordem: 3 },
];

export interface DocumentoPasta {
  id: string;
  nome: string;
  slug: string | null;
  parent_id: string | null;
  ordem: number;
  is_sistema: boolean;
  total_documentos: number;
  criado_por: string | null;
  criado_por_nome: string | null;
}

async function nomesDeUsuarios(
  supabase: any,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unicos = Array.from(new Set(ids.filter((v): v is string => !!v)));
  const mapa = new Map<string, string>();
  if (unicos.length === 0) return mapa;
  const { data } = await supabase.from("profiles").select("id, nome").in("id", unicos);
  for (const p of (data ?? []) as { id: string; nome: string | null }[]) {
    if (p.nome) mapa.set(p.id, p.nome);
  }
  return mapa;
}

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
  return (data as string | null) ?? null;
}

async function podeEditar(supabase: any, userId: string): Promise<boolean> {
  const { data: tudo } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  if (tudo) return true;
  const { data } = await supabase.rpc("usuario_tem_permissao", {
    _user_id: userId,
    _modulo: "crm.clientes",
    _acao: "edit",
  });
  return Boolean(data);
}

/** Um documento pertence à pasta se estiver ligado por pasta_id ou (sem pasta) por categoria. */
function documentoNaPasta(
  doc: { pasta_id: string | null; categoria: string },
  pasta: { id: string; slug: string | null },
): boolean {
  if (doc.pasta_id) return doc.pasta_id === pasta.id;
  if (!pasta.slug) return false;
  return (SLUG_CATEGORIAS[pasta.slug] ?? []).includes(doc.categoria);
}

/** Lista as pastas do cliente, criando as padrão quando ainda não existem. */
export const listarPastasDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DocumentoPasta[]> => {
    const { supabase, userId } = context;

    async function recarregar() {
      const { data: novo } = await supabase
        .from("cliente_documento_pastas")
        .select("id, nome, slug, ordem, criado_por, parent_id")
        .eq("cliente_id", data.cliente_id)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      return novo ?? [];
    }

    let pastas = await recarregar();

    const slugsExistentes = new Set(
      pastas.map((p: any) => p.slug).filter((slug: unknown): slug is string => typeof slug === "string" && slug.length > 0),
    );
    const faltantes = PASTAS_PADRAO.filter((p) => !slugsExistentes.has(p.slug));
    if (faltantes.length > 0) {
      const corr = await correspondenteDoUsuario(supabase, userId);
      if (corr) {
        // Upsert com ignoreDuplicates + unique index parcial em (cliente_id, slug)
        // evita corrida entre requisições concorrentes (StrictMode, duas abas).
        await supabase.from("cliente_documento_pastas").upsert(
          faltantes.map((p) => ({
            cliente_id: data.cliente_id,
            correspondente_id: corr,
            nome: p.nome,
            slug: p.slug,
            ordem: p.ordem,
          })),
          { onConflict: "cliente_id,slug", ignoreDuplicates: true },
        );
        pastas = await recarregar();
      }
    }

    const { data: docs } = await supabase
      .from("cliente_documentos")
      .select("pasta_id, categoria")
      .eq("cliente_id", data.cliente_id);

    const nomes = await nomesDeUsuarios(supabase, (pastas ?? []).map((p: any) => p.criado_por));

    return (pastas ?? []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      slug: p.slug,
      parent_id: p.parent_id ?? null,
      ordem: p.ordem,
      is_sistema: Boolean(p.slug),
      total_documentos: (docs ?? []).filter((d: any) => documentoNaPasta(d, p)).length,
      criado_por: p.criado_por ?? null,
      criado_por_nome: p.criado_por ? (nomes.get(p.criado_por) ?? null) : null,
    }));
  });

/** Cria uma nova pasta de documentos para o cliente. */
export const criarPastaDocumentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        nome: z.string().trim().min(1).max(120),
        parent_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    if (!(await podeEditar(supabase, userId))) {
      throw new Error("Você não tem permissão para criar pastas.");
    }
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");
    const { data: max } = await supabase
      .from("cliente_documento_pastas")
      .select("ordem")
      .eq("cliente_id", data.cliente_id)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: nova, error } = await supabase
      .from("cliente_documento_pastas")
      .insert({
        cliente_id: data.cliente_id,
        correspondente_id: corr,
        nome: data.nome,
        slug: null,
        parent_id: data.parent_id ?? null,
        ordem: (max?.ordem ?? 0) + 1,
        criado_por: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corr,
      acao: "documento_pasta.criar",
      entidade: "cliente_documento_pastas",
      entidadeId: nova.id,
      descricao: `criou a pasta de documentos "${data.nome}"`,
      payloadNovo: { nome: data.nome, cliente_id: data.cliente_id },
    });
    return { id: nova.id };
  });

/** Renomeia uma pasta de documentos. */
export const renomearPastaDocumentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), nome: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    if (!(await podeEditar(supabase, userId))) {
      throw new Error("Você não tem permissão para renomear pastas.");
    }
    const { data: pasta } = await supabase
      .from("cliente_documento_pastas")
      .select("id, nome, cliente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!pasta) throw new Error("Pasta não encontrada.");
    const { error } = await supabase
      .from("cliente_documento_pastas")
      .update({ nome: data.nome })
      .eq("id", data.id);
    if (error) throw error;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corr,
      acao: "documento_pasta.renomear",
      entidade: "cliente_documento_pastas",
      entidadeId: data.id,
      descricao: `renomeou a pasta de documentos "${pasta.nome}" para "${data.nome}"`,
      payloadAnterior: { nome: pasta.nome },
      payloadNovo: { nome: data.nome },
    });
    return { ok: true };
  });

/** Exclui uma pasta; documentos dela vão para a pasta "Outros". */
export const excluirPastaDocumentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    if (!(await podeEditar(supabase, userId))) {
      throw new Error("Você não tem permissão para excluir pastas.");
    }
    const { data: pasta } = await supabase
      .from("cliente_documento_pastas")
      .select("id, nome, slug, cliente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!pasta) throw new Error("Pasta não encontrada.");

    // Reatribui documentos ligados a esta pasta para "Outros" (categoria neutra).
    await supabase
      .from("cliente_documentos")
      .update({ pasta_id: null, categoria: "outros" })
      .eq("pasta_id", data.id);
    // Documentos legados (sem pasta) que apareciam aqui via categoria.
    if (pasta.slug && SLUG_CATEGORIAS[pasta.slug]) {
      await supabase
        .from("cliente_documentos")
        .update({ categoria: "outros" })
        .eq("cliente_id", pasta.cliente_id)
        .is("pasta_id", null)
        .in("categoria", SLUG_CATEGORIAS[pasta.slug] as any);
    }

    const { error } = await supabase.from("cliente_documento_pastas").delete().eq("id", data.id);
    if (error) throw error;

    const corr = await correspondenteDoUsuario(supabase, userId);
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corr,
      acao: "documento_pasta.excluir",
      entidade: "cliente_documento_pastas",
      entidadeId: data.id,
      descricao: `excluiu a pasta de documentos "${pasta.nome}"`,
      payloadAnterior: { nome: pasta.nome },
    });
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AcessoTipo = "sistema" | "portal_parceiro";

export interface TipoPessoaItem {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  acesso_tipo: AcessoTipo;
  login_padrao: boolean;
  ativo: boolean;
  is_padrao: boolean;
  pessoas_vinculadas: number;
}

function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function assertPodeGerenciar(supabase: any, userId: string) {
  const { data: pode } = await supabase.rpc("pode_gerenciar_pessoas", { _user_id: userId });
  if (!pode) throw new Error("Você não tem permissão para gerenciar tipos de pessoa.");
}

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string> {
  const { data: me } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  const corr = me?.correspondente_id;
  if (!corr) throw new Error("Ecossistema não identificado.");
  return corr;
}

/** Lista os tipos de pessoa do ecossistema com a contagem de pessoas vinculadas. */
export const listarTiposPessoa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TipoPessoaItem[]> => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    const corr = me?.correspondente_id;
    if (!corr) return [];

    const { data: tipos, error } = await supabase
      .from("tipos_pessoa")
      .select("id, nome, slug, descricao, acesso_tipo, login_padrao, ativo, is_padrao")
      .eq("correspondente_id", corr)
      .order("is_padrao", { ascending: false })
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    if (!tipos || tipos.length === 0) return [];

    const { data: perfis } = await supabase
      .from("profiles")
      .select("tipo_pessoa, tipos_pessoa")
      .eq("correspondente_id", corr);
    const contagem = new Map<string, number>();
    (perfis ?? []).forEach((p: any) => {
      const tps: string[] =
        Array.isArray(p.tipos_pessoa) && p.tipos_pessoa.length > 0
          ? p.tipos_pessoa
          : p.tipo_pessoa
            ? [p.tipo_pessoa]
            : [];
      new Set(tps).forEach((slug) => {
        contagem.set(slug, (contagem.get(slug) ?? 0) + 1);
      });
    });

    return tipos.map((t: any) => ({
      ...t,
      acesso_tipo: (t.acesso_tipo ?? "sistema") as AcessoTipo,
      pessoas_vinculadas: contagem.get(t.slug) ?? 0,
    }));
  });

const criarSchema = z.object({
  nome: z.string().min(2, "Informe o nome do tipo."),
  descricao: z.string().optional().nullable(),
  acesso_tipo: z.enum(["sistema", "portal_parceiro"]),
  login_padrao: z.boolean().default(true),
  ativo: z.boolean().default(true),
});

export const criarTipoPessoa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPodeGerenciar(supabase, userId);
    const corr = await correspondenteDoUsuario(supabase, userId);

    let slug = slugify(data.nome);
    if (!slug) slug = `tipo-${crypto.randomUUID().slice(0, 6)}`;

    const { error } = await supabase.from("tipos_pessoa").insert({
      correspondente_id: corr,
      nome: data.nome.trim(),
      slug,
      descricao: data.descricao?.trim() || null,
      acesso_tipo: data.acesso_tipo,
      login_padrao: data.login_padrao,
      ativo: data.ativo,
      is_padrao: false,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um tipo com esse nome.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

const atualizarSchema = criarSchema.extend({ id: z.string().uuid() });

export const atualizarTipoPessoa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => atualizarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPodeGerenciar(supabase, userId);
    const corr = await correspondenteDoUsuario(supabase, userId);

    const { error } = await supabase
      .from("tipos_pessoa")
      .update({
        nome: data.nome.trim(),
        descricao: data.descricao?.trim() || null,
        acesso_tipo: data.acesso_tipo,
        login_padrao: data.login_padrao,
        ativo: data.ativo,
      })
      .eq("id", data.id)
      .eq("correspondente_id", corr);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirTipoPessoa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPodeGerenciar(supabase, userId);
    const corr = await correspondenteDoUsuario(supabase, userId);

    const { data: tipo } = await supabase
      .from("tipos_pessoa")
      .select("slug, is_padrao")
      .eq("id", data.id)
      .eq("correspondente_id", corr)
      .maybeSingle();
    if (!tipo) throw new Error("Tipo de pessoa não encontrado.");

    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("correspondente_id", corr)
      .or(`tipo_pessoa.eq.${tipo.slug},tipos_pessoa.cs.{${tipo.slug}}`);
    if ((count ?? 0) > 0) {
      throw new Error("Não é possível excluir: há pessoas vinculadas a este tipo.");
    }

    const { error } = await supabase
      .from("tipos_pessoa")
      .delete()
      .eq("id", data.id)
      .eq("correspondente_id", corr);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

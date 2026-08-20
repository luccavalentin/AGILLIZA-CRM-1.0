/**
 * Server functions do e-book/FAQ do Consultor IA.
 *
 * `gerarFaqEbook` elabora o verbete estruturado (título, seções, exemplos,
 * gráficos, fontes) e `publicarFaqNaBase` grava o resultado em
 * `consultor_ia_base` para virar conhecimento pesquisável.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EbookFaq } from "./ebook.server";

export type { EbookFaq, EbookSecao, EbookExemplo, EbookGrafico } from "./ebook.server";

export const gerarFaqEbook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pergunta: string; resposta?: string | null }) =>
    z
      .object({
        pergunta: z.string().min(3),
        resposta: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<EbookFaq> => {
    const { supabase, userId } = context as any;
    const { gerarEbookFaq } = await import("./ebook.server");
    return gerarEbookFaq(supabase, userId, data.pergunta, data.resposta ?? null);
  });

export const publicarFaqNaBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ebook: unknown; global?: boolean }) =>
    z.object({ ebook: z.any(), global: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context as any;
    const { ebookParaMarkdown } = await import("./ebook.server");
    const ebook = data.ebook as EbookFaq;

    const { data: perfil } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    const corr = (perfil?.correspondente_id as string | null) ?? null;

    const { data: row, error } = await supabase
      .from("consultor_ia_base")
      .insert({
        categoria: ebook.categoria,
        titulo: ebook.titulo,
        conteudo: ebookParaMarkdown(ebook),
        tags: ebook.tags ?? [],
        ativo: true,
        correspondente_id: data.global ? null : corr,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

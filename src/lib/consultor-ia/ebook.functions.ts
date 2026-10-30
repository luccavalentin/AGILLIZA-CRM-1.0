/**
 * Server functions do e-book/FAQ do Consultor IA.
 *
 * `gerarFaqEbook` elabora o verbete estruturado (título, seções, exemplos,
 * gráficos, fontes) e `publicarFaqNaBase` grava o resultado em
 * `consultor_ia_base` para virar conhecimento pesquisável.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { MSG_SO_PLATAFORMA, podeEditarBaseGlobal } from "./consultor-ia.functions";
import type { EbookFaq } from "./ebook.server";

export type { EbookFaq, EbookSecao, EbookExemplo, EbookGrafico } from "./ebook.server";

// Gera com a IA da conta: mesma permissão de quem usa o Consultor.
export const gerarFaqEbook = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["crm.clientes", "view"])])
  .validator((d: { pergunta: string; resposta?: string | null }) =>
    z
      .object({
        pergunta: z.string().min(3).max(4000),
        resposta: z.string().max(20000).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<EbookFaq> => {
    const { supabase, userId } = context as any;
    const { gerarEbookFaq } = await import("./ebook.server");
    return gerarEbookFaq(supabase, userId, data.pergunta, data.resposta ?? null);
  });

// Gravar na base é curadoria: mesma regra da tela Base de Conhecimento.
export const publicarFaqNaBase = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.parametros", "edit"])])
  .validator((d: { ebook: unknown; global?: boolean }) =>
    z
      .object({
        ebook: z
          .object({
            titulo: z.string().min(3),
            categoria: z.string().min(1),
            tags: z.array(z.string()).optional(),
          })
          .passthrough(),
        global: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context as any;
    const { ebookParaMarkdown, normalizarEbook } = await import("./ebook.server");
    // O e-book volta da tela: normaliza de novo para não gravar formato quebrado.
    const ebook = normalizarEbook(data.ebook, data.ebook.titulo, []);

    if (data.global && !(await podeEditarBaseGlobal(supabase, userId))) {
      throw new Error(MSG_SO_PLATAFORMA);
    }

    const { data: perfil, error: erroPerfil } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    if (erroPerfil) throw new Error("Não foi possível identificar a sua conta.");
    const corr = (perfil?.correspondente_id as string | null) ?? null;
    if (!data.global && !corr) throw new Error("Conta não identificada.");

    const { data: row, error } = await supabase
      .from("consultor_ia_base")
      .insert({
        categoria: ebook.categoria,
        titulo: ebook.titulo,
        conteudo: ebookParaMarkdown(ebook),
        tags: ebook.tags ?? [],
        ativo: true,
        correspondente_id: data.global ? null : corr,
        criado_por: userId,
        atualizado_por: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

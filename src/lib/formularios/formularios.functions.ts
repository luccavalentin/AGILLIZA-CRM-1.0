import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BANCOS_FORMULARIO = [
  "itau",
  "bradesco",
  "santander",
  "inter",
  "diversos",
  "dps",
] as const;
export type BancoFormulario = (typeof BANCOS_FORMULARIO)[number];

export interface FormularioBancario {
  id: string;
  banco: BancoFormulario;
  nome: string;
  descricao: string | null;
  storage_path: string;
  content_type: string | null;
  tamanho: number | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

const bancoSchema = z.enum(BANCOS_FORMULARIO);

/** Limite físico de tamanho de PDF (25 MB) validado no servidor. */
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const PDF_MIME = "application/pdf";

function validarPdf(content_type: string | null | undefined, tamanho: number | null | undefined) {
  if (content_type && content_type !== PDF_MIME) {
    throw new Error("Apenas arquivos PDF são aceitos.");
  }
  if (typeof tamanho === "number" && tamanho > MAX_PDF_BYTES) {
    throw new Error("Arquivo excede o limite de 25 MB.");
  }
}

/** Lista todos os formulários bancários. */
export const listarFormularios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FormularioBancario[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("formularios_bancarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as FormularioBancario[];
  });

/** Registra os metadados de um formulário recém-enviado ao storage. */
export const criarFormulario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        banco: bancoSchema,
        nome: z.string().trim().min(1, "Informe um nome").max(200),
        descricao: z.string().trim().max(1000).optional().nullable(),
        storage_path: z.string().min(1),
        content_type: z.string().optional().nullable(),
        tamanho: z.number().int().nonnegative().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<FormularioBancario> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("formularios_bancarios")
      .insert({
        banco: data.banco,
        nome: data.nome,
        descricao: data.descricao ?? null,
        storage_path: data.storage_path,
        content_type: data.content_type ?? null,
        tamanho: data.tamanho ?? null,
        criado_por: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as FormularioBancario;
  });

/** Atualiza nome, descrição, banco e, opcionalmente, substitui o arquivo. */
export const atualizarFormulario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().trim().min(1, "Informe um nome").max(200),
        descricao: z.string().trim().max(1000).optional().nullable(),
        banco: bancoSchema,
        novo_storage_path: z.string().min(1).optional().nullable(),
        content_type: z.string().optional().nullable(),
        tamanho: z.number().int().nonnegative().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<FormularioBancario> => {
    const { supabase } = context;

    const { data: atual, error: erroBusca } = await supabase
      .from("formularios_bancarios")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (erroBusca) throw new Error(erroBusca.message);

    const patch: {
      nome: string;
      descricao: string | null;
      banco: BancoFormulario;
      storage_path?: string;
      content_type?: string | null;
      tamanho?: number | null;
    } = {
      nome: data.nome,
      descricao: data.descricao ?? null,
      banco: data.banco,
    };
    if (data.novo_storage_path) {
      patch.storage_path = data.novo_storage_path;
      patch.content_type = data.content_type ?? null;
      patch.tamanho = data.tamanho ?? null;
    }

    const { data: row, error } = await supabase
      .from("formularios_bancarios")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Remove o arquivo antigo depois de trocar
    if (
      data.novo_storage_path &&
      atual?.storage_path &&
      atual.storage_path !== data.novo_storage_path
    ) {
      await supabase.storage.from("formularios-bancarios").remove([atual.storage_path]);
    }

    return row as FormularioBancario;
  });

/** Exclui um formulário e o arquivo correspondente. */
export const excluirFormulario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { data: row, error: erroBusca } = await supabase
      .from("formularios_bancarios")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (erroBusca) throw new Error(erroBusca.message);

    const { error } = await supabase.from("formularios_bancarios").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    if (row?.storage_path) {
      await supabase.storage.from("formularios-bancarios").remove([row.storage_path]);
    }
    return { ok: true };
  });

/** Gera uma URL assinada temporária para visualizar/baixar o arquivo. */
export const urlFormulario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { supabase } = context;
    const { data: row, error: erroBusca } = await supabase
      .from("formularios_bancarios")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (erroBusca) throw new Error(erroBusca.message);

    const { data: signed, error } = await supabase.storage
      .from("formularios-bancarios")
      .createSignedUrl(row.storage_path, 600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

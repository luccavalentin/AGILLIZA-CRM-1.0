import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface DocumentoCentral {
  id: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  tipo_documento: string | null;
  nome_arquivo: string | null;
  categoria: string | null;
  status: string | null;
  created_at: string;
}

/** Lista os documentos recentes dos clientes (visão central, somente leitura). */
export const listarDocumentosCentral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DocumentoCentral[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("cliente_documentos")
      .select(
        "id, cliente_id, tipo_documento, nome_arquivo, categoria, status, created_at, clientes(nome)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      cliente_id: d.cliente_id,
      cliente_nome: d.clientes?.nome ?? null,
      tipo_documento: d.tipo_documento,
      nome_arquivo: d.nome_arquivo,
      categoria: d.categoria,
      status: d.status,
      created_at: d.created_at,
    }));
  });

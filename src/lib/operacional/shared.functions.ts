import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Colega {
  id: string;
  nome: string | null;
  email: string | null;
}

/** Lista membros da equipe do mesmo correspondente (para atribuição/participantes). */
export const listarColegas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Colega[]> => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.correspondente_id) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .eq("correspondente_id", me.correspondente_id)
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Colega[];
  });

export interface ClienteOpcao {
  id: string;
  nome: string | null;
  numero_cliente: string | null;
}

/** Autocomplete de clientes para vincular tarefas/demandas. */
export const buscarClientesOpcoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ q: z.string().optional() }).parse(data))
  .handler(async ({ context, data }): Promise<ClienteOpcao[]> => {
    const { supabase } = context;
    let query = supabase
      .from("clientes")
      .select("id, nome, numero_cliente")
      .order("created_at", { ascending: false })
      .limit(20);
    const q = data.q?.trim();
    if (q) query = query.or(`nome.ilike.%${q}%,numero_cliente.ilike.%${q}%`);
    const { data: itens, error } = await query;
    if (error) throw new Error(error.message);
    return (itens ?? []) as ClienteOpcao[];
  });

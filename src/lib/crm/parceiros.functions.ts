import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toTitleCase } from "@/lib/utils";

export interface ParceiroItem {
  id: string;
  profile_id: string | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  razao_social: string | null;
  creci: string | null;
  tipo_pessoa: string | null;
  percentual_comissao: number | null;
}

/** Lista os parceiros (imobiliárias e corretores) do correspondente. Somente leitura. */
export const listarParceiros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ParceiroItem[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("parceiro_detalhes")
      .select(
        "id, profile_id, razao_social, creci, tipo_pessoa, percentual_comissao, profiles!parceiro_detalhes_profile_id_fkey(nome, email, telefone)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({
      id: p.id,
      profile_id: p.profile_id,
      nome: toTitleCase(p.profiles?.nome),
      email: p.profiles?.email ?? null,
      telefone: p.profiles?.telefone ?? null,
      razao_social: toTitleCase(p.razao_social),
      creci: p.creci,
      tipo_pessoa: p.tipo_pessoa,
      percentual_comissao: p.percentual_comissao,
    }));
  });

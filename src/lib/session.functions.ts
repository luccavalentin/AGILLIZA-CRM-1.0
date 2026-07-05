import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface SessaoUsuario {
  profile: {
    id: string;
    correspondente_id: string | null;
    nome: string | null;
    email: string | null;
    telefone: string | null;
    foto_url: string | null;
    acesso_tipo: Database["public"]["Enums"]["acesso_tipo"];
    nivel_acesso_id: string | null;
    ativo: boolean;
    bloqueado_em: string | null;
    consentimento_lgpd_em: string | null;
  } | null;
  roles: AppRole[];
  podeGerenciarPessoas: boolean;
}

/**
 * Retorna o perfil, papéis e capacidades do usuário autenticado.
 * Usado no roteamento pós-login e para montar o menu interno.
 */
export const getMinhaSessao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessaoUsuario> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: roleRows }, { data: podeGerenciar }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, correspondente_id, nome, email, telefone, foto_url, acesso_tipo, nivel_acesso_id, ativo, bloqueado_em, consentimento_lgpd_em",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.rpc("pode_gerenciar_pessoas", { _user_id: userId }),
    ]);

    return {
      profile: profile ?? null,
      roles: (roleRows ?? []).map((r) => r.role as AppRole),
      podeGerenciarPessoas: Boolean(podeGerenciar),
    };
  });

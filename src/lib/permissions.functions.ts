import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MinhasPermissoes {
  /** admin/correspondente enxergam tudo, independentemente da matriz. */
  todas: boolean;
  /** Chaves no formato "modulo:acao" (ex.: "crm.clientes:view"). */
  chaves: string[];
}

/**
 * Retorna o conjunto de permissões efetivas do usuário autenticado,
 * usado por `filterNavByPermissions` para montar o menu sem flash.
 */
export const getMinhasPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MinhasPermissoes> => {
    const { supabase, userId } = context;

    const { data: temTudo } = await supabase.rpc("has_any_role", {
      _user_id: userId,
      _roles: ["admin", "correspondente", "gestor"],
    });

    // Se o usuário tem o papel de 'gestor' explicitamente em user_roles, 
    // ele deve ignorar a matriz e ter acesso total.
    if (temTudo) {
      return { todas: true, chaves: [] };
    }

    if (temTudo) {
      return { todas: true, chaves: [] };
    }

    // Junta a matriz de permissões do nível de acesso do perfil.
    const { data: perfil } = await supabase
      .from("profiles")
      .select("nivel_acesso_id")
      .eq("id", userId)
      .maybeSingle();

    if (!perfil?.nivel_acesso_id) {
      return { todas: false, chaves: [] };
    }

    const { data: rows } = await supabase
      .from("permissions")
      .select("modulo, acao, permitido")
      .eq("nivel_acesso_id", perfil.nivel_acesso_id)
      .eq("permitido", true);

    const chaves = (rows ?? []).map((r) => `${r.modulo}:${r.acao}`);
    return { todas: false, chaves };
  });

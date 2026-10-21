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

    const { data: temTudo, error: erroPapel } = await supabase.rpc("has_any_role", {
      _user_id: userId,
      // Mesma regra de `usuario_tem_permissao` no banco: só admin e correspondente
      // passam por cima da matriz. O gestor segue o nível de acesso dele — antes
      // o menu o tratava como "tudo liberado" e o servidor recusava ao clicar.
      _roles: ["admin", "correspondente"],
    });

    // Falha de leitura não pode virar "sem permissão nenhuma" (menu vazio, sem aviso):
    // o erro sobe e o shell oferece "Tentar novamente".
    if (erroPapel) throw new Error("Não foi possível carregar suas permissões.");

    if (temTudo) {
      return { todas: true, chaves: [] };
    }

    // Junta a matriz de permissões do nível de acesso do perfil.
    const { data: perfil, error: erroPerfil } = await supabase
      .from("profiles")
      .select("nivel_acesso_id")
      .eq("id", userId)
      .maybeSingle();

    if (erroPerfil) throw new Error("Não foi possível carregar suas permissões.");
    if (!perfil?.nivel_acesso_id) {
      return { todas: false, chaves: [] };
    }

    const { data: rows, error: erroMatriz } = await supabase
      .from("permissions")
      .select("modulo, acao, permitido")
      .eq("nivel_acesso_id", perfil.nivel_acesso_id)
      .eq("permitido", true);

    if (erroMatriz) throw new Error("Não foi possível carregar suas permissões.");
    const chaves = (rows ?? []).map((r) => `${r.modulo}:${r.acao}`);
    return { todas: false, chaves };
  });

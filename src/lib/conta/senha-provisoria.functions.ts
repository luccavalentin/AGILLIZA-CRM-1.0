import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Encerra a senha provisória (o próprio e-mail) depois que a pessoa definiu a dela.
 *
 * A marca mora no `app_metadata`, que o usuário não consegue escrever: só o servidor
 * a liga (cadastro, reset, habilitar login) e só aqui ela desliga. A tela de
 * Segurança chama isto logo depois de `updateUser({ password })` dar certo e de
 * recusar uma nova senha igual ao e-mail.
 */
export const concluirSenhaProvisoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      app_metadata: { senha_provisoria: false },
    });
    if (error) throw new Error("Não foi possível concluir a troca de senha.");
    return { ok: true };
  });

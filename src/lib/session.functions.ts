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

    const [
      { data: profile, error: erroPerfil },
      { data: roleRows, error: erroPapeis },
      { data: podeGerenciar },
    ] = await Promise.all([
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

    // Falha de leitura não é "perfil inexistente": o shell trataria como acesso
    // bloqueado e tiraria a pessoa do sistema. O erro sobe e vira "Tentar novamente".
    if (erroPerfil || erroPapeis) throw new Error("Não foi possível carregar seu perfil.");

    return {
      profile: profile ?? null,
      roles: (roleRows ?? []).map((r) => r.role as AppRole),
      podeGerenciarPessoas: Boolean(podeGerenciar),
    };
  });

/** Atualiza os dados básicos do próprio perfil (nome, telefone, foto). */
export const atualizarMeuPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string; telefone?: string; foto_url?: string }) =>
    z
      .object({
        nome: z.string().trim().min(2).max(120),
        telefone: z.string().trim().max(30).optional(),
        foto_url: z.string().trim().url().max(500).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        nome: data.nome,
        telefone: data.telefone || null,
        foto_url: data.foto_url || null,
      })
      .eq("id", userId);
    if (error) throw new Error("Não foi possível salvar o perfil.");
    return { ok: true };
  });

/**
 * Sincroniza o e-mail exibido no perfil após a alteração no login. Grava o e-mail que o
 * login tem de fato (Auth), não o que a tela mandou: antes qualquer pessoa trocava o
 * e-mail do próprio perfil por um qualquer, e o perfil mudava antes da confirmação.
 */
export const atualizarMeuEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(d),
  )
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth, error: erroAuth } = await supabaseAdmin.auth.admin.getUserById(userId);
    const emailDoLogin = auth?.user?.email?.trim().toLowerCase();
    if (erroAuth || !emailDoLogin) throw new Error("Não foi possível salvar o e-mail.");
    const { error } = await supabase
      .from("profiles")
      .update({ email: emailDoLogin })
      .eq("id", userId);
    if (error) throw new Error("Não foi possível salvar o e-mail.");
    return { ok: true };
  });

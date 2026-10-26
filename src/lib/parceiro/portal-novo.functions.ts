/**
 * Aviso do portal antigo do parceiro (C70): o portal do parceiro agora é o portal dos
 * assinantes do Agilliza Tech, vinculado ao correspondente. Quem já foi convertido vê que
 * o acesso novo dele está pronto; quem não foi, o convite para pedir ao correspondente.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PortalNovoParceiro {
  convertido: boolean;
  convertidoEm: string | null;
  /** Endereço de entrada do Agilliza Tech. */
  urlEntrar: string;
}

export function urlEntrarAgillizaTech(base: string | undefined): string {
  const limpa = (base ?? "https://agillizatech.com.br").trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(limpa) ? `${limpa}/entrar` : "https://agillizatech.com.br/entrar";
}

export const getPortalNovoParceiro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalNovoParceiro> => {
    const { supabase, userId } = context;
    // A RLS de parceiro_portal_novo só deixa a pessoa ler a própria linha.
    const { data } = await (supabase as any)
      .from("parceiro_portal_novo")
      .select("convertido_em")
      .eq("profile_id", userId)
      .maybeSingle();
    return {
      convertido: !!data,
      convertidoEm: (data?.convertido_em as string | undefined) ?? null,
      urlEntrar: urlEntrarAgillizaTech(process.env.CORRETOR_URL_PUBLICA),
    };
  });

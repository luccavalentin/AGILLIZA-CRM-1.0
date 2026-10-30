import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ipDoCliente } from "@/lib/http/ip-cliente";

/**
 * Trocar o e-mail de acesso pela própria pessoa (02/11/2026). A lógica e as regras estão em
 * `trocar-email.server.ts` e no banco (0601 do Corretor).
 */

async function ipDaRequisicao(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    return ipDoCliente(getRequestHeader);
  } catch {
    return null;
  }
}

/** Segurança → "Trocar e-mail de acesso": e-mail novo + senha atual. */
export const pedirTrocaDeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => {
    const x = (d ?? {}) as { email?: unknown; senha?: unknown };
    return {
      email: typeof x.email === "string" ? x.email.slice(0, 320) : "",
      senha: typeof x.senha === "string" ? x.senha.slice(0, 256) : "",
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const { pedirTroca } = await import("./trocar-email.server");
    return pedirTroca({
      authUid: context.userId,
      emailAtual: u.user?.email ?? null,
      novo: data.email,
      senha: data.senha,
      ip: await ipDaRequisicao(),
    });
  });

/** O pedido ainda pendente (e-mail novo mascarado e validade), para a tela de Segurança. */
export const minhaTrocaDeEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { minhaTrocaDeEmailNaPlataforma } = await import("@/lib/plataforma/ponte.server");
    return minhaTrocaDeEmailNaPlataforma(context.userId);
  });

/**
 * Confirmação pelo link do e-mail novo — PÚBLICA (a pessoa pode estar deslogada). O token
 * de 256 bits é a credencial; o banco confere validade, uso único e troca concorrente.
 */
export const confirmarTrocaDeEmail = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const token = (d as { token?: unknown } | null)?.token;
    return { token: typeof token === "string" ? token.slice(0, 220) : "" };
  })
  .handler(async ({ data }) => {
    const { confirmarTroca } = await import("./trocar-email.server");
    return confirmarTroca(data.token);
  });

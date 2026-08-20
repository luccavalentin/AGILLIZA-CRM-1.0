import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export interface ResumoNotificacoes {
  itens: Notificacao[];
  naoLidas: number;
}

/** Lista as últimas notificações do usuário e a contagem de não lidas.
 * Chama uma única RPC que devolve `{itens, naoLidas}` — evita ida dupla ao
 * banco a cada invalidate disparado pela subscription realtime. */
export const listarNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResumoNotificacoes> => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("listar_minhas_notificacoes");
    if (error) {
      return { itens: [], naoLidas: 0 };
    }
    const payload = (data ?? {}) as { itens?: Notificacao[]; naoLidas?: number };
    return {
      itens: (payload.itens ?? []) as Notificacao[],
      naoLidas: payload.naoLidas ?? 0,
    };
  });

/** Lista todas as notificações do usuário (para a central de notificações). */
export const listarTodasNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Notificacao[]> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notificacoes")
      .select("id, tipo, titulo, corpo, link, lida, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []) as Notificacao[];
  });

/** Marca uma notificação como lida. */
export const marcarNotificacaoLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error("Não foi possível atualizar a notificação.");
    return { ok: true };
  });

/** Marca todas as notificações do usuário como lidas. */
export const marcarTodasLidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("user_id", userId)
      .eq("lida", false);
    if (error) throw new Error("Não foi possível atualizar as notificações.");
    return { ok: true };
  });

/** Exclui uma notificação do usuário. */
export const excluirNotificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notificacoes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error("Não foi possível excluir a notificação.");
    return { ok: true };
  });

/** Limpa (exclui) todas as notificações do usuário. */
export const limparNotificacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("notificacoes").delete().eq("user_id", userId);
    if (error) throw new Error("Não foi possível limpar as notificações.");
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ChatMensagem {
  id: string;
  remetente_tipo: string;
  remetente_id: string | null;
  remetente_nome: string | null;
  mensagem: string;
  anexo_url: string | null;
  lida_em: string | null;
  criada_em: string;
}

/** Lista as mensagens do chat do App do Cliente (time ↔ cliente), com o nome completo do remetente. */
export const listarChatCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMensagem[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("cliente_app_mensagens")
      .select("id, remetente_tipo, remetente_id, mensagem, anexo_url, lida_em, criada_em")
      .eq("cliente_id", data.cliente_id)
      .order("criada_em", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const lista = (rows ?? []) as Omit<ChatMensagem, "remetente_nome">[];

    // Nome completo dos membros da equipe que enviaram mensagens
    const idsTime = Array.from(
      new Set(
        lista
          .filter((m) => m.remetente_tipo === "time" && m.remetente_id)
          .map((m) => m.remetente_id as string),
      ),
    );
    const nomes = new Map<string, string>();
    if (idsTime.length > 0) {
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", idsTime);
      for (const p of perfis ?? []) nomes.set(p.id, p.nome ?? "");
    }

    return lista.map((m) => ({
      ...m,
      remetente_nome: m.remetente_tipo === "time" ? nomes.get(m.remetente_id ?? "") ?? null : null,
    }));
  });

/** Envia uma mensagem ao cliente como time e notifica o cliente no App. */
export const responderChatCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; mensagem: string }) =>
    z
      .object({ cliente_id: z.string().uuid(), mensagem: z.string().trim().min(1).max(4000) })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMensagem> => {
    const { supabase } = context;
    const { data: nova, error } = await supabase.rpc("portal_time_responder", {
      _cid: data.cliente_id,
      _msg: data.mensagem,
      _anexo: null as unknown as string,
    });
    if (error) throw new Error(error.message);
    return nova as unknown as ChatMensagem;
  });

/** Marca como lidas as mensagens enviadas pelo cliente. */
export const marcarChatClienteLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("portal_time_marcar_lidas", { _cid: data.cliente_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

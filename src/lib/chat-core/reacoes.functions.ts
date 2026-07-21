import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Origem da mensagem. Cada valor mapeia para uma tabela específica
 * (cliente_app_mensagens, demanda_mensagens, dm_mensagens) e é usado
 * pela RLS de `chat_reacoes` para validar acesso à mensagem alvo.
 */
export type ChatOrigem = "cliente" | "demanda" | "dm";

export interface ReacaoAgrupada {
  emoji: string;
  count: number;
  mine: boolean;
  usuarios: string[];
}

/**
 * Toggle de reação por (mensagem, emoji, usuário logado).
 * A RLS de chat_reacoes já valida que o usuário tem acesso à mensagem.
 */
export const reagirMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origem: ChatOrigem; mensagem_id: string; emoji: string }) =>
    z
      .object({
        origem: z.enum(["cliente", "demanda", "dm"]),
        mensagem_id: z.string().uuid(),
        emoji: z.string().trim().min(1).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existente } = await supabase
      .from("chat_reacoes")
      .select("id")
      .eq("origem", data.origem)
      .eq("mensagem_id", data.mensagem_id)
      .eq("usuario_id", userId)
      .eq("emoji", data.emoji)
      .maybeSingle();
    if (existente) {
      const { error } = await supabase
        .from("chat_reacoes")
        .delete()
        .eq("id", (existente as any).id);
      if (error) throw new Error(error.message);
      return { toggled: "removida" as const };
    }
    const { error } = await supabase.from("chat_reacoes").insert({
      origem: data.origem,
      mensagem_id: data.mensagem_id,
      usuario_id: userId,
      emoji: data.emoji,
    });
    if (error) throw new Error(error.message);
    return { toggled: "adicionada" as const };
  });

/**
 * Agrupa reações por (mensagem_id, emoji) para uma lista de mensagens.
 * Utilizado internamente pelas server fns de listagem de cada chat.
 */
export async function carregarReacoes(
  supabase: any,
  userId: string,
  origem: ChatOrigem,
  mensagemIds: string[],
): Promise<Map<string, ReacaoAgrupada[]>> {
  const mapa = new Map<string, ReacaoAgrupada[]>();
  if (mensagemIds.length === 0) return mapa;
  const { data: rows } = await supabase
    .from("chat_reacoes")
    .select("mensagem_id, emoji, usuario_id")
    .eq("origem", origem)
    .in("mensagem_id", mensagemIds);
  const acc = new Map<string, Map<string, { count: number; mine: boolean; usuarios: string[] }>>();
  for (const r of (rows ?? []) as any[]) {
    const perMsg = acc.get(r.mensagem_id) ?? new Map();
    const cur = perMsg.get(r.emoji) ?? { count: 0, mine: false, usuarios: [] };
    cur.count += 1;
    if (r.usuario_id === userId) cur.mine = true;
    cur.usuarios.push(r.usuario_id);
    perMsg.set(r.emoji, cur);
    acc.set(r.mensagem_id, perMsg);
  }
  for (const [msgId, perEmoji] of acc.entries()) {
    const arr: ReacaoAgrupada[] = [];
    for (const [emoji, info] of perEmoji.entries()) arr.push({ emoji, ...info });
    arr.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
    mapa.set(msgId, arr);
  }
  return mapa;
}

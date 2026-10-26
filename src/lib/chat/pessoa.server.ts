/**
 * Quem está falando no chat universal — SÓ SERVIDOR.
 *
 * Dois canais, cada um com a sua prova de identidade (nada vem do corpo da requisição):
 *   · `equipe`  — login do Agilliza (token do Supabase) com a permissão `crm.chat` › ver. Vale
 *                 para a equipe e para o parceiro do portal de parceiros (que usa as mesmas
 *                 telas, liberadas pela matriz de Regras & Módulos);
 *   · `cliente` — sessão do portal do cliente (cookie assinado; o banco confere de novo que
 *                 o portal dele está liberado).
 * O resultado vai para `comChatAgilliza`, que abre o contexto do chat no banco.
 */
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";
import { paraRedeInterna } from "@/integrations/supabase/rede-interna";
import { lerSessaoCliente } from "@/lib/portal/session.server";

export type CanalChat = "equipe" | "cliente";
export type PessoaChat = { authUid: string } | { clienteId: string };

function clienteSupabase(token: string) {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) throw new Error("O chat não está configurado neste servidor.");
  return createClient<Database>(url, chave, {
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", chave);
        if (chave.startsWith("sb_") && h.get("Authorization") === `Bearer ${chave}`) h.delete("Authorization");
        return fetch(paraRedeInterna(input), { ...init, headers: h });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * `exigirChat: false` só para o @ (C01: toda pessoa do Agilliza tem o seu, mesmo sem acesso
 * ao chat).
 */
export async function pessoaDoChat(canal: CanalChat, exigirChat = true): Promise<PessoaChat> {
  if (canal === "cliente") {
    const sess = lerSessaoCliente();
    if (!sess?.cid) throw new Error("Sua sessão terminou. Entre de novo no portal.");
    return { clienteId: sess.cid };
  }
  const cabecalho = getRequest()?.headers.get("authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!token || token.split(".").length !== 3) throw new Error("Sua sessão terminou. Entre de novo.");
  const sb = clienteSupabase(token);
  const { data, error } = await sb.auth.getClaims(token);
  const uid = data?.claims?.sub;
  if (error || !uid) throw new Error("Sua sessão terminou. Entre de novo.");
  if (exigirChat) {
    const { data: pode } = await sb.rpc("usuario_tem_permissao", { _user_id: uid, _modulo: "crm.chat", _acao: "view" });
    if (!pode) throw new Error("Você não tem permissão para usar o chat.");
  }
  return { authUid: uid };
}

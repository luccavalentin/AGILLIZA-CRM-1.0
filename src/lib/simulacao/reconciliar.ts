import { useEffect } from "react";

/**
 * Disparo da reconciliação de simulações assíncronas.
 *
 * O Santander não devolve parcela/taxa no POST da integração: responde 200 e
 * o resultado chega depois. A rotina que busca esse resultado
 * (`/api/public/reconciliar-simulacoes`) existe, mas só era disparada uma vez,
 * logo após o envio — quando o banco quase nunca respondeu ainda. Sem nada
 * chamando de novo, a simulação ficava presa em "aguardando" para sempre.
 *
 * Aqui a tela assume esse papel: enquanto houver banco aguardando, ela pede a
 * reconciliação junto do seu próprio polling.
 */

/**
 * Chave publicável usada pelo endpoint para autorizar a chamada.
 *
 * Vem do ambiente, a mesma do cliente Supabase (`integrations/supabase/client.ts`).
 * Antes ficava fixa no código a chave do projeto da nuvem: no banco único da
 * VPS a chave é outra e toda chamada voltava 401 — a reconciliação nunca
 * rodava pelo navegador. Além da chave, mandamos o token do usuário logado:
 * a rota aceita qualquer um dos dois.
 */
const SUPABASE_PUBLISHABLE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

let ultimoDisparo = 0;

/**
 * Pede uma rodada de reconciliação. Silencioso por natureza: é uma tarefa de
 * fundo, e falha aqui não deve interromper a tela.
 *
 * @param intervaloMinimoMs janela de proteção contra disparos em rajada.
 */
export async function pedirReconciliacao(intervaloMinimoMs = 10000): Promise<void> {
  if (typeof window === "undefined") return;
  const agora = Date.now();
  if (agora - ultimoDisparo < intervaloMinimoMs) return;
  ultimoDisparo = agora;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (SUPABASE_PUBLISHABLE_KEY) headers.apikey = SUPABASE_PUBLISHABLE_KEY;
    // Token da sessão: autoriza a chamada mesmo se a chave do build e a do
    // servidor não baterem.
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!headers.apikey && !headers.Authorization) return;

    await fetch("/api/public/reconciliar-simulacoes", { method: "POST", headers });
  } catch (e) {
    console.error("[reconciliar] falha ao pedir reconciliação:", e);
  }
}

/** Há algum banco esperando retorno assíncrono nesta simulação? */
export function temBancoAguardando(data: any): boolean {
  return ((data?.bancos as any[]) ?? []).some(
    (b) => b?.status_banco === "aguardando" || b?.status_banco === "enviando",
  );
}

/**
 * Mantém a reconciliação rodando enquanto `ativo` for verdadeiro.
 *
 * Toda tela que exibe simulação pendente deve chamar este hook. Antes, só a
 * tela de resultado "Ambos" pedia reconciliação — uma simulação SAC simples,
 * ou vista pela lista, ficava em "Em análise" para sempre, porque nada
 * voltava a perguntar o resultado ao banco.
 *
 * O `pedirReconciliacao` já se protege de rajada (uma chamada a cada 10 s no
 * máximo, contador compartilhado no módulo), então várias telas abertas ao
 * mesmo tempo não multiplicam as requisições.
 */
export function useReconciliacaoAutomatica(ativo: boolean, intervaloMs = 12000): void {
  useEffect(() => {
    if (!ativo) return;
    void pedirReconciliacao();
    const t = setInterval(() => void pedirReconciliacao(), intervaloMs);
    return () => clearInterval(t);
  }, [ativo, intervaloMs]);
}

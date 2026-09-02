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

/** Chave publicável usada pelo endpoint para autorizar a chamada. */
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZGdkd294d2ZxYnd4bWthdGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwOTg0OTMsImV4cCI6MjA5ODY3NDQ5M30.5X1Gu_XUAqX8m6s57gcxUBoidZr3rh9w97KEuMXoffw";

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
    await fetch("/api/public/reconciliar-simulacoes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
    });
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
 * ou vista pela lista, ficava em "Em análise" para sempre, porque nada voltava
 * a perguntar o resultado ao banco.
 *
 * `pedirReconciliacao` já se protege de rajada (uma chamada a cada 10 s no
 * máximo, com contador compartilhado no módulo), então várias telas abertas ao
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

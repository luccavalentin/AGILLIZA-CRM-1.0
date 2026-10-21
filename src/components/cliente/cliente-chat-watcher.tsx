import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { clienteListarAtendentes } from "@/lib/portal/cliente.functions";
import { pollingPortal, POLL_ATENDENTES_MS } from "@/lib/portal/polling";
import {
  signalIncomingChat,
  pedirPermissaoNotificacao,
} from "@/components/shared/chat-alert-store";

/**
 * Observador global de mensagens no portal do cliente.
 *
 * O portal do cliente não usa Supabase Auth (sessão selada em cookie), portanto
 * não temos Realtime disponível — o alerta é feito por diff de polling da
 * lista de atendentes: quando o total de "não lidas" aumenta ou o horário da
 * última mensagem avança, disparamos som/pisca do menu.
 *
 * Fica montado dentro do `ClienteShell`, então funciona em qualquer tela.
 */
export function ClienteChatWatcher() {
  const { data: atendentes } = useQuery({
    queryKey: ["cliente", "atendentes"],
    queryFn: () => clienteListarAtendentes(),
    // Mesmo intervalo das outras telas (a chave é a mesma e o menor valia para
    // todas). Em segundo plano não consulta: o alerta sonoro é bloqueado pelo
    // navegador de qualquer forma.
    ...pollingPortal(POLL_ATENDENTES_MS),
  });

  useEffect(() => {
    pedirPermissaoNotificacao();
  }, []);

  const previa = useRef<Map<string, { nao_lidas: number; ultima_em: string | null }> | null>(null);

  useEffect(() => {
    if (!atendentes) return;
    // Primeira carga: apenas registra o estado inicial, sem tocar som.
    if (previa.current === null) {
      previa.current = new Map(
        atendentes.map((a) => [
          a.atendente_id,
          { nao_lidas: a.nao_lidas ?? 0, ultima_em: a.ultima_em ?? null },
        ]),
      );
      return;
    }

    const anterior = previa.current;
    for (const a of atendentes) {
      const prev = anterior.get(a.atendente_id);
      const nlAtual = a.nao_lidas ?? 0;
      const nlPrev = prev?.nao_lidas ?? 0;
      const chegou =
        nlAtual > nlPrev || (!!a.ultima_em && a.ultima_em !== prev?.ultima_em && nlAtual > 0);
      if (chegou) {
        // Id sintético estável por (atendente + timestamp) — o store dedupa.
        signalIncomingChat(`cliente:${a.atendente_id}:${a.ultima_em ?? ""}`, {
          titulo: `Nova mensagem · ${a.nome}`,
          corpo: a.ultima_mensagem ?? undefined,
        });
      }
      anterior.set(a.atendente_id, {
        nao_lidas: nlAtual,
        ultima_em: a.ultima_em ?? null,
      });
    }
  }, [atendentes]);

  return null;
}

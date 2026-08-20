import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { FloatingWindow } from "@/components/shared/pop-out-panel";
import { ThreadChat } from "@/components/cliente/chat-cliente";
import { clienteListarAtendentes, type AtendenteCliente } from "@/lib/portal/cliente.functions";
import { useChatFlash } from "@/components/shared/chat-alert-store";
import { cn } from "@/lib/utils";

/**
 * Bolha flutuante do chat do cliente. Mostra a soma de mensagens não lidas e,
 * ao clicar, abre a conversa em uma janela flutuante (arrastável, minimizável
 * e "solta"), idêntica à experiência do correspondente. Fica oculta quando o
 * cliente já está na página de chat (evita janela duplicada).
 */
export function ClienteChatFlutuante() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const esconderNaPagina = pathname.startsWith("/cliente/chat");

  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<AtendenteCliente | null>(null);

  const { data: atendentes } = useQuery({
    queryKey: ["cliente", "atendentes"],
    queryFn: () => clienteListarAtendentes(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 8000),
  });

  const totalNaoLidas = useMemo(
    () => (atendentes ?? []).reduce((s, a) => s + (a.nao_lidas ?? 0), 0),
    [atendentes],
  );

  // Ao abrir, garante um atendente selecionado (o primeiro com mensagens ou
  // simplesmente o primeiro).
  useEffect(() => {
    if (!aberto || !atendentes || atendentes.length === 0) return;
    if (!selecionado) {
      const preferido = atendentes.find((a) => (a.nao_lidas ?? 0) > 0) ?? atendentes[0];
      setSelecionado(preferido);
    } else {
      const atualizado = atendentes.find((a) => a.atendente_id === selecionado.atendente_id);
      if (atualizado && atualizado !== selecionado) setSelecionado(atualizado);
    }
  }, [aberto, atendentes, selecionado]);

  const flashing = useChatFlash();
  const [autoMinimizado, setAutoMinimizado] = useState(false);

  // Chegou mensagem em qualquer tela do portal: abre a janela MINIMIZADA no
  // meio da tela, sem interromper o que o cliente está fazendo.
  useEffect(() => {
    if (!flashing || aberto) return;
    if (!atendentes || atendentes.length === 0) return;
    setSelecionado(
      (atual) => atual ?? atendentes.find((a) => (a.nao_lidas ?? 0) > 0) ?? atendentes[0],
    );
    setAutoMinimizado(true);
    setAberto(true);
  }, [flashing, aberto, atendentes]);

  if (esconderNaPagina) return null;
  // Sem atendente disponível ainda, apenas oculta a bolha.
  if (!atendentes || atendentes.length === 0) return null;

  const podeVoltar = atendentes.length > 1;

  return (
    <>
      {/* Bolha fixa */}
      {!aberto && (
        <button
          type="button"
          onClick={() => {
            setAutoMinimizado(false);
            setAberto(true);
          }}
          aria-label="Abrir conversa com atendente"
          className={cn(
            "fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 active:scale-95",
            flashing && "chat-blink",
          )}
        >
          <MessageCircle className="h-6 w-6" />
          {totalNaoLidas > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground ring-2 ring-background">
              {totalNaoLidas > 9 ? "9+" : totalNaoLidas}
            </span>
          )}
        </button>
      )}

      {aberto && selecionado && (
        <FloatingWindow
          key={autoMinimizado ? "min" : "full"}
          title={`Conversa · ${selecionado.nome}`}
          startMinimized={autoMinimizado}
          onClose={() => {
            setAberto(false);
            setAutoMinimizado(false);
          }}
        >
          <div className="h-full min-h-[24rem]">
            <ThreadChat
              key={selecionado.atendente_id}
              atendente={selecionado}
              altura="h-full min-h-[24rem]"
              podeVoltar={podeVoltar}
              onVoltar={() => setSelecionado(null)}
              hideHeader={false}
            />
          </div>
        </FloatingWindow>
      )}
    </>
  );
}

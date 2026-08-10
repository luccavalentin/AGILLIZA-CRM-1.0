import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { PainelChatCliente } from "@/components/crm/chat-cliente/painel-cliente";
import { MaisAcoesGestao } from "@/components/crm/chat/barra-gestao";
import { useChatConversas } from "@/components/crm/chat/use-chat-conversas";
import { ListaConversas } from "@/components/crm/chat/lista-conversas";
import { PainelChat } from "@/components/crm/chat/painel-chat";

export const Route = createFileRoute("/_authenticated/crm/chat")({
  head: () => ({ meta: [{ title: "Chat e Follow-up Cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.chat", ["crm.clientes"]),
  validateSearch: (s: Record<string, unknown>) => ({
    c: typeof s.c === "string" ? s.c : undefined,
  }),
  component: Pagina,
});

function Pagina() {
  const hook = useChatConversas();
  const {
    conversas,
    filtradas,
    alvoAtual,
    etiquetas,
    etiquetasCliente,
    selecionado,
    abrirConversa,
  } = hook;

  const search = Route.useSearch();
  const autoAbertoRef = useRef<string | null>(null);
  useEffect(() => {
    if (search.c) {
      // Abre uma única vez por cliente vindo da URL — reabrir a cada render
      // brigava com o fechamento automático de conversas ocultas (laço).
      if (autoAbertoRef.current !== search.c) {
        autoAbertoRef.current = search.c;
        const alvo = (conversas ?? []).find((c) => c.cliente_id === search.c);
        abrirConversa(search.c, alvo?.atendente_id ?? null);
      }
      return;
    }
    // Auto-seleciona a primeira conversa apenas no desktop; no mobile o usuário
    // escolhe na lista (padrão master-detail) para a tela não pular direto ao chat.
    const ehDesktop =
      typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
    // Usa a lista JÁ filtrada (sem conversas ocultas/arquivadas). Selecionar
    // uma conversa oculta fazia o painel fechar e reabrir em laço.
    if (ehDesktop && !selecionado && filtradas.length > 0) {
      abrirConversa(filtradas[0].cliente_id, filtradas[0].atendente_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, filtradas, selecionado, search.c]);

  const somenteLeituraAtual = !!alvoAtual && !alvoAtual.minha && !alvoAtual.participo;
  const acoesGestao =
    alvoAtual && !somenteLeituraAtual ? (
      <MaisAcoesGestao
        key={alvoAtual.cliente_id}
        clienteId={alvoAtual.cliente_id}
        nome={alvoAtual.nome}
        documento={alvoAtual.documento}
        contexto={alvoAtual.etapa_nome ?? null}
        etiquetas={etiquetas ?? []}
      />
    ) : null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full min-w-0 flex-col overflow-hidden p-2 sm:p-3 md:p-4">
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 overflow-hidden md:gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">
        <ListaConversas hook={hook} />
        <PainelChat hook={hook} acoes={acoesGestao} />
        {alvoAtual && (
          <div className="hidden min-h-0 xl:block">
            <PainelChatCliente
              key={alvoAtual.cliente_id}
              clienteId={alvoAtual.cliente_id}
              etiquetas={etiquetasCliente.get(alvoAtual.cliente_id) ?? []}
            />
          </div>
        )}
      </div>
    </div>
  );
}

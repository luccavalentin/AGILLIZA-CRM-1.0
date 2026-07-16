import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { PainelChatCliente } from "@/components/crm/chat-cliente/painel-cliente";
import { MaisAcoesGestao } from "@/components/crm/chat/barra-gestao";
import { useChatConversas } from "@/components/crm/chat/use-chat-conversas";
import { ListaConversas } from "@/components/crm/chat/lista-conversas";
import { PainelChat } from "@/components/crm/chat/painel-chat";

export const Route = createFileRoute("/_authenticated/crm/chat")({
  head: () => ({ meta: [{ title: "Chat e Follow-up Cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  validateSearch: (s: Record<string, unknown>) => ({
    c: typeof s.c === "string" ? s.c : undefined,
  }),
  component: Pagina,
});

function Pagina() {
  const hook = useChatConversas();
  const { conversas, alvoAtual, etiquetas, etiquetasCliente, verTodos, selecionado, abrirConversa } = hook;

  const search = Route.useSearch();
  useEffect(() => {
    if (search.c) {
      const alvo = (conversas ?? []).find((c) => c.cliente_id === search.c);
      abrirConversa(search.c, alvo?.atendente_id ?? null);
      return;
    }
    // Auto-seleciona a primeira conversa apenas no desktop; no mobile o usuário
    // escolhe na lista (padrão master-detail) para a tela não pular direto ao chat.
    const ehDesktop =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches;
    if (ehDesktop && !selecionado && (conversas?.length ?? 0) > 0) {
      abrirConversa(conversas![0].cliente_id, conversas![0].atendente_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, selecionado, search.c]);

  const somenteLeituraAtual = !!alvoAtual && !alvoAtual.minha && verTodos;
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

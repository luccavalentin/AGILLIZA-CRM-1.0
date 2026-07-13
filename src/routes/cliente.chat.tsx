import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { CabecalhoPagina } from "@/components/cliente/cabecalho-pagina";
import { ChatCliente } from "@/components/cliente/chat-cliente";
import { ChatConfigSheet } from "@/components/shared/chat-config-sheet";

export const Route = createFileRoute("/cliente/chat")({
  head: () => ({ meta: [{ title: "Conversar — Meu Financiamento" }] }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="space-y-3">
      <CabecalhoPagina
        icon={MessageCircle}
        titulo="Conversar com o time"
        subtitulo="Tire dúvidas, envie documentos e acompanhe seu processo em tempo real"
        acao={<ChatConfigSheet />}
      />
      <ChatCliente />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AvisoChat } from "@/components/chat-universal/aviso-chat";
import { apiChatAgilliza } from "@/lib/chat/api-agilliza";
import type { CanalChat } from "@/lib/chat/pessoa.server";

/**
 * Aviso flutuante de mensagem (T02) no Agilliza — em todas as telas do correspondente (e do
 * parceiro, que usa as mesmas telas) e do portal do cliente, menos na do chat. Consulta
 * `chat.avisos` a cada 15 s (sem cano de eventos no Agilliza) e mostra quem mandou, com a
 * prévia tapada, Ver e Ocultar.
 */
export function AvisoChatAgilliza({
  canal,
  rotaChat,
  habilitado = true,
}: {
  canal: CanalChat;
  rotaChat: string;
  habilitado?: boolean;
}) {
  const navigate = useNavigate();
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado || !habilitado) return null;
  const naTelaDoChat = caminho === rotaChat || caminho.startsWith(`${rotaChat}/`);
  return (
    <div className="cu-tokens">
      <AvisoChat
        api={apiChatAgilliza(canal)}
        usuarioId=""
        ativo={!naTelaDoChat}
        intervaloMs={15_000}
        abrir={(id, pedidos) => {
          const busca = id ? `?c=${id}` : pedidos ? "?pedidos=1" : "";
          void navigate({ href: `${rotaChat}${busca}` });
        }}
      />
    </div>
  );
}

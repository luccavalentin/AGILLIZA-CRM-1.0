import { useEffect, useState } from "react";
import { ChatUniversal } from "@/components/chat-universal/chat-universal";
import type { DesenharIcone3D } from "@/components/chat-universal/tipos";
import { Icone3D } from "@/components/ui/icone-3d";
import { apiChatAgilliza } from "@/lib/chat/api-agilliza";
import type { CanalChat } from "@/lib/chat/pessoa.server";
import "@/components/chat-universal/chat-base.css";
import "./chat-agilliza.css";

/** A peça 3D do Agilliza (sistema 3D da frente a1) nos estados vazios e nas boas-vindas. */
const icone3D: DesenharIcone3D = (icone, tamanho, tom) => <Icone3D icone={icone} tamanho={tamanho} tom={tom ?? "marca"} />;

/**
 * O chat universal no Agilliza (C14): a MESMA tela do chat dos assinantes do Agilliza Tech,
 * com a equipe, os clientes, os parceiros e as contas da base do correspondente, e qualquer
 * pessoa pelo @. Sem cano de eventos aqui: a tela consulta a diferença a cada 4 s enquanto
 * está aberta (pela ponte, só o que mudou).
 *
 * `clienteAgillizaId`: vindo da ficha do cliente no CRM — abre (ou cria) a conversa com ele.
 */
export function ChatAgilliza({
  canal,
  inicial,
  clienteAgillizaId,
  pedidos,
  embutido,
}: {
  canal: CanalChat;
  inicial?: string | null;
  clienteAgillizaId?: string | null;
  pedidos?: boolean;
  /** Dentro de outra tela (ficha do cliente): ocupa a altura da caixa e não mexe na URL. */
  embutido?: boolean;
}) {
  const api = apiChatAgilliza(canal);
  const [aberta, setAberta] = useState<string | null | undefined>(
    clienteAgillizaId ? undefined : (inicial ?? null),
  );
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!clienteAgillizaId) return;
    let vale = true;
    void api.abrirCom({ clienteAgillizaId }).then((r) => {
      if (!vale) return;
      if (r.ok && r.dados) setAberta(r.dados);
      else {
        setErro(r.ok ? null : r.mensagem);
        setAberta(null);
      }
    });
    return () => {
      vale = false;
    };
  }, [api, clienteAgillizaId]);

  if (aberta === undefined) {
    return <div className={`cu-tokens ec-tela cu-raiz ${embutido ? "cu-host-embutido" : "cu-host-agilliza"}`} aria-busy="true" />;
  }
  return (
    <div className={embutido ? "cu-tokens h-full" : "cu-tokens"}>
      {erro && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </p>
      )}
      <ChatUniversal
        api={api}
        usuarioId=""
        inicial={aberta}
        abaInicial={pedidos ? "pedidos" : undefined}
        podeGrupo={canal !== "cliente"}
        intervaloMs={4000}
        icone3D={icone3D}
        classe={embutido ? "cu-host-embutido" : canal === "cliente" ? "cu-host-cliente" : "cu-host-agilliza"}
        titulo={canal === "cliente" ? "Conversas" : "Chat"}
        textoBoasVindas={
          canal === "cliente"
            ? "Fale com a equipe do correspondente: mensagens, fotos, vídeos, documentos e áudio, com histórico guardado."
            : "Equipe, clientes, parceiros e assinantes num lugar só — e qualquer pessoa do ecossistema pelo @. Texto, fotos, vídeos, documentos, áudio, reações e grupos."
        }
        aoAbrirConversa={(id) => {
          if (embutido) return;
          const url = new URL(window.location.href);
          if (id) url.searchParams.set("c", id);
          else url.searchParams.delete("c");
          url.searchParams.delete("cliente");
          url.searchParams.delete("pedidos");
          window.history.replaceState(window.history.state, "", url.toString());
        }}
      />
    </div>
  );
}

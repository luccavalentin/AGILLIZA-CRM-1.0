import { Archive, Pin, BellOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  ConversaMenuAcoes,
  EtiquetasPills,
} from "@/components/shared/conversa-menu-acoes";
import type { ChatTipo, EtiquetaChat } from "@/lib/chats/gestao.functions";
import type { ThreadCentral, ThreadKind } from "@/lib/chats/central.functions";
import { iniciais, tempoRelativo } from "./helpers";

/** Anel colorido por tipo (indicativo, sem badge textual). */
const RING_BY_KIND: Record<ThreadKind, string> = {
  dm: "ring-primary/70",
  cliente: "ring-emerald-500/70",
  demanda: "ring-amber-500/70",
};

const DOT_BY_KIND: Record<ThreadKind, string> = {
  dm: "bg-primary",
  cliente: "bg-emerald-500",
  demanda: "bg-amber-500",
};

export function ThreadItem({
  thread,
  selecionado,
  onClick,
  apelido,
  fixado,
  arquivado,
  etiquetas,
  etiquetaIds,
  silenciado,
}: {
  thread: ThreadCentral;
  selecionado: boolean;
  onClick: () => void;
  apelido: string | null;
  fixado: boolean;
  arquivado: boolean;
  etiquetas: EtiquetaChat[];
  etiquetaIds: string[];
  silenciado?: boolean;
}) {
  const nomeBase =
    thread.kind === "demanda"
      ? thread.interlocutor_nome?.trim() || thread.titulo || "Usuário da demanda"
      : thread.titulo;
  const nomePrincipal = apelido?.trim() || nomeBase;

  const preview =
    thread.ultima_mensagem?.trim() ||
    (thread.kind === "demanda"
      ? thread.demanda_titulo?.trim() || "Conversa sobre demanda"
      : "Diga oi 👋");

  const naoLidas = thread.nao_lidas ?? 0;

  return (
    <div
      className={cn(
        "group relative flex w-full items-center gap-3 px-3 py-2.5 transition-colors",
        "hover:bg-muted/60",
        selecionado && "bg-primary/8 hover:bg-primary/10",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 items-center gap-3 text-left focus:outline-none"
      >
        <div className="relative shrink-0">
          <Avatar
            className={cn(
              "size-11 ring-2 ring-offset-2 ring-offset-background",
              RING_BY_KIND[thread.kind],
            )}
          >
            {thread.avatar_url && <AvatarImage src={thread.avatar_url} alt={nomePrincipal} />}
            <AvatarFallback className="bg-gradient-to-br from-muted to-muted/60 text-xs font-semibold text-foreground/80">
              {iniciais(nomePrincipal)}
            </AvatarFallback>
          </Avatar>
          {/* pontinho de tipo no canto inferior */}
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-background",
              DOT_BY_KIND[thread.kind],
            )}
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={cn(
                "truncate text-[14px] leading-tight text-foreground",
                naoLidas > 0 ? "font-semibold" : "font-medium",
              )}
            >
              {nomePrincipal}
            </p>
            {fixado && <Pin className="size-3 shrink-0 text-primary" />}
            {silenciado && <BellOff className="size-3 shrink-0 text-muted-foreground" />}
            {arquivado && <Archive className="size-3 shrink-0 text-muted-foreground" />}
            <span
              className={cn(
                "ml-auto shrink-0 text-[11px] tabular-nums",
                naoLidas > 0 ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {tempoRelativo(thread.ultima_em)}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 truncate text-[13px]",
              naoLidas > 0 ? "text-foreground/85" : "text-muted-foreground",
            )}
          >
            {preview}
          </p>
          {etiquetas.length > 0 && (
            <div className="mt-1">
              <EtiquetasPills etiquetas={etiquetas} />
            </div>
          )}
        </div>
      </button>

      <div className="flex flex-col items-end gap-1.5">
        {naoLidas > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10.5px] font-bold tabular-nums text-primary-foreground shadow-sm">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
        <ConversaMenuAcoes
          chatTipo={thread.kind as ChatTipo}
          chatId={thread.id}
          arquivado={arquivado}
          fixado={fixado}
          apelidoAtual={apelido}
          nomeReferencia={nomeBase}
          etiquetaIds={etiquetaIds}
          compact
        />
      </div>
    </div>
  );
}

import { Archive, Pin, BellOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ConversaMenuAcoes, EtiquetasPills } from "@/components/shared/conversa-menu-acoes";
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
        "group relative mx-1.5 my-0.5 flex w-[calc(100%-0.75rem)] items-center gap-2.5 rounded-2xl px-2.5 py-2 transition-[background-color,box-shadow] duration-200",
        "hover:bg-muted/50",
        selecionado && "bg-primary/[0.07] hover:bg-primary/10",
      )}
    >
      {/* Barra de destaque da conversa ativa */}
      <span
        className={cn(
          "absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
          selecionado ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />

      <button
        type="button"
        data-depth="off"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-transparent text-left shadow-none outline-none transition-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="relative shrink-0">
          <Avatar
            className={cn(
              "size-10 ring-1 ring-offset-2 ring-offset-background",
              RING_BY_KIND[thread.kind],
            )}
          >
            {thread.avatar_url && <AvatarImage src={thread.avatar_url} alt={nomePrincipal} />}
            <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground/70">
              {iniciais(nomePrincipal)}
            </AvatarFallback>
          </Avatar>
          {/* pontinho de tipo no canto inferior */}
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background",
              DOT_BY_KIND[thread.kind],
            )}
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={cn(
                "truncate text-[13.5px] leading-tight text-foreground",
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
                "ml-auto shrink-0 text-[10.5px] tabular-nums",
                naoLidas > 0 ? "font-semibold text-primary" : "text-muted-foreground/80",
              )}
            >
              {tempoRelativo(thread.ultima_em)}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 truncate text-[12.5px] leading-snug",
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

      <div className="flex shrink-0 flex-col items-end gap-1">
        {naoLidas > 0 && (
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold tabular-nums text-primary-foreground">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
        <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 data-[aberto=true]:opacity-100">
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
    </div>
  );
}

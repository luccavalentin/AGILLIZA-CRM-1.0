import { Archive, Pin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ConversaMenuAcoes,
  EtiquetasPills,
} from "@/components/shared/conversa-menu-acoes";
import type { ChatTipo, EtiquetaChat } from "@/lib/chats/gestao.functions";
import type { ThreadCentral, ThreadKind } from "@/lib/chats/central.functions";
import { RÓTULOS, iniciais, tempoRelativo } from "./helpers";

export function ThreadItem({
  thread,
  selecionado,
  onClick,
  apelido,
  fixado,
  arquivado,
  etiquetas,
  etiquetaIds,
}: {
  thread: ThreadCentral;
  selecionado: boolean;
  onClick: () => void;
  apelido: string | null;
  fixado: boolean;
  arquivado: boolean;
  etiquetas: EtiquetaChat[];
  etiquetaIds: string[];
}) {
  const rot = RÓTULOS[thread.kind];
  const Icon = rot.icon;

  const nomeBase =
    thread.kind === "demanda"
      ? thread.interlocutor_nome?.trim() || thread.titulo || "Usuário da demanda"
      : thread.titulo;
  const nomePrincipal = apelido?.trim() || nomeBase;

  const contexto =
    thread.kind === "demanda"
      ? [thread.subtitulo?.trim(), thread.demanda_titulo?.trim()]
          .filter(Boolean)
          .join(" · ") || null
      : null;

  const badgeClasses: Record<ThreadKind, string> = {
    dm: "bg-primary text-primary-foreground",
    cliente: "bg-success text-success-foreground",
    demanda: "bg-warning text-warning-foreground",
  };

  return (
    <div
      className={cn(
        "group relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
        selecionado && "bg-primary/10 hover:bg-primary/10",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 items-start gap-3 text-left"
      >
        <Avatar className="size-10 border border-border/60">
          {thread.avatar_url && <AvatarImage src={thread.avatar_url} alt={nomePrincipal} />}
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {iniciais(nomePrincipal)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                badgeClasses[thread.kind],
              )}
            >
              <Icon className="size-3" />
              {rot.label}
            </span>
            {fixado && <Pin className="size-3 text-primary" />}
            {arquivado && <Archive className="size-3 text-muted-foreground" />}
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {tempoRelativo(thread.ultima_em)}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-foreground">
            {thread.kind === "demanda" ? `Conversando com ${nomePrincipal}` : nomePrincipal}
          </p>
          {contexto && (
            <p className="truncate text-[11px] text-muted-foreground/90">{contexto}</p>
          )}
          <p className="truncate text-xs text-muted-foreground">
            {thread.ultima_mensagem?.trim() || "Sem mensagens ainda"}
          </p>
          {etiquetas.length > 0 && (
            <div className="mt-1">
              <EtiquetasPills etiquetas={etiquetas} />
            </div>
          )}
        </div>
      </button>
      <div className="flex flex-col items-end gap-1">
        {thread.nao_lidas > 0 && (
          <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
            {thread.nao_lidas}
          </Badge>
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

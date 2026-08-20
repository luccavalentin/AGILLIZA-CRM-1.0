import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatConversaCore } from "@/components/shared/chat-core/chat-conversa";
import { useAdaptadorDm } from "@/components/shared/chat-core/adapters/dm";
import { obterDm } from "@/lib/chats/central.functions";
import { cn } from "@/lib/utils";

function iniciais(nome?: string | null): string {
  if (!nome) return "?";
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Conversa 1:1 entre usuários internos. Reescrita sobre o núcleo unificado
 * de chat (ChatConversaCore) via `useAdaptadorDm`. Ganha automaticamente
 * envio otimista, realtime, "digitando" e recibos de leitura — mantendo o
 * mesmo visual das outras conversas (cliente e demanda).
 */
export function DmConversa({ conversaId }: { conversaId: string }) {
  const obterFn = useServerFn(obterDm);

  const { data: meta } = useQuery({
    queryKey: ["dm-meta", conversaId],
    queryFn: () => obterFn({ data: { conversa_id: conversaId } }),
    staleTime: 30_000,
  });

  const outro = meta?.outro ?? null;
  const info = useMemo(
    () => ({ nome: outro?.nome ?? null, foto_url: outro?.foto_url ?? null }),
    [outro?.nome, outro?.foto_url],
  );

  const renderHeader: React.ComponentProps<typeof ChatConversaCore>["adapter"]["renderHeader"] = ({
    buscaAberta,
    toggleBusca,
    buscaMsg,
    setBuscaMsg,
  }) => (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b bg-card px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <Avatar className="size-10 border border-border/60">
          {outro?.foto_url && <AvatarImage src={outro.foto_url} alt={outro.nome ?? ""} />}
          <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
            {iniciais(outro?.nome)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {outro?.nome ?? "Conversa"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {outro?.email ?? "Mensagem direta"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-9 shrink-0 rounded-lg text-muted-foreground",
              buscaAberta && "bg-accent text-foreground",
            )}
            onClick={toggleBusca}
            title="Buscar na conversa"
            aria-label="Buscar na conversa"
          >
            <Search className="size-4" />
          </Button>
        </div>
      </div>

      {buscaAberta && (
        <div className="border-b bg-muted/20 p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={buscaMsg}
              onChange={(e) => setBuscaMsg(e.target.value)}
              placeholder="Buscar mensagens nesta conversa…"
              className="h-9 rounded-lg bg-background pl-8"
            />
          </div>
        </div>
      )}
    </>
  );

  const adapter = useAdaptadorDm({ conversaId, info, renderHeader });

  return <ChatConversaCore adapter={adapter} />;
}

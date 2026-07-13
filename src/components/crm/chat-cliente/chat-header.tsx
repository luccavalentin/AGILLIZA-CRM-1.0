import { Link } from "@tanstack/react-router";
import { Search, Star, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { iniciais, type ChatClienteInfo } from "./utils";

export function ChatClienteHeader({
  info,
  clienteId,
  buscaAberta,
  toggleBusca,
  buscaMsg,
  setBuscaMsg,
}: {
  info?: ChatClienteInfo;
  clienteId?: string;
  buscaAberta: boolean;
  toggleBusca: () => void;
  buscaMsg: string;
  setBuscaMsg: (v: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-semibold text-primary-foreground shadow-sm">
          {iniciais(info?.nome)}
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {info?.nome ?? "Conversa com o cliente"}
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Ativo agora
            </span>
            <Badge
              variant="secondary"
              className="h-5 rounded-full px-2 text-[10px] font-medium"
            >
              Cliente
            </Badge>
            {info?.documento && (
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                · {info.documento}
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          onClick={toggleBusca}
          title="Buscar na conversa"
        >
          <Search className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          title="Favoritar conversa"
        >
          <Star className="size-4" />
        </Button>
        {clienteId && (
          <Button
            asChild
            type="button"
            variant="outline"
            size="sm"
            className="hidden shrink-0 gap-1.5 rounded-lg sm:inline-flex"
          >
            <Link to="/crm/clientes/$id" params={{ id: clienteId }}>
              <UserRound className="size-4" />
              Ver cliente
            </Link>
          </Button>
        )}
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
}

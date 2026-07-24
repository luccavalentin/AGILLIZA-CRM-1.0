import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Star, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { iniciais, type ChatClienteInfo } from "./utils";

export function ChatClienteHeader({
  info,
  clienteId,
  acoes,
  buscaAberta,
  toggleBusca,
  buscaMsg,
  setBuscaMsg,
}: {
  info?: ChatClienteInfo;
  clienteId?: string;
  acoes?: ReactNode;
  buscaAberta: boolean;
  toggleBusca: () => void;
  buscaMsg: string;
  setBuscaMsg: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b bg-card px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-semibold text-primary-foreground shadow-sm ring-2 ring-background">
          {iniciais(info?.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {info?.nome ?? "Conversa com o cliente"}
          </p>
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <Badge
              variant="secondary"
              className="h-5 rounded-full px-2 text-[10px] font-medium"
            >
              Cliente
            </Badge>
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 overflow-hidden sm:gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-lg text-muted-foreground"
            onClick={toggleBusca}
            title="Buscar na conversa"
          >
            <Search className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden size-9 shrink-0 rounded-lg text-muted-foreground sm:inline-flex"
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
          {acoes}
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
}

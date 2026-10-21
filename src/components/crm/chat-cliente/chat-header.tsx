import { type ReactNode } from "react";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Star, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listarEstadoChatDoUsuario, fixarConversa } from "@/lib/chats/gestao.functions";
import { iniciais, type ChatClienteInfo } from "./utils";
import { exibirDocumento } from "@/lib/crm/documento";

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
  const qc = useQueryClient();
  const listar = useServerFn(listarEstadoChatDoUsuario);
  const fixar = useServerFn(fixarConversa);

  const { data: estados } = useQuery({
    queryKey: ["chat-estado-usuario"],
    queryFn: () => listar(),
  });

  const linhaContexto = [info?.documento ? exibirDocumento(info.documento) : null, info?.contexto]
    .filter(Boolean)
    .join(" · ");

  const fixado = !!(
    clienteId &&
    (estados ?? []).some(
      (e) => e.chat_tipo === "cliente" && e.chat_id === clienteId && !!e.pinado_em,
    )
  );

  const mFixar = useMutation({
    mutationFn: () =>
      fixar({
        data: { chat_tipo: "cliente", chat_id: clienteId!, fixar: !fixado },
      }),
    onSuccess: () => {
      toast.success(fixado ? "Conversa desafixada." : "Conversa fixada no topo.");
      qc.invalidateQueries({ queryKey: ["chat-estado-usuario"] });
      qc.invalidateQueries({ queryKey: ["conversas-cliente"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível fixar a conversa.")),
  });

  return (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b bg-gradient-to-r from-card to-muted/20 px-4 py-4 sm:gap-6 sm:px-6">
        <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-[var(--brand-azul-escuro)] text-base font-bold text-primary-foreground shadow-[0_4px_12px_-4px_rgba(var(--primary),0.5)] ring-2 ring-background">
          {/* Sem a bolinha verde "online": ficava acesa sempre, sem presença real. */}
          {iniciais(info?.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold tracking-tight text-foreground">
            {info?.nome ?? "Cliente"}
          </p>
          {linhaContexto && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{linhaContexto}</p>
          )}
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 overflow-hidden sm:gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-lg text-muted-foreground"
            onClick={toggleBusca}
            title={buscaAberta ? "Fechar busca" : "Buscar na conversa"}
            aria-label={buscaAberta ? "Fechar busca" : "Buscar na conversa"}
            aria-pressed={buscaAberta}
          >
            <Search className="size-4" />
          </Button>
          {clienteId && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-9 shrink-0 rounded-lg",
                fixado ? "text-amber-500 hover:text-amber-500" : "text-muted-foreground",
              )}
              onClick={() => mFixar.mutate()}
              disabled={mFixar.isPending}
              title={fixado ? "Desafixar conversa" : "Fixar conversa no topo"}
              aria-label={fixado ? "Desafixar conversa" : "Fixar conversa no topo"}
              aria-pressed={fixado}
            >
              <Star className={cn("size-4", fixado && "fill-current")} />
            </Button>
          )}
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

import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { SwipeToDelete } from "@/components/app-shell/swipe-to-delete";
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasLidas,
  excluirNotificacao,
  limparNotificacoes,
  type Notificacao,
} from "@/lib/notificacoes.functions";
import { playNotificationSound } from "@/lib/chat-sound";
import { categoriaDeTipo, tipoAtivo, tipoComSom } from "@/lib/notification-prefs";

function formatarData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",  
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface NotificationsBellProps {
  userId: string;
}

/** Sino de notificações com contagem em tempo real e popover das últimas 10. */
export function NotificationsBell({ userId }: NotificationsBellProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: () => listarNotificacoes(),
    // A frescor é mantida pela subscription realtime (com debounce), então
    // evitamos refetches por "stale"/remontagem: só recarrega via realtime.
    staleTime: 5 * 60_000,
  });

  // Toca som para notificações novas conforme as preferências por tipo.
  // (Mensagens de chat têm alerta próprio e são ignoradas aqui p/ evitar duplicidade.)
  const notifVistas = useRef<Set<string> | null>(null);
  // Reseta ao trocar de usuário para não herdar o estado "visto" da conta anterior.
  useEffect(() => {
    notifVistas.current = null;
  }, [userId]);
  useEffect(() => {
    const itens = data?.itens ?? [];
    if (notifVistas.current === null) {
      notifVistas.current = new Set(itens.map((n) => n.id));
      return;
    }
    for (const n of itens) {
      if (notifVistas.current.has(n.id)) continue;
      notifVistas.current.add(n.id);
      if (n.lida) continue;
      const cat = categoriaDeTipo(n.tipo);
      if (cat === "chat") continue;
      if (tipoAtivo(cat) && tipoComSom(cat)) playNotificationSound();
    }
  }, [data?.itens]);



  // Subscription realtime: revalida a lista a cada novo evento.
  // Eventos em rajada (ex.: várias notificações criadas de uma vez) são
  // coalescidos num único invalidate para não sobrecarregar a query.
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const agendarInvalidacao = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      }, 400);
    };
    const canal = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        agendarInvalidacao,
      )
      .subscribe();

    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(canal);
    };
  }, [userId, queryClient]);

  const marcarLida = useMutation({
    mutationFn: (id: string) => marcarNotificacaoLida({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const marcarTodas = useMutation({
    mutationFn: () => marcarTodasLidas(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirNotificacao({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const limpar = useMutation({
    mutationFn: () => limparNotificacoes(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const naoLidas = data?.naoLidas ?? 0;
  const itens = data?.itens ?? [];
  const itensNaoLidos = itens.filter((n) => !n.lida);
  const itensLidos = itens.filter((n) => n.lida);

  function aoClicar(n: Notificacao) {
    if (!n.lida) marcarLida.mutate(n.id);
    if (n.link) navigate({ to: n.link as string });
  }

  function renderItem(n: Notificacao) {
    return (
      <li key={n.id}>
        <SwipeToDelete onDelete={() => excluir.mutate(n.id)}>
          <button
            type="button"
            onClick={() => aoClicar(n)}
            className={cn(
              "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
              n.lida ? "bg-popover" : "bg-accent",
            )}
          >
            <div className="flex items-center gap-2">
              {!n.lida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              <span className="text-sm font-medium text-foreground">{n.titulo}</span>
            </div>
            {n.corpo && (
              <span className="line-clamp-2 text-xs text-muted-foreground">{n.corpo}</span>
            )}
            <span className="text-[11px] text-muted-foreground">{formatarData(n.created_at)}</span>
          </button>
        </SwipeToDelete>
      </li>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-11 min-w-11 sm:min-h-10 sm:min-w-10"
          aria-label={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : "Notificações"}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {naoLidas > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {naoLidas > 9 ? "9+" : naoLidas}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Notificações</span>
          <div className="flex items-center gap-1">
            {naoLidas > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={() => marcarTodas.mutate()}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" /> Marcar todas
              </Button>
            )}
            {itens.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => limpar.mutate()}
                disabled={limpar.isPending}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {itens.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Você não tem notificações.
            </p>
          ) : (
            <div>
              {itensNaoLidos.length > 0 && (
                <>
                  <p className="bg-muted/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Não lidas
                  </p>
                  <ul className="divide-y">{itensNaoLidos.map(renderItem)}</ul>
                </>
              )}
              {itensLidos.length > 0 && (
                <>
                  <p className="bg-muted/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Lidas
                  </p>
                  <ul className="divide-y">{itensLidos.map(renderItem)}</ul>
                </>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-sm"
            onClick={() => navigate({ to: "/admin/notificacoes" as string })}
          >
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

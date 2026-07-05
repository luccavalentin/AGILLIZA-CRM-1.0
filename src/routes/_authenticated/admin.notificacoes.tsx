import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { SwipeToDelete } from "@/components/app-shell/swipe-to-delete";
import {
  listarTodasNotificacoes,
  marcarNotificacaoLida,
  marcarTodasLidas,
  excluirNotificacao,
  type Notificacao,
} from "@/lib/notificacoes.functions";

export const Route = createFileRoute("/_authenticated/admin/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Agilliza" }] }),
  component: Pagina,
});

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Pagina() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["notificacoes", "todas"],
    queryFn: () => listarTodasNotificacoes(),
  });

  useEffect(() => {
    const canal = supabase
      .channel("notif:central")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
          queryClient.invalidateQueries({ queryKey: ["notificacoes", "todas"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [queryClient]);

  const marcarLida = useMutation({
    mutationFn: (id: string) => marcarNotificacaoLida({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      queryClient.invalidateQueries({ queryKey: ["notificacoes", "todas"] });
    },
  });

  const marcarTodas = useMutation({
    mutationFn: () => marcarTodasLidas(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      queryClient.invalidateQueries({ queryKey: ["notificacoes", "todas"] });
    },
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirNotificacao({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      queryClient.invalidateQueries({ queryKey: ["notificacoes", "todas"] });
    },
  });

  const naoLidas = itens.filter((n) => !n.lida);
  const lidas = itens.filter((n) => n.lida);

  function aoClicar(n: Notificacao) {
    if (!n.lida) marcarLida.mutate(n.id);
    if (n.link) navigate({ to: n.link as string });
  }

  function renderItem(n: Notificacao) {
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => aoClicar(n)}
        className={cn(
          "flex w-full flex-col gap-1 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
          n.lida ? "bg-card" : "bg-accent/60",
        )}
      >
        <div className="flex items-center gap-2">
          {!n.lida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          <span className="text-sm font-medium text-foreground">{n.titulo}</span>
        </div>
        {n.corpo && <span className="text-xs text-muted-foreground">{n.corpo}</span>}
        <span className="text-[11px] text-muted-foreground">{formatarData(n.created_at)}</span>
      </button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Notificações</h1>
        </div>
        {naoLidas.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => marcarTodas.mutate()}>
            <CheckCheck className="mr-1 h-4 w-4" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : itens.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Você não tem notificações.
        </Card>
      ) : (
        <div className="space-y-6">
          {naoLidas.length > 0 && (
            <Card className="overflow-hidden">
              <p className="border-b bg-muted/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Não lidas ({naoLidas.length})
              </p>
              {naoLidas.map(renderItem)}
            </Card>
          )}
          {lidas.length > 0 && (
            <Card className="overflow-hidden">
              <p className="border-b bg-muted/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Lidas
              </p>
              {lidas.map(renderItem)}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

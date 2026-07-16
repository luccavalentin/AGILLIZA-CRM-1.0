import { AdminHero } from "@/components/admin/admin-hero";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCheck, Trash2, Settings2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationSettings } from "@/components/shared/notification-settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { SwipeToDelete } from "@/components/app-shell/swipe-to-delete";
import {
  listarTodasNotificacoes,
  marcarNotificacaoLida,
  marcarTodasLidas,
  excluirNotificacao,
  limparNotificacoes,
  type Notificacao,
} from "@/lib/notificacoes.functions";

export const Route = createFileRoute("/_authenticated/admin/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Agilliza" }] }),
  component: Pagina,
});

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  
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
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
        queryClient.invalidateQueries({ queryKey: ["notificacoes", "todas"] });
      })
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

  const limpar = useMutation({
    mutationFn: () => limparNotificacoes(),
    onSuccess: () => {
      toast.success("Notificações limpas.");
      queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      queryClient.invalidateQueries({ queryKey: ["notificacoes", "todas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao limpar."),
  });

  const naoLidas = itens.filter((n) => !n.lida);
  const lidas = itens.filter((n) => n.lida);

  function aoClicar(n: Notificacao) {
    if (!n.lida) marcarLida.mutate(n.id);
    if (n.link) navigate({ to: n.link as string });
  }

  function renderItem(n: Notificacao) {
    return (
      <SwipeToDelete key={n.id} onDelete={() => excluir.mutate(n.id)}>
        <button
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
      </SwipeToDelete>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<Bell className="h-5 w-5" />}
        titulo="Notificações"
        descricao="Central de avisos do sistema e preferências de alerta."
      />

      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lista">
            <Inbox className="mr-1.5 h-4 w-4" /> Notificações
            {naoLidas.length > 0 && (
              <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {naoLidas.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings2 className="mr-1.5 h-4 w-4" /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
          {(naoLidas.length > 0 || itens.length > 0) && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {naoLidas.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => marcarTodas.mutate()}>
                  <CheckCheck className="mr-1 h-4 w-4" /> Marcar todas como lidas
                </Button>
              )}
              {itens.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={limpar.isPending}>
                      <Trash2 className="mr-1 h-4 w-4" /> Limpar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar notificações?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Todas as suas notificações serão excluídas permanentemente. Esta ação não pode
                        ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => limpar.mutate()}>
                        Limpar tudo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}

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
        </TabsContent>

        <TabsContent value="config">
          <p className="mb-4 text-sm text-muted-foreground">
            Defina quais alertas você quer receber e quais devem tocar som. As preferências valem
            neste navegador.
          </p>
          <NotificationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  listarChatCliente,
  responderChatCliente,
  marcarChatClienteLido,
} from "@/lib/crm/chat-cliente.functions";

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface ChatClienteInfo {
  nome: string;
  documento?: string | null;
  email?: string | null;
  celular?: string | null;
  contexto?: string | null;
}

/** Chat interno: equipe conversa com o cliente pelas mensagens do App do Cliente. */
export function ChatClienteTab({ clienteId, info }: { clienteId: string; info?: ChatClienteInfo }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarChatCliente);
  const responder = useServerFn(responderChatCliente);
  const marcarLido = useServerFn(marcarChatClienteLido);
  const [texto, setTexto] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const queryKey = ["chat-cliente", clienteId];
  const { data: mensagens, isLoading } = useQuery({
    queryKey,
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
  });

  useEffect(() => {
    marcarLido({ data: { cliente_id: clienteId } }).catch(() => {});
  }, [clienteId, marcarLido, mensagens?.length]);

  useEffect(() => {
    const canal = supabase
      .channel(`chat-cli:${clienteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cliente_app_mensagens",
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, qc]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens?.length]);

  const enviar = useMutation({
    mutationFn: (mensagem: string) => responder({ data: { cliente_id: clienteId, mensagem } }),
    onSuccess: () => {
      setTexto("");
      qc.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Não foi possível enviar a mensagem."),
  });

  function submeter() {
    const t = texto.trim();
    if (!t) return;
    enviar.mutate(t);
  }

  return (
    <Card className="flex h-[32rem] flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {info?.nome ?? "Conversa com o cliente"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[info?.documento, info?.celular, info?.email, info?.contexto]
              .filter(Boolean)
              .join(" · ") || "App do Cliente"}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-2/3" />
          </div>
        ) : (mensagens?.length ?? 0) === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Envie a primeira mensagem ao cliente.
          </p>
        ) : (
          mensagens!.map((m) => {
            const doTime = m.remetente_tipo === "time";
            return (
              <div key={m.id} className={cn("flex", doTime ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    doTime
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.mensagem}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      doTime ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {doTime ? m.remetente_nome || "Equipe" : info?.nome || "Cliente"} ·{" "}
                    {formatarHora(m.criada_em)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submeter();
            }
          }}
          placeholder="Escreva uma mensagem para o cliente…"
          className="min-h-[44px] max-h-32 resize-none"
        />
        <Button
          onClick={submeter}
          disabled={enviar.isPending || !texto.trim()}
          size="icon"
          className="h-11 w-11 shrink-0"
        >
          {enviar.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </Card>
  );
}

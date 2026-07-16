import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCheck, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { supabase } from "@/integrations/supabase/client";
import {
  enviarMensagemDm,
  listarMensagensDm,
  marcarDmLida,
  obterDm,
} from "@/lib/chats/central.functions";
import { getMinhaSessao } from "@/lib/session.functions";
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

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmo = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (mesmo(d, hoje)) return "Hoje";
  if (mesmo(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Conversa 1:1 entre usuários internos. Design idêntico ao chat de cliente e
 * de demanda (mesmas bolhas, mesmo composer).
 */
export function DmConversa({ conversaId }: { conversaId: string }) {
  const qc = useQueryClient();
  const listarFn = useServerFn(listarMensagensDm);
  const enviarFn = useServerFn(enviarMensagemDm);
  const marcarFn = useServerFn(marcarDmLida);
  const obterFn = useServerFn(obterDm);
  const sessaoFn = useServerFn(getMinhaSessao);
  const fimRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState("");

  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => sessaoFn(),
    staleTime: 5 * 60_000,
  });
  const meuId = sessao?.profile?.id ?? null;
  const meuNome = sessao?.profile?.nome?.trim() || "Eu";

  const queryKey = useMemo(() => ["dm", conversaId] as const, [conversaId]);
  const metaKey = useMemo(() => ["dm-meta", conversaId] as const, [conversaId]);

  const { data: meta } = useQuery({
    queryKey: metaKey,
    queryFn: () => obterFn({ data: { conversa_id: conversaId } }),
  });

  const { data: mensagens, isLoading } = useQuery({
    queryKey,
    queryFn: () => listarFn({ data: { conversa_id: conversaId } }),
  });

  // Realtime
  useEffect(() => {
    const canal = supabase
      .channel(`dm:${conversaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_mensagens",
          filter: `conversa_id=eq.${conversaId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey });
          qc.invalidateQueries({ queryKey: ["threads-central"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [conversaId, qc, queryKey]);

  // Marca lida ao abrir/receber
  useEffect(() => {
    if (!mensagens?.length) return;
    marcarFn({ data: { conversa_id: conversaId } })
      .then(() => qc.invalidateQueries({ queryKey: ["threads-central"] }))
      .catch(() => {});
  }, [conversaId, mensagens?.length, marcarFn, qc]);

  const items = useMemo(
    () => (mensagens ?? []).map((m) => ({ id: m.id, mine: m.autor_id === meuId })),
    [mensagens, meuId],
  );
  useIncomingChatSound(items, conversaId);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens?.length]);

  const enviar = useMutation({
    mutationFn: (t: string) => enviarFn({ data: { conversa_id: conversaId, texto: t } }),
    onMutate: async (t) => {
      await qc.cancelQueries({ queryKey });
      const anterior = qc.getQueryData<any[]>(queryKey);
      const otimista = {
        id: `otimista-${crypto.randomUUID()}`,
        autor_id: meuId,
        autor_nome: meuNome,
        autor_foto: null,
        texto: t,
        anexo_url: null,
        anexo_nome: null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData(queryKey, [...(anterior ?? []), otimista]);
      setTexto("");
      return { anterior };
    },
    onError: (err, _t, ctx) => {
      if (ctx?.anterior) qc.setQueryData(queryKey, ctx.anterior);
      toast.error(err instanceof Error ? err.message : "Falha ao enviar mensagem.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["threads-central"] });
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
  });

  function submeter() {
    const t = texto.trim();
    if (!t || enviar.isPending) return;
    enviar.mutate(t);
  }

  const outro = meta?.outro ?? null;

  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-border/60 shadow-sm">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b bg-card px-4 py-3">
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
      </div>

      <div className="chat-surface min-w-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-12 w-2/3 rounded-2xl bg-muted" />
            <div className="ml-auto h-12 w-2/3 rounded-2xl bg-muted" />
          </div>
        ) : !mensagens?.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="size-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Comece a conversa</p>
              <p className="text-xs text-muted-foreground">
                Envie a primeira mensagem para {outro?.nome?.split(" ")[0] ?? "seu colega"}.
              </p>
            </div>
          </div>
        ) : (
          mensagens.map((m, i) => {
            const minha = m.autor_id === meuId;
            const anterior = mensagens[i - 1];
            const proxima = mensagens[i + 1];
            const mostrarDia =
              !anterior || formatarDia(anterior.created_at) !== formatarDia(m.created_at);
            const mesmoAutorAntes = !mostrarDia && anterior?.autor_id === m.autor_id;
            const mesmoAutorDepois =
              proxima?.autor_id === m.autor_id &&
              formatarDia(proxima?.created_at ?? "") === formatarDia(m.created_at);
            const otimista = String(m.id).startsWith("otimista-");
            return (
              <div key={m.id}>
                {mostrarDia && (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full bg-background/80 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground shadow-sm ring-1 ring-border/50 backdrop-blur">
                      {formatarDia(m.created_at)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "group flex min-w-0 items-end gap-1.5 sm:gap-2",
                    minha ? "justify-end" : "justify-start",
                    mesmoAutorAntes ? "mt-0.5" : "mt-2",
                  )}
                >
                  {!minha && (
                    <div
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary",
                        mesmoAutorDepois && "invisible",
                      )}
                      aria-hidden={mesmoAutorDepois}
                    >
                      {iniciais(m.autor_nome)}
                    </div>
                  )}
                  <div
                    className={cn(
                      "chat-bubble min-w-0 max-w-[calc(100%-3.25rem)] overflow-hidden px-3 py-2 text-sm sm:max-w-[78%] sm:px-3.5",
                      minha
                        ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-2xl rounded-bl-md border border-chat-them-border bg-chat-them text-chat-them-foreground",
                      mesmoAutorAntes && (minha ? "rounded-tr-md" : "rounded-tl-md"),
                    )}
                  >
                    {!mesmoAutorAntes && !minha && (
                      <p className="mb-0.5 text-[11px] font-semibold text-chat-them-foreground/80">
                        {m.autor_nome ?? "Usuário"}
                      </p>
                    )}
                    {m.texto && (
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.texto}</p>
                    )}
                    <div
                      className={cn(
                        "mt-1 flex items-center justify-end gap-1 text-[10px]",
                        minha ? "text-primary-foreground/70" : "text-chat-them-foreground/60",
                      )}
                    >
                      <span>{formatarHora(m.created_at)}</span>
                      {minha && (
                        <span title={otimista ? "Enviando" : "Enviado"}>
                          {otimista ? (
                            <Check className="size-3.5" />
                          ) : (
                            <CheckCheck className="size-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      <div className="border-t border-border/60 bg-card">
        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submeter();
            }
          }}
          placeholder="Digite sua mensagem…"
          className="min-h-[3.25rem] max-h-40 min-w-0 resize-none rounded-none border-0 bg-transparent px-3 py-3 text-sm shadow-none focus-visible:ring-0 sm:px-4"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2.5 sm:px-3 sm:pb-3">
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Enter envia · Shift + Enter quebra linha
          </p>
          <Button
            type="button"
            onClick={submeter}
            disabled={enviar.isPending || !texto.trim()}
            className="ml-auto h-10 gap-2 rounded-lg px-4"
            title="Enviar"
          >
            {enviar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Enviar
          </Button>
        </div>
      </div>
    </Card>
  );
}

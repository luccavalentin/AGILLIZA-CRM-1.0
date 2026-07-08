import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2, MessageCircle, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PopOutPanel } from "@/components/shared/pop-out-panel";
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { supabase } from "@/integrations/supabase/client";
import {
  listarChatCliente,
  responderChatCliente,
  marcarChatClienteLido,
  type ChatMensagem,
} from "@/lib/crm/chat-cliente.functions";
import { getMinhaSessao } from "@/lib/session.functions";

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function iniciais(nome?: string | null): string {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}


export interface ChatClienteInfo {
  nome: string;
  documento?: string | null;
  email?: string | null;
  celular?: string | null;
  contexto?: string | null;
}

/** Corpo da conversa (cabeçalho, mensagens e composer), sem casca flutuante. */
export function ChatClienteConversa({ clienteId, info }: { clienteId: string; info?: ChatClienteInfo }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarChatCliente);
  const responder = useServerFn(responderChatCliente);
  const marcarLido = useServerFn(marcarChatClienteLido);
  const sessaoFn = useServerFn(getMinhaSessao);
  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => sessaoFn(),
    staleTime: 5 * 60_000,
  });
  const meuNome = sessao?.profile?.nome?.trim() || null;
  const [texto, setTexto] = useState("");
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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

  useIncomingChatSound(
    mensagens?.map((m) => ({ id: m.id, mine: m.remetente_tipo === "time" })),
  );

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens?.length]);

  const enviar = useMutation({
    mutationFn: (mensagem: string) => responder({ data: { cliente_id: clienteId, mensagem } }),
    onMutate: async (mensagem: string) => {
      await qc.cancelQueries({ queryKey });
      const anterior = qc.getQueryData<ChatMensagem[]>(queryKey);
      const otimista: ChatMensagem = {
        id: `otimista-${crypto.randomUUID()}`,
        remetente_tipo: "time",
        remetente_id: null,
        remetente_nome: meuNome,
        mensagem,
        anexo_url: null,
        anexo_nome: null,
        anexo_is_imagem: false,
        lida_em: null,
        criada_em: new Date().toISOString(),
      };
      qc.setQueryData<ChatMensagem[]>(queryKey, [...(anterior ?? []), otimista]);
      setTexto("");
      return { anterior };
    },
    onError: (err, _mensagem, ctx) => {
      if (ctx?.anterior) qc.setQueryData(queryKey, ctx.anterior);
      const motivo = err instanceof Error ? err.message : String(err);
      toast.error(`Não foi possível enviar a mensagem: ${motivo}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  function submeter() {
    const t = texto.trim();
    if (!t || enviar.isPending) return;
    enviar.mutate(t);
  }

  async function handleAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB).");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setEnviandoAnexo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${clienteId}/chat/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("cliente-documentos")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw error;
      await responder({
        data: { cliente_id: clienteId, mensagem: texto.trim() || undefined, anexo_path: path },
      });
      setTexto("");
      qc.invalidateQueries({ queryKey });
      toast.success("Arquivo enviado.");
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao enviar o arquivo: ${motivo}`);
    } finally {
      setEnviandoAnexo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }


  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/60 shadow-sm">
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">

        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-semibold text-primary-foreground shadow-sm">
          {iniciais(info?.nome)}
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-emerald-500" />
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

      <div className="chat-surface flex-1 space-y-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-2/3" />
          </div>
        ) : (mensagens?.length ?? 0) === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="size-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Nenhuma mensagem ainda
              </p>
              <p className="text-xs text-muted-foreground">
                Envie a primeira mensagem para iniciar a conversa.
              </p>
            </div>
          </div>
        ) : (
          mensagens!.map((m, i) => {
            const doTime = m.remetente_tipo === "time";
            const anterior = mensagens![i - 1];
            const proxima = mensagens![i + 1];
            const mostrarDia =
              !anterior ||
              formatarDia(anterior.criada_em) !== formatarDia(m.criada_em);
            const mesmoAutorAntes =
              !mostrarDia && anterior?.remetente_tipo === m.remetente_tipo;
            const mesmoAutorDepois =
              proxima?.remetente_tipo === m.remetente_tipo &&
              formatarDia(proxima?.criada_em ?? "") === formatarDia(m.criada_em);
            return (
              <div key={m.id}>
                {mostrarDia && (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full bg-background/80 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground shadow-sm ring-1 ring-border/50 backdrop-blur">
                      {formatarDia(m.criada_em)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-end gap-2",
                    doTime ? "justify-end" : "justify-start",
                    mesmoAutorAntes ? "mt-0.5" : "mt-2",
                  )}
                >
                  {!doTime &&
                    (mesmoAutorDepois ? (
                      <span className="size-7 shrink-0" />
                    ) : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/50 text-[10px] font-semibold text-primary-foreground shadow-sm">
                        {iniciais(info?.nome)}
                      </span>
                    ))}
                  <div
                    className={cn(
                      "max-w-[78%] px-3.5 py-2 text-sm shadow-sm",
                      doTime
                        ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-2xl rounded-bl-md border border-border/60 bg-card text-foreground",
                      mesmoAutorAntes && (doTime ? "rounded-tr-md" : "rounded-tl-md"),
                    )}
                  >
                    {!mesmoAutorAntes && (
                      <p
                        className={cn(
                          "mb-0.5 text-[11px] font-semibold",
                          doTime ? "text-primary-foreground/90" : "text-primary",
                        )}
                      >
                        {doTime
                          ? (m.remetente_nome?.trim() || "Equipe")
                          : (info?.nome?.trim() || "Cliente")}
                      </p>
                    )}
                    {m.anexo_url &&
                      (m.anexo_is_imagem ? (
                        <a href={m.anexo_url} target="_blank" rel="noreferrer">
                          <img
                            src={m.anexo_url}
                            alt={m.anexo_nome ?? "Imagem"}
                            className="mb-1 max-h-56 w-full rounded-lg object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={m.anexo_url}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            "mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium underline-offset-2 hover:underline",
                            doTime ? "bg-primary-foreground/15" : "bg-muted",
                          )}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate">{m.anexo_nome ?? "Arquivo"}</span>
                        </a>
                      ))}
                    {m.mensagem && m.mensagem !== m.anexo_nome && (
                      <p className="whitespace-pre-wrap break-words leading-relaxed">
                        {m.mensagem}
                      </p>
                    )}
                    <p
                      className={cn(
                        "mt-1 text-right text-[10px]",
                        doTime
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatarHora(m.criada_em)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      <div className="flex items-end gap-2 border-t bg-muted/30 p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={handleAnexo}
        />
        <Button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={enviandoAnexo || enviar.isPending}
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0 rounded-xl"
          title="Anexar imagem ou documento"
        >
          {enviandoAnexo ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>
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
          className="min-h-[44px] max-h-32 resize-none rounded-xl bg-background"
        />
        <Button
          onClick={submeter}
          disabled={enviar.isPending || !texto.trim()}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl shadow-sm"
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

/**
 * Chat interno com o cliente. Permite "soltar" a conversa em uma janela
 * flutuante GLOBAL, que continua aberta ao navegar entre telas do sistema.
 */
export function ChatClienteTab({ clienteId, info }: { clienteId: string; info?: ChatClienteInfo }) {
  const flutuante = useFloatingChat();
  const estaFlutuando = flutuante?.clienteId === clienteId;

  if (estaFlutuando) {
    return (
      <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Maximize2 className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Aberta em janela flutuante</p>
          <p className="text-xs text-muted-foreground">
            A conversa continua disponível mesmo ao trocar de tela.
          </p>
        </div>
        <button
          type="button"
          onClick={fecharChatFlutuante}
          className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          Reacoplar janela
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[24rem]">
      <button
        type="button"
        onClick={() => abrirChatFlutuante(clienteId, info)}
        title="Soltar em janela flutuante"
        aria-label="Soltar em janela flutuante"
        className="absolute right-2 top-2 z-20 flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
      >
        <Maximize2 className="size-3.5" />
      </button>
      <ChatClienteConversa clienteId={clienteId} info={info} />
    </div>
  );
}


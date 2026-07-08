import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Send,
  Loader2,
  MessageCircle,
  Paperclip,
  FileText,
  Maximize2,
  Check,
  CheckCheck,
  MoreVertical,
  Pencil,
  Trash2,
  Reply,
  Copy,
  X,
  Zap,
  Search,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  useFloatingChat,
  abrirChatFlutuante,
  fecharChatFlutuante,
} from "@/components/shared/floating-chat-store";
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { useChatTyping } from "@/hooks/use-chat-typing";
import { TypingIndicator } from "@/components/shared/typing-indicator";
import { supabase } from "@/integrations/supabase/client";
import {
  listarChatCliente,
  responderChatCliente,
  editarChatCliente,
  excluirChatCliente,
  marcarChatClienteLido,
  type ChatMensagem,
} from "@/lib/crm/chat-cliente.functions";
import {
  getRespostasRapidas,
  setRespostasRapidas,
  subscribeRespostasRapidas,
  type RespostaRapida,
} from "@/lib/crm/respostas-rapidas";
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
  const editar = useServerFn(editarChatCliente);
  const excluir = useServerFn(excluirChatCliente);
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
  const [respondendo, setRespondendo] = useState<ChatMensagem | null>(null);
  const [editando, setEditando] = useState<ChatMensagem | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState<ChatMensagem | null>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [buscaMsg, setBuscaMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const { peerTyping, notifyTyping, notifyStop } = useChatTyping(clienteId, "time");


  useEffect(() => {
    if (!buscaAberta) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens?.length, buscaAberta]);

  const enviar = useMutation({
    mutationFn: (payload: { mensagem: string; responde_a?: string }) =>
      responder({
        data: { cliente_id: clienteId, mensagem: payload.mensagem, responde_a: payload.responde_a },
      }),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey });
      const anterior = qc.getQueryData<ChatMensagem[]>(queryKey);
      const alvo = payload.responde_a
        ? anterior?.find((m) => m.id === payload.responde_a) ?? null
        : null;
      const otimista: ChatMensagem = {
        id: `otimista-${crypto.randomUUID()}`,
        remetente_tipo: "time",
        remetente_id: null,
        remetente_nome: meuNome,
        mensagem: payload.mensagem,
        anexo_url: null,
        anexo_nome: null,
        anexo_is_imagem: false,
        lida_em: null,
        criada_em: new Date().toISOString(),
        editada_em: null,
        excluida_em: null,
        responde_a: payload.responde_a ?? null,
        citacao: alvo
          ? {
              autor: alvo.remetente_tipo === "time" ? "Equipe" : info?.nome?.trim() || "Cliente",
              texto: alvo.mensagem?.trim() || "Anexo",
            }
          : null,
      };
      qc.setQueryData<ChatMensagem[]>(queryKey, [...(anterior ?? []), otimista]);
      setTexto("");
      setRespondendo(null);
      return { anterior };
    },
    onError: (err, _payload, ctx) => {
      if (ctx?.anterior) qc.setQueryData(queryKey, ctx.anterior);
      const motivo = err instanceof Error ? err.message : String(err);
      toast.error(`Não foi possível enviar a mensagem: ${motivo}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const salvarEdicao = useMutation({
    mutationFn: (payload: { id: string; mensagem: string }) => editar({ data: payload }),
    onSuccess: () => {
      setEditando(null);
      setTexto("");
      qc.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      const motivo = err instanceof Error ? err.message : String(err);
      toast.error(`Não foi possível editar: ${motivo}`);
    },
  });

  const removerMsg = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      setConfirmarExcluir(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      const motivo = err instanceof Error ? err.message : String(err);
      toast.error(`Não foi possível excluir: ${motivo}`);
    },
  });

  function submeter() {
    const t = texto.trim();
    if (!t) return;
    if (editando) {
      if (salvarEdicao.isPending) return;
      salvarEdicao.mutate({ id: editando.id, mensagem: t });
      return;
    }
    if (enviar.isPending) return;
    enviar.mutate({ mensagem: t, responde_a: respondendo?.id });
  }

  function iniciarEdicao(m: ChatMensagem) {
    setEditando(m);
    setRespondendo(null);
    setTexto(m.mensagem);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function iniciarResposta(m: ChatMensagem) {
    setRespondendo(m);
    setEditando(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function cancelarComposer() {
    setEditando(null);
    setRespondendo(null);
    if (editando) setTexto("");
  }

  function copiar(m: ChatMensagem) {
    navigator.clipboard?.writeText(m.mensagem).then(
      () => toast.success("Mensagem copiada."),
      () => toast.error("Não foi possível copiar."),
    );
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
        data: {
          cliente_id: clienteId,
          mensagem: texto.trim() || undefined,
          anexo_path: path,
          responde_a: respondendo?.id,
        },
      });
      setTexto("");
      setRespondendo(null);
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

  const filtradas = useMemo(() => {
    const lista = mensagens ?? [];
    const t = buscaMsg.trim().toLowerCase();
    if (!buscaAberta || !t) return lista;
    return lista.filter((m) => (m.mensagem ?? "").toLowerCase().includes(t));
  }, [mensagens, buscaMsg, buscaAberta]);

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/60 shadow-sm">
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-semibold text-primary-foreground shadow-sm">
          {iniciais(info?.nome)}
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {info?.nome ?? "Conversa com o cliente"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[info?.documento, info?.celular, info?.email, info?.contexto]
              .filter(Boolean)
              .join(" · ") || "App do Cliente"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          onClick={() => {
            setBuscaAberta((v) => !v);
            setBuscaMsg("");
          }}
          title="Buscar na conversa"
        >
          <Search className="size-4" />
        </Button>
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

      <div className="chat-surface flex-1 space-y-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-2/3" />
          </div>
        ) : (filtradas.length ?? 0) === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="size-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {buscaAberta && buscaMsg.trim()
                  ? "Nenhuma mensagem encontrada"
                  : "Nenhuma mensagem ainda"}
              </p>
              <p className="text-xs text-muted-foreground">
                {buscaAberta && buscaMsg.trim()
                  ? "Tente outro termo de busca."
                  : "Envie a primeira mensagem para iniciar a conversa."}
              </p>
            </div>
          </div>
        ) : (
          filtradas.map((m, i) => {
            const doTime = m.remetente_tipo === "time";
            const anterior = filtradas[i - 1];
            const proxima = filtradas[i + 1];
            const mostrarDia =
              !anterior ||
              formatarDia(anterior.criada_em) !== formatarDia(m.criada_em);
            const mesmoAutorAntes =
              !mostrarDia && anterior?.remetente_tipo === m.remetente_tipo;
            const mesmoAutorDepois =
              proxima?.remetente_tipo === m.remetente_tipo &&
              formatarDia(proxima?.criada_em ?? "") === formatarDia(m.criada_em);
            const excluida = !!m.excluida_em;
            const otimista = m.id.startsWith("otimista-");
            const podeGerenciar = doTime && !excluida && !otimista;
            const visto = doTime && !!m.lida_em;
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
                    "group flex items-end gap-2",
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

                  {/* Ações (aparecem no hover) — à esquerda das bolhas do time */}
                  {podeGerenciar && (
                    <MsgAcoes
                      lado="time"
                      onReply={() => iniciarResposta(m)}
                      onEdit={() => iniciarEdicao(m)}
                      onCopy={() => copiar(m)}
                      onDelete={() => setConfirmarExcluir(m)}
                    />
                  )}

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

                    {/* Citação / resposta */}
                    {m.citacao && !excluida && (
                      <div
                        className={cn(
                          "mb-1 rounded-lg border-l-2 px-2 py-1 text-[11px]",
                          doTime
                            ? "border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground/80"
                            : "border-primary/50 bg-primary/5 text-muted-foreground",
                        )}
                      >
                        <span className="block font-semibold">{m.citacao.autor}</span>
                        <span className="line-clamp-2">{m.citacao.texto}</span>
                      </div>
                    )}

                    {excluida ? (
                      <p className="flex items-center gap-1.5 text-sm italic opacity-70">
                        <Trash2 className="size-3.5" /> Mensagem excluída
                      </p>
                    ) : (
                      <>
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
                      </>
                    )}

                    <div
                      className={cn(
                        "mt-1 flex items-center justify-end gap-1 text-[10px]",
                        doTime ? "text-primary-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {m.editada_em && !excluida && <span className="italic">editado</span>}
                      <span>{formatarHora(m.criada_em)}</span>
                      {doTime && !excluida && !otimista && (
                        <span title={visto ? "Visualizado pelo cliente" : "Enviado"}>
                          {visto ? (
                            <CheckCheck className="size-3.5 text-sky-300" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações para mensagens do cliente (só responder/copiar) */}
                  {!doTime && !excluida && !otimista && (
                    <MsgAcoes
                      lado="cliente"
                      onReply={() => iniciarResposta(m)}
                      onCopy={() => copiar(m)}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      {/* Barra de resposta/edição acima do composer */}
      {(respondendo || editando) && (
        <div className="flex items-center gap-2 border-t bg-muted/40 px-3 py-2">
          <div
            className={cn(
              "flex-1 rounded-lg border-l-2 px-2 py-1 text-xs",
              editando ? "border-amber-500 bg-amber-500/5" : "border-primary bg-primary/5",
            )}
          >
            <span className="block font-semibold text-foreground">
              {editando ? "Editando mensagem" : "Respondendo"}
            </span>
            <span className="line-clamp-1 text-muted-foreground">
              {(editando ?? respondendo)?.mensagem || "Anexo"}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            onClick={cancelarComposer}
            title="Cancelar"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t bg-muted/30 p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={handleAnexo}
        />
        <RespostasRapidas onEscolher={(t) => setTexto((prev) => (prev ? `${prev} ${t}` : t))} />
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
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submeter();
            }
            if (e.key === "Escape") cancelarComposer();
          }}
          placeholder={editando ? "Edite a mensagem…" : "Escreva uma mensagem para o cliente…"}
          className="min-h-[44px] max-h-32 resize-none rounded-xl bg-background"
        />
        <Button
          onClick={submeter}
          disabled={enviar.isPending || salvarEdicao.isPending || !texto.trim()}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl shadow-sm"
          title={editando ? "Salvar edição" : "Enviar"}
        >
          {enviar.isPending || salvarEdicao.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : editando ? (
            <Check className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <AlertDialog
        open={!!confirmarExcluir}
        onOpenChange={(o) => !o && setConfirmarExcluir(null)}
      >
        <AlertDialogContent className="z-[90]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem será marcada como excluída para você e para o cliente. Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmarExcluir && removerMsg.mutate(confirmarExcluir.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Menu de ações que aparece ao passar o mouse sobre a mensagem. */
function MsgAcoes({
  lado,
  onReply,
  onEdit,
  onCopy,
  onDelete,
}: {
  lado: "time" | "cliente";
  onReply?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center self-center rounded-full text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:opacity-100 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100",
            lado === "time" ? "order-first" : "",
          )}
          aria-label="Ações da mensagem"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={lado === "time" ? "end" : "start"}
        side={lado === "time" ? "left" : "right"}
        sideOffset={8}
        collisionPadding={16}
        className="z-[140] w-40 shadow-xl"
        style={{ zIndex: 140 }}
      >

        {onReply && (
          <DropdownMenuItem onClick={onReply}>
            <Reply className="mr-2 size-4" /> Responder
          </DropdownMenuItem>
        )}
        {onCopy && (
          <DropdownMenuItem onClick={onCopy}>
            <Copy className="mr-2 size-4" /> Copiar
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 size-4" /> Editar
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Popover de respostas rápidas (templates) — editáveis, salvas no navegador. */
function RespostasRapidas({ onEscolher }: { onEscolher: (texto: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<RespostaRapida[]>([]);
  const [gerenciando, setGerenciando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formTitulo, setFormTitulo] = useState("");
  const [formTexto, setFormTexto] = useState("");

  useEffect(() => {
    setLista(getRespostasRapidas());
    return subscribeRespostasRapidas(() => setLista(getRespostasRapidas()));
  }, []);

  function limparForm() {
    setEditandoId(null);
    setFormTitulo("");
    setFormTexto("");
  }

  function salvar() {
    const titulo = formTitulo.trim();
    const texto = formTexto.trim();
    if (!titulo || !texto) return;
    let proxima: RespostaRapida[];
    if (editandoId) {
      proxima = lista.map((r) => (r.id === editandoId ? { ...r, titulo, texto } : r));
    } else {
      proxima = [...lista, { id: crypto.randomUUID(), titulo, texto }];
    }
    setLista(proxima);
    setRespostasRapidas(proxima);
    limparForm();
  }

  function editar(r: RespostaRapida) {
    setEditandoId(r.id);
    setFormTitulo(r.titulo);
    setFormTexto(r.texto);
    setGerenciando(true);
  }

  function remover(id: string) {
    const proxima = lista.filter((r) => r.id !== id);
    setLista(proxima);
    setRespostasRapidas(proxima);
    if (editandoId === id) limparForm();
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) {
          setGerenciando(false);
          limparForm();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0 rounded-xl"
          title="Respostas rápidas"
        >
          <Zap className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="z-[70] w-80 p-0"
        collisionPadding={12}
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Respostas rápidas</span>
          <Button
            type="button"
            variant={gerenciando ? "secondary" : "ghost"}
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={() => {
              setGerenciando((v) => !v);
              if (gerenciando) limparForm();
            }}
          >
            {gerenciando ? "Concluir" : "Gerenciar"}
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {lista.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Nenhuma resposta rápida cadastrada.
              <br />
              Use “Gerenciar” para criar a primeira.
            </p>
          )}
          {lista.map((r) => (
            <div
              key={r.id}
              className="group/resp flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-muted"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left disabled:cursor-default"
                onClick={() => {
                  if (gerenciando) return;
                  onEscolher(r.texto);
                  setAberto(false);
                }}
                disabled={gerenciando}
              >
                <span className="block text-xs font-semibold text-foreground">{r.titulo}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{r.texto}</span>
              </button>
              {gerenciando && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => editar(r)}
                    aria-label="Editar"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remover(r.id)}
                    aria-label="Remover"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {gerenciando && (
          <div className="space-y-2 border-t p-3">
            <p className="text-xs font-medium text-foreground">
              {editandoId ? "Editar resposta" : "Nova resposta"}
            </p>
            <Input
              value={formTitulo}
              onChange={(e) => setFormTitulo(e.target.value)}
              placeholder="Título (ex.: Saudação)"
              className="h-8 text-xs"
            />
            <Textarea
              value={formTexto}
              onChange={(e) => setFormTexto(e.target.value)}
              placeholder="Texto da resposta rápida…"
              className="min-h-[60px] resize-none text-xs"
            />
            <div className="flex gap-2">
              {editandoId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={limparForm}
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={salvar}
                disabled={!formTitulo.trim() || !formTexto.trim()}
              >
                {editandoId ? (
                  "Salvar"
                ) : (
                  <>
                    <Plus className="mr-1 size-4" /> Adicionar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
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

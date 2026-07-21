import { type RefObject } from "react";
import { Check, CheckCheck, FileText, MessageCircle, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TypingIndicator } from "@/components/shared/typing-indicator";
import { type ChatMensagem } from "@/lib/crm/chat-cliente.functions";
import { MsgAcoes } from "./msg-acoes";
import { formatarDia, formatarHora, type ChatClienteInfo } from "./utils";

export function ListaMensagens({
  filtradas,
  isLoading,
  buscaAberta,
  buscaMsg,
  info,
  peerTyping,
  fimRef,
  iniciarResposta,
  iniciarEdicao,
  copiar,
  onExcluir,
  onReagir,
  capabilities,
}: {
  filtradas: ChatMensagem[];
  isLoading: boolean;
  buscaAberta: boolean;
  buscaMsg: string;
  info?: ChatClienteInfo;
  peerTyping: boolean;
  fimRef: RefObject<HTMLDivElement | null>;
  iniciarResposta: (m: ChatMensagem) => void;
  iniciarEdicao: (m: ChatMensagem) => void;
  copiar: (m: ChatMensagem) => void;
  onExcluir: (m: ChatMensagem) => void;
  onReagir?: (mensagem_id: string, emoji: string) => void;
  /** Capacidades da conversa. Defaults: tudo habilitado. */
  capabilities?: {
    responder?: boolean;
    editar?: boolean;
    excluir?: boolean;
    reagir?: boolean;
  };
}) {
  const podeResponder = capabilities?.responder ?? true;
  const podeEditar = capabilities?.editar ?? true;
  const podeExcluir = capabilities?.excluir ?? true;
  const podeReagir = (capabilities?.reagir ?? true) && !!onReagir;

  return (
    <div className="chat-surface min-w-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4">
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
            !anterior || formatarDia(anterior.criada_em) !== formatarDia(m.criada_em);
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
                    "group flex min-w-0 items-end gap-1.5 sm:gap-2",
                  doTime ? "justify-end" : "justify-start",
                  mesmoAutorAntes ? "mt-0.5" : "mt-2",
                )}
              >
                {/* Ações (aparecem no hover) — à esquerda das bolhas do time */}
                {podeGerenciar && (
                  <MsgAcoes
                    lado="time"
                    onReply={podeResponder ? () => iniciarResposta(m) : undefined}
                    onEdit={podeEditar ? () => iniciarEdicao(m) : undefined}
                    onCopy={() => copiar(m)}
                    onDelete={podeExcluir ? () => onExcluir(m) : undefined}
                  />
                )}


                <div
                  className={cn(
                    "chat-bubble min-w-0 max-w-[calc(100%-3.25rem)] overflow-hidden px-3 py-2 text-sm sm:max-w-[78%] sm:px-3.5",
                    m.interna
                      ? "rounded-2xl border border-amber-500/40 bg-amber-500/10 text-foreground"
                      : doTime
                        ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-2xl rounded-bl-md border border-chat-them-border bg-chat-them text-chat-them-foreground",
                    mesmoAutorAntes &&
                      !m.interna &&
                      (doTime ? "rounded-tr-md" : "rounded-tl-md"),
                  )}
                >
                  {m.interna && (
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      <span className="inline-block size-1.5 rounded-full bg-amber-500" />
                      Nota interna — só o time vê
                    </p>
                  )}
                  {!mesmoAutorAntes && (
                    <p
                      className={cn(
                        "mb-0.5 text-[11px] font-semibold",
                        m.interna
                          ? "text-amber-700 dark:text-amber-300"
                          : doTime
                            ? "text-primary-foreground/90"
                            : "text-chat-them-foreground/80",
                      )}
                    >
                      {doTime
                        ? m.remetente_nome?.trim() || "Atendente"
                        : m.remetente_nome?.trim() || info?.nome?.trim() || "Cliente"}
                    </p>
                  )}

                  {/* Citação / resposta */}
                  {m.citacao && !excluida && (
                    <div
                      className={cn(
                        "mb-1 rounded-lg border-l-2 px-2 py-1 text-[11px]",
                        doTime
                          ? "border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground/80"
                          : "border-chat-them-foreground/30 bg-chat-them-foreground/5 text-chat-them-foreground/80",
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
                              doTime ? "bg-primary-foreground/15" : "bg-chat-them-foreground/10",
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
                      doTime ? "text-primary-foreground/70" : "text-chat-them-foreground/60",
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

                {/* Ações para mensagens do peer (só responder/copiar) */}
                {!doTime && !excluida && !otimista && (
                  <MsgAcoes
                    lado="cliente"
                    onReply={podeResponder ? () => iniciarResposta(m) : undefined}
                    onCopy={() => copiar(m)}
                  />
                )}
              </div>
            </div>
          );
        })
      )}
      {peerTyping && (
        <TypingIndicator lado="cliente" nome={info?.nome?.trim() || "Cliente"} className="mt-2" />
      )}
      <div ref={fimRef} />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Paperclip, Camera, FileText, Loader2, ChevronLeft } from "lucide-react";
import {
  clienteListarAtendentes,
  clienteListarMensagens,
  clienteEnviarMensagem,
  clienteEnviarMensagemAnexo,
  clienteMarcarLida,
  type AtendenteCliente,
} from "@/lib/portal/cliente.functions";
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { useChatTyping } from "@/hooks/use-chat-typing";
import { TypingIndicator } from "@/components/shared/typing-indicator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { cn } from "@/lib/utils";

function fileParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function horaCurta(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia =
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear();
  return d.toLocaleString("pt-BR", {
    ...(mesmoDia ? {} : { day: "2-digit", month: "2-digit" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatCliente({ altura = "h-[62dvh]" }: { altura?: string }) {
  const qc = useQueryClient();
  const [atendenteSel, setAtendenteSel] = useState<AtendenteCliente | null>(null);

  const { data: atendentes } = useQuery({
    queryKey: ["cliente", "atendentes"],
    queryFn: () => clienteListarAtendentes(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 12000),
  });

  // Seleção automática quando há apenas um atendente.
  useEffect(() => {
    if (!atendenteSel && atendentes && atendentes.length === 1) {
      setAtendenteSel(atendentes[0]);
    }
  }, [atendentes, atendenteSel]);

  // Mantém a seleção sincronizada (nome/foto/não lidas) com a lista atualizada.
  useEffect(() => {
    if (atendenteSel && atendentes) {
      const atualizado = atendentes.find((a) => a.atendente_id === atendenteSel.atendente_id);
      if (atualizado && atualizado !== atendenteSel) setAtendenteSel(atualizado);
    }
  }, [atendentes, atendenteSel]);

  const multiplos = (atendentes?.length ?? 0) > 1;

  if (!atendenteSel) {
    return (
      <ListaAtendentes
        atendentes={atendentes ?? []}
        altura={altura}
        onSelecionar={setAtendenteSel}
      />
    );
  }

  return (
    <ThreadChat
      key={atendenteSel.atendente_id}
      atendente={atendenteSel}
      altura={altura}
      podeVoltar={multiplos}
      onVoltar={() => setAtendenteSel(null)}
    />
  );
}

function ListaAtendentes({
  atendentes,
  altura,
  onSelecionar,
}: {
  atendentes: AtendenteCliente[];
  altura: string;
  onSelecionar: (a: AtendenteCliente) => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary to-[var(--brand-azul-escuro)] px-4 py-3 text-primary-foreground">
        <p className="text-sm font-semibold">Suas conversas</p>
        <p className="text-xs text-primary-foreground/80">Escolha com quem deseja falar</p>
      </div>
      <div className={cn("divide-y divide-border/60 overflow-y-auto", altura)}>
        {atendentes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Send className="h-5 w-5" />
            </span>
            <p className="text-sm text-muted-foreground">
              Assim que sua equipe iniciar o atendimento, a conversa aparecerá aqui.
            </p>
          </div>
        ) : (
          atendentes.map((a) => (
            <button
              key={a.atendente_id}
              type="button"
              onClick={() => onSelecionar(a)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <Avatar className="h-11 w-11 shrink-0">
                {a.foto_url ? <AvatarImage src={a.foto_url} alt={a.nome} /> : null}
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {iniciais(a.nome)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{a.nome}</p>
                  {a.ultima_em ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {horaCurta(a.ultima_em)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {a.ultima_mensagem || "Iniciar conversa"}
                  </p>
                  {a.nao_lidas > 0 ? (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                      {a.nao_lidas}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ThreadChat({
  atendente,
  altura,
  podeVoltar,
  onVoltar,
}: {
  atendente: AtendenteCliente;
  altura: string;
  podeVoltar: boolean;
  onVoltar: () => void;
}) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const atendenteId = atendente.atendente_id;

  const { data: mensagens } = useQuery({
    queryKey: ["cliente", "mensagens", atendenteId],
    queryFn: () => clienteListarMensagens({ data: { atendente_id: atendenteId } }),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 8000),
  });

  const { peerTyping, notifyTyping, notifyStop } = useChatTyping(atendenteId, "cliente");

  const enviar = useMutation({
    mutationFn: (mensagem: string) =>
      clienteEnviarMensagem({ data: { atendente_id: atendenteId, mensagem } }),
    onSuccess: () => {
      setTexto("");
      qc.invalidateQueries({ queryKey: ["cliente", "mensagens", atendenteId] });
      qc.invalidateQueries({ queryKey: ["cliente", "atendentes"] });
    },
    onError: () => toast.error("Falha de conexão. Tente novamente."),
  });

  const enviarAnexo = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileParaBase64(file);
      return clienteEnviarMensagemAnexo({
        data: {
          atendente_id: atendenteId,
          mensagem: texto.trim() || undefined,
          nome_arquivo: file.name,
          mime_type: file.type || "application/octet-stream",
          conteudo_base64: base64,
        },
      });
    },
    onSuccess: () => {
      setTexto("");
      toast.success("Anexo enviado!");
      qc.invalidateQueries({ queryKey: ["cliente", "mensagens", atendenteId] });
      qc.invalidateQueries({ queryKey: ["cliente", "atendentes"] });
    },
    onError: () => toast.error("Falha ao enviar o anexo. Verifique o arquivo e tente novamente."),
  });

  const enviandoAnexo = enviarAnexo.isPending;

  function submeter() {
    const v = texto.trim();
    if (!v || enviar.isPending || enviandoAnexo) return;
    notifyStop();
    enviar.mutate(v);
  }

  function selecionar(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB).");
      return;
    }
    enviarAnexo.mutate(file);
  }

  const marcadosRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const naoLidas = (mensagens ?? [])
      .filter((m) => m.remetente_tipo === "time" && !m.lida_em && !marcadosRef.current.has(m.id))
      .map((m) => m.id);
    if (naoLidas.length > 0) {
      naoLidas.forEach((id) => marcadosRef.current.add(id));
      clienteMarcarLida({ data: { mensagem_ids: naoLidas } })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["cliente", "atendentes"] });
          qc.invalidateQueries({ queryKey: ["cliente", "notificacoes"] });
          qc.invalidateQueries({ queryKey: ["cliente", "chat-nao-lidas"] });
        })
        .catch(() => {
          naoLidas.forEach((id) => marcadosRef.current.delete(id));
        });
    }
  }, [mensagens, qc]);

  useIncomingChatSound(
    useMemo(
      () => mensagens?.map((m) => ({ id: m.id, mine: m.remetente_tipo === "cliente" })),
      [mensagens],
    ),
  );

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-24px_color-mix(in_oklab,var(--brand-azul-profundo)_35%,transparent)]">
      {/* Cabeçalho do chat */}
      <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary to-[var(--brand-azul-escuro)] px-3 py-3 text-primary-foreground sm:px-4">
        {podeVoltar ? (
          <button
            type="button"
            onClick={onVoltar}
            className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary-foreground/90 hover:bg-white/15"
            aria-label="Voltar para conversas"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <Avatar className="h-9 w-9 ring-2 ring-white/25">
          {atendente.foto_url ? <AvatarImage src={atendente.foto_url} alt={atendente.nome} /> : null}
          <AvatarFallback className="bg-white/15 text-xs text-primary-foreground">
            {iniciais(atendente.nome)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">{atendente.nome}</p>
          <span className="flex items-center gap-1.5 text-xs text-primary-foreground/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            Online · responde em horário comercial
          </span>
        </div>
      </div>

      {/* Mensagens */}
      <div
        className={cn(
          "space-y-3 overflow-y-auto bg-gradient-to-b from-muted/25 to-transparent px-3 py-4 sm:px-5",
          altura,
        )}
      >
        {(mensagens ?? []).length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Send className="h-5 w-5" />
            </span>
            <p className="text-sm text-muted-foreground">
              Envie uma mensagem ou um documento para falar com {atendente.nome}.
            </p>
          </div>
        ) : (
          (mensagens ?? []).map((m) => {
            const doCliente = m.remetente_tipo === "cliente";
            const excluida = !!m.excluida_em;
            const temAnexo = !!m.anexo_url && !excluida;
            const soAnexo = temAnexo && (!m.mensagem || m.mensagem === m.anexo_nome);
            return (
              <div key={m.id} className={cn("flex flex-col", doCliente ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "chat-bubble max-w-[82%] overflow-hidden rounded-2xl text-sm",
                    doCliente
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-chat-them-border bg-chat-them text-chat-them-foreground",
                  )}
                >
                  {excluida ? (
                    <p className="px-3.5 py-2 text-sm italic opacity-70">Mensagem excluída</p>
                  ) : (
                    <>
                      {temAnexo && m.anexo_is_imagem ? (
                        <button
                          type="button"
                          onClick={() =>
                            setVisualizando({ url: m.anexo_url!, nome: m.anexo_nome ?? "Anexo" })
                          }
                          className="block"
                        >
                          <img
                            src={m.anexo_url!}
                            alt={m.anexo_nome ?? "Anexo"}
                            className="max-h-64 w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ) : temAnexo ? (
                        <button
                          type="button"
                          onClick={() =>
                            setVisualizando({ url: m.anexo_url!, nome: m.anexo_nome ?? "Documento" })
                          }
                          className="flex items-center gap-2 px-3.5 py-2 underline underline-offset-2"
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate">{m.anexo_nome ?? "Documento"}</span>
                        </button>
                      ) : null}
                      {!soAnexo && <p className="whitespace-pre-wrap px-3.5 py-2">{m.mensagem}</p>}
                    </>
                  )}
                </div>
                <span className="mt-1 px-1 text-[11px] text-muted-foreground">
                  {new Date(m.criada_em).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {m.editada_em && !excluida ? " · editado" : ""}
                </span>
              </div>
            );
          })
        )}
        {enviandoAnexo && (
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando anexo…
          </div>
        )}
        {peerTyping && <TypingIndicator lado="time" nome={atendente.nome} className="mt-1" />}
        <div ref={fimRef} />
      </div>

      <input
        ref={fotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          selecionar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={arquivoRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={(e) => {
          selecionar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <form
        className="flex items-end gap-1.5 border-t border-border/60 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        onSubmit={(e) => {
          e.preventDefault();
          submeter();
        }}
      >
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0"
          disabled={enviandoAnexo}
          onClick={() => fotoRef.current?.click()}
          aria-label="Enviar foto"
        >
          <Camera className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0"
          disabled={enviandoAnexo}
          onClick={() => arquivoRef.current?.click()}
          aria-label="Anexar documento"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            if (e.target.value.trim()) notifyTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submeter();
            }
          }}
          placeholder="Escreva sua mensagem…"
          rows={1}
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none"
        />

        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 shrink-0"
          disabled={enviar.isPending || enviandoAnexo || !texto.trim()}
          aria-label="Enviar mensagem"
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>
      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o: boolean) => !o && setVisualizando(null)}
      />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
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
import {
  useFloatingChat,
  abrirChatFlutuante,
  fecharChatFlutuante,
} from "@/components/shared/floating-chat-store";
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { useChatTyping } from "@/hooks/use-chat-typing";
import { supabase } from "@/integrations/supabase/client";
import {
  listarChatCliente,
  responderChatCliente,
  editarChatCliente,
  excluirChatCliente,
  marcarChatClienteLido,
  obterContextoChatCliente,
  type ChatMensagem,
} from "@/lib/crm/chat-cliente.functions";
import { type ContextoResposta } from "@/lib/crm/respostas-rapidas";
import { getMinhaSessao } from "@/lib/session.functions";
import { type ChatClienteInfo } from "./chat-cliente/utils";
import { ChatClienteHeader } from "./chat-cliente/chat-header";
import { ListaMensagens } from "./chat-cliente/lista-mensagens";
import { ChatComposer } from "./chat-cliente/composer";

export type { ChatClienteInfo } from "./chat-cliente/utils";

/** Corpo da conversa (cabeçalho, mensagens e composer), sem casca flutuante. */
export function ChatClienteConversa({
  clienteId,
  info,
  atendenteId,
  somenteLeitura = false,
  atendenteNome,
  acoes,
}: {
  clienteId: string;
  info?: ChatClienteInfo;
  /** Thread do atendente exibido (para a visão supervisora de gestores). */
  atendenteId?: string;
  /** Quando true, a conversa é de outro atendente: só leitura. */
  somenteLeitura?: boolean;
  atendenteNome?: string;
  /** Ações extras (ex.: "Mais ações") renderizadas no cabeçalho da conversa. */
  acoes?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const listar = useServerFn(listarChatCliente);
  const responder = useServerFn(responderChatCliente);
  const editar = useServerFn(editarChatCliente);
  const excluir = useServerFn(excluirChatCliente);
  const marcarLido = useServerFn(marcarChatClienteLido);
  const contextoFn = useServerFn(obterContextoChatCliente);
  const sessaoFn = useServerFn(getMinhaSessao);
  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => sessaoFn(),
    staleTime: 5 * 60_000,
  });
  const { data: ctxCliente } = useQuery({
    queryKey: ["chat-contexto-cliente", clienteId],
    queryFn: () => contextoFn({ data: { cliente_id: clienteId } }),
    staleTime: 60_000,
  });
  const contextoResposta: ContextoResposta = useMemo(
    () => ({
      primeiro_nome: ctxCliente?.primeiro_nome ?? info?.nome?.trim().split(/\s+/)[0] ?? null,
      numero_proposta: ctxCliente?.numero_proposta ?? null,
      nome_banco: ctxCliente?.nome_banco ?? null,
      etapa: ctxCliente?.etapa_nome ?? info?.contexto ?? null,
    }),
    [ctxCliente, info?.nome, info?.contexto],
  );
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

  const queryKey = ["chat-cliente", clienteId, atendenteId ?? "eu"];
  const { data: mensagens, isLoading } = useQuery({
    queryKey,
    queryFn: () => listar({ data: { cliente_id: clienteId, atendente_id: atendenteId } }),
  });

  useEffect(() => {
    if (somenteLeitura) return; // não marca lida em thread de outro atendente
    marcarLido({ data: { cliente_id: clienteId } }).catch(() => {});
  }, [clienteId, marcarLido, mensagens?.length, somenteLeitura]);


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
    clienteId,
  );

  const { peerTyping, notifyTyping, notifyStop } = useChatTyping(clienteId, "time");

  useEffect(() => {
    if (!buscaAberta) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens?.length, buscaAberta, peerTyping]);

  const enviar = useMutation({
    mutationFn: (payload: { mensagem: string; responde_a?: string }) =>
      responder({
        data: {
          cliente_id: clienteId,
          atendente_id: atendenteId,
          mensagem: payload.mensagem,
          responde_a: payload.responde_a,
        },
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
              autor:
                alvo.remetente_tipo === "time"
                  ? alvo.remetente_nome?.trim() || meuNome || "Atendente"
                  : alvo.remetente_nome?.trim() || info?.nome?.trim() || "Cliente",
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
      const bruto = err instanceof Error ? err.message : String(err);
      const motivo = /unauthorized|authorization header|invalid token|no token/i.test(bruto)
        ? "sua sessão expirou. Atualize a página e entre novamente."
        : bruto;
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
    notifyStop();

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
          atendente_id: atendenteId,
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
    <Card className="flex h-full min-w-0 flex-col overflow-hidden border-border/60 shadow-sm">
      <ChatClienteHeader
        info={info}
        clienteId={clienteId}
        acoes={acoes}
        buscaAberta={buscaAberta}
        toggleBusca={() => {
          setBuscaAberta((v) => !v);
          setBuscaMsg("");
        }}
        buscaMsg={buscaMsg}
        setBuscaMsg={setBuscaMsg}
      />

      <ListaMensagens
        filtradas={filtradas}
        isLoading={isLoading}
        buscaAberta={buscaAberta}
        buscaMsg={buscaMsg}
        info={info}
        peerTyping={peerTyping}
        fimRef={fimRef}
        iniciarResposta={iniciarResposta}
        iniciarEdicao={iniciarEdicao}
        copiar={copiar}
        onExcluir={setConfirmarExcluir}
      />

      {somenteLeitura ? (
        <div className="border-t border-border/60 bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
          Visualizando a conversa de{" "}
          <span className="font-medium text-foreground">{atendenteNome ?? "outro atendente"}</span>{" "}
          — somente leitura. Para falar com este cliente, abra a sua própria conversa.
        </div>
      ) : (
        <ChatComposer
          respondendo={respondendo}
          editando={editando}
          cancelarComposer={cancelarComposer}
          contextoResposta={contextoResposta}
          onEscolherResposta={(t) => setTexto((prev) => (prev ? `${prev} ${t}` : t))}
          fileRef={fileRef}
          onAnexo={handleAnexo}
          enviandoAnexo={enviandoAnexo}
          enviarPending={enviar.isPending}
          salvarEdicaoPending={salvarEdicao.isPending}
          textareaRef={textareaRef}
          texto={texto}
          onChangeTexto={(v) => {
            setTexto(v);
            if (v.trim()) notifyTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submeter();
            }
            if (e.key === "Escape") cancelarComposer();
          }}
          submeter={submeter}
        />
      )}

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

/**
 * Chat interno com o cliente. Permite "soltar" a conversa em uma janela
 * flutuante GLOBAL, que continua aberta ao navegar entre telas do sistema.
 */
export function ChatClienteTab({
  clienteId,
  info,
  atendenteId,
  somenteLeitura = false,
  atendenteNome,
  acoes,
}: {
  clienteId: string;
  info?: ChatClienteInfo;
  atendenteId?: string;
  somenteLeitura?: boolean;
  atendenteNome?: string;
  acoes?: React.ReactNode;
}) {
  const flutuante = useFloatingChat();
  const estaFlutuando = flutuante?.clienteId === clienteId;

  // A janela flutuante só vale para a conversa do próprio usuário.
  if (somenteLeitura) {
    return (
      <div className="h-full min-h-[24rem] min-w-0 overflow-hidden">
        <ChatClienteConversa
          clienteId={clienteId}
          info={info}
          atendenteId={atendenteId}
          somenteLeitura
          atendenteNome={atendenteNome}
        />
      </div>
    );
  }

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
    <div className="relative h-full min-h-[24rem] min-w-0 overflow-hidden">
      <button
        type="button"
        onClick={() => abrirChatFlutuante(clienteId, info)}
        title="Soltar em janela flutuante"
        aria-label="Soltar em janela flutuante"
        className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Maximize2 className="size-3.5" />
        <span className="hidden sm:inline">Soltar chat</span>
      </button>

      <ChatClienteConversa clienteId={clienteId} info={info} acoes={acoes} />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { useChatTyping } from "@/hooks/use-chat-typing";
import { useChatPresence } from "@/hooks/use-chat-presence";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { ChatClienteHeader } from "./pecas/chat-header";
import { ListaMensagens } from "./pecas/lista-mensagens";
import { ChatComposer, type ComposerSubmitPayload } from "./pecas/composer";
import type { ChatAdapter, ChatMensagem } from "./types";

/**
 * Núcleo unificado de chat.
 *
 * Recebe um adaptador de conversa e cuida de: listagem em tempo real,
 * envio otimista, "digitando", marcar-como-lida, editar/excluir suave,
 * responder-a, upload de anexo e criação de tarefa a partir do chat.
 *
 * Não conhece a origem da conversa — é usado por cliente/demanda/DM.
 */
export function ChatConversaCore({ adapter }: { adapter: ChatAdapter }) {
  const qc = useQueryClient();
  const {
    conversaId,
    queryKey,
    meuNome,
    info,
    headerClienteId,
    contextoResposta,
    somenteLeitura,
    atendenteNome,
    acoes,
    mineTipo,
    peerNomeCitacao,
  } = adapter;

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

  const {
    data: mensagens,
    isLoading,
    isError,
    error: erroLista,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => adapter.listar(),
    // Fallback: garante entrega de mensagens, respostas e reações mesmo que
    // algum evento realtime se perca. As mudanças chegam pelo Realtime (efeito
    // abaixo: mensagens, reações e a conversa em cada adaptador); este poll só
    // pesa se o websocket cair. Eram 4 s por conversa aberta.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (somenteLeitura) return;
    const temNaoLidas = (mensagens ?? []).some((m) => m.remetente_tipo !== mineTipo && !m.lida_em);
    if (!temNaoLidas) return;
    adapter.marcarLido().catch(() => {});
  }, [adapter, mensagens, mineTipo, somenteLeitura]);

  useEffect(() => {
    // Sufixo único evita que o StrictMode (double-invoke) reaproveite o mesmo
    // tópico realtime e tente registrar `postgres_changes` após o subscribe().
    const nomeCanal = `${adapter.realtime.channel}:${crypto.randomUUID()}`;
    let canal = supabase.channel(nomeCanal);
    for (const b of adapter.realtime.bindings) {
      canal = canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: b.table, filter: b.filter },
        () => qc.invalidateQueries({ queryKey }),
      );
    }
    canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter.realtime.channel, qc]);

  // Reações: só as das mensagens carregadas desta conversa. O filtro `in` do Realtime
  // aceita até 100 valores — as mais recentes, que são as que aparecem na tela.
  const tabelaReacoes = adapter.realtime.reacoes?.table ?? null;
  const idsReacoes = useMemo(
    () =>
      (mensagens ?? [])
        .filter((m) => !m.id.startsWith("otimista-"))
        .slice(-100)
        .map((m) => m.id)
        .join(","),
    [mensagens],
  );
  useEffect(() => {
    if (!tabelaReacoes || !idsReacoes) return;
    const canal = supabase
      .channel(`${adapter.realtime.channel}:reacoes:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tabelaReacoes,
          filter: `mensagem_id=in.(${idsReacoes})`,
        },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter.realtime.channel, tabelaReacoes, idsReacoes, qc]);

  useIncomingChatSound(
    mensagens?.map((m) => ({ id: m.id, mine: m.remetente_tipo === mineTipo })),
    conversaId,
  );

  const { peerTyping, notifyTyping, notifyStop } = useChatTyping(
    adapter.typing.id,
    adapter.typing.myRole,
  );
  // Marca presença nesta conversa enquanto ela está aberta — é o que o outro
  // lado usa para saber que o atendimento está de fato ativo.
  useChatPresence(adapter.typing.id, adapter.typing.myRole);

  useEffect(() => {
    if (!buscaAberta) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens?.length, buscaAberta, peerTyping]);

  const enviar = useMutation({
    mutationFn: (payload: { mensagem: string; responde_a?: string; interna?: boolean }) =>
      adapter.responder({
        mensagem: payload.mensagem,
        responde_a: payload.responde_a,
        interna: payload.interna,
      }),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey });
      const anterior = qc.getQueryData<ChatMensagem[]>(queryKey);
      const alvo = payload.responde_a
        ? (anterior?.find((m) => m.id === payload.responde_a) ?? null)
        : null;
      const otimista: ChatMensagem = {
        id: `otimista-${crypto.randomUUID()}`,
        remetente_tipo: mineTipo,
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
        interna: payload.interna ?? false,
        citacao: alvo
          ? {
              autor:
                alvo.remetente_tipo === mineTipo
                  ? alvo.remetente_nome?.trim() || meuNome || "Você"
                  : alvo.remetente_nome?.trim() || peerNomeCitacao,
              texto: alvo.mensagem?.trim() || "Anexo",
            }
          : null,
        reacoes: [],
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
        ? "Sua sessão expirou. Atualize a página e entre novamente."
        : mensagemDeErro(err, "Tente de novo.");
      toast.error(`Não foi possível enviar a mensagem. ${motivo}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const salvarEdicao = useMutation({
    mutationFn: (payload: { id: string; mensagem: string }) => adapter.editar(payload),
    onSuccess: () => {
      setEditando(null);
      setTexto("");
      qc.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error(mensagemDeErro(err, "Não foi possível editar a mensagem."));
    },
  });

  const removerMsg = useMutation({
    mutationFn: (id: string) => adapter.excluir({ id }),
    onSuccess: () => {
      setConfirmarExcluir(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error(mensagemDeErro(err, "Não foi possível excluir a mensagem."));
    },
  });

  const meuIdReacao = adapter.typing.myRole; // não é o user_id real, então usamos "mine" só p/ o toggle otimista.
  const reagirMut = useMutation({
    mutationFn: (p: { mensagem_id: string; emoji: string }) => {
      if (!adapter.reagir) throw new Error("Reações indisponíveis nesta conversa.");
      return adapter.reagir(p);
    },
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey });
      const anterior = qc.getQueryData<ChatMensagem[]>(queryKey);
      qc.setQueryData<ChatMensagem[]>(queryKey, (lista) =>
        (lista ?? []).map((m) => {
          if (m.id !== p.mensagem_id) return m;
          const idx = m.reacoes.findIndex((r) => r.emoji === p.emoji);
          const proximas = [...m.reacoes];
          if (idx >= 0) {
            const cur = proximas[idx];
            if (cur.mine) {
              const cnt = cur.count - 1;
              if (cnt <= 0) proximas.splice(idx, 1);
              else proximas[idx] = { ...cur, count: cnt, mine: false };
            } else {
              proximas[idx] = { ...cur, count: cur.count + 1, mine: true };
            }
          } else {
            proximas.push({ emoji: p.emoji, count: 1, mine: true, usuarios: [] });
          }
          return { ...m, reacoes: proximas };
        }),
      );
      return { anterior };
    },
    onError: (err, _p, ctx) => {
      if (ctx?.anterior) qc.setQueryData(queryKey, ctx.anterior);
      toast.error(mensagemDeErro(err, "Não foi possível reagir."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });
  void meuIdReacao;

  const criarTarefaMut = useMutation({
    mutationFn: (payload: { titulo: string; prazo?: string; retorno?: boolean }) => {
      if (!adapter.criarTarefa) {
        return Promise.reject(new Error("Criação de tarefa não disponível nesta conversa."));
      }
      return adapter.criarTarefa({
        titulo: payload.titulo,
        prazo: payload.prazo,
        descricao: payload.retorno
          ? "Retorno agendado a partir do chat."
          : "Tarefa criada a partir do chat.",
      });
    },
    onSuccess: async (_r, vars) => {
      const quando = (iso: string) =>
        new Date(iso).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "short",
          timeStyle: "short",
        });
      const nota = vars.retorno
        ? `Retorno agendado para ${quando(vars.prazo!)}: ${vars.titulo}`
        : `Tarefa criada${vars.prazo ? ` (até ${quando(vars.prazo)})` : ""}: ${vars.titulo}`;
      try {
        await adapter.responder({ mensagem: nota, interna: true });
      } catch {
        /* silencioso — a tarefa já foi criada */
      }
      setTexto("");
      qc.invalidateQueries({ queryKey });
      toast.success(vars.retorno ? "Retorno agendado." : "Tarefa criada.");
    },
    onError: (err) => {
      const raw = err instanceof Error ? err.message : String(err);
      const motivo = /at least 2 character/i.test(raw)
        ? "Descreva a tarefa com pelo menos 2 caracteres."
        : mensagemDeErro(err, "Tente de novo.");
      toast.error(`Não foi possível criar. ${motivo}`);
    },
  });

  function submeter(payload?: ComposerSubmitPayload) {
    const modo = payload?.modo ?? "mensagem";
    const t = (payload?.texto ?? texto).trim();
    if (!t) return;
    notifyStop();

    if (editando) {
      if (salvarEdicao.isPending) return;
      salvarEdicao.mutate({ id: editando.id, mensagem: t });
      return;
    }
    if (modo === "tarefa" || modo === "retorno") {
      if (t.length < 2) {
        toast.error("Descreva a tarefa com pelo menos 2 caracteres.");
        return;
      }
      if (!payload?.prazo && modo === "retorno") {
        toast.error("Selecione a data/hora do retorno.");
        return;
      }
      criarTarefaMut.mutate({
        titulo: t,
        prazo: payload?.prazo,
        retorno: modo === "retorno",
      });
      return;
    }
    if (enviar.isPending) return;
    enviar.mutate({
      mensagem: t,
      responde_a: respondendo?.id,
      interna: modo === "nota",
    });
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

  async function enviarArquivoDireto(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB).");
      return;
    }
    setEnviandoAnexo(true);
    try {
      const path = await adapter.uploadAnexo(file);
      await adapter.responder({
        mensagem: texto.trim() || undefined,
        anexo_path: path,
        anexo_nome: file.name,
        anexo_tamanho: file.size,
        responde_a: respondendo?.id,
      });
      setTexto("");
      setRespondendo(null);
      qc.invalidateQueries({ queryKey });
      toast.success("Arquivo enviado.");
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível enviar o arquivo."));
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function handleAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await enviarArquivoDireto(file);
    } finally {
      if (e.target) e.target.value = "";
    }
  }

  const filtradas = useMemo(() => {
    const lista = mensagens ?? [];
    const t = buscaMsg.trim().toLowerCase();
    if (!buscaAberta || !t) return lista;
    return lista.filter((m) => (m.mensagem ?? "").toLowerCase().includes(t));
  }, [mensagens, buscaMsg, buscaAberta]);

  const capabilities = adapter.capabilities ?? {};
  const cap = {
    responder: capabilities.responder ?? true,
    editar: capabilities.editar ?? true,
    excluir: capabilities.excluir ?? true,
    reagir: capabilities.reagir ?? true,
    notaInterna: capabilities.notaInterna ?? true,
    tarefa: capabilities.tarefa ?? true,
    retorno: capabilities.retorno ?? true,
    anexo: capabilities.anexo ?? true,
    respostasRapidas: capabilities.respostasRapidas ?? true,
    audio: capabilities.audio ?? true,
  };

  const headerBuscaProps = {
    buscaAberta,
    toggleBusca: () => {
      setBuscaAberta((v) => !v);
      setBuscaMsg("");
    },
    buscaMsg,
    setBuscaMsg,
    acoes,
  };

  return (
    <Card className="flex h-full min-w-0 flex-col overflow-hidden border-border/60 shadow-sm">
      {adapter.renderHeader ? (
        adapter.renderHeader(headerBuscaProps)
      ) : (
        <ChatClienteHeader
          info={info}
          clienteId={headerClienteId}
          acoes={acoes}
          buscaAberta={headerBuscaProps.buscaAberta}
          toggleBusca={headerBuscaProps.toggleBusca}
          buscaMsg={headerBuscaProps.buscaMsg}
          setBuscaMsg={headerBuscaProps.setBuscaMsg}
        />
      )}

      <ListaMensagens
        filtradas={filtradas}
        isLoading={isLoading}
        erro={
          isError && !mensagens
            ? mensagemDeErro(erroLista, "Não foi possível carregar a conversa.")
            : null
        }
        onTentarDeNovo={() => void refetch()}
        meuId={adapter.meuId ?? null}
        buscaAberta={buscaAberta}
        buscaMsg={buscaMsg}
        info={info}
        peerTyping={peerTyping}
        fimRef={fimRef}
        iniciarResposta={iniciarResposta}
        iniciarEdicao={iniciarEdicao}
        copiar={copiar}
        onExcluir={setConfirmarExcluir}
        onReagir={
          cap.reagir && adapter.reagir
            ? (mensagem_id, emoji) => reagirMut.mutate({ mensagem_id, emoji })
            : undefined
        }
        capabilities={{
          responder: cap.responder,
          editar: cap.editar,
          excluir: cap.excluir,
          reagir: true,
        }}
      />

      {somenteLeitura ? (
        <div className="border-t border-border/60 bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
          {atendenteNome ? (
            <>
              Visualizando a conversa de{" "}
              <span className="font-medium text-foreground">{atendenteNome}</span>, somente leitura.
              Para falar com este cliente, abra a sua própria conversa.
            </>
          ) : (
            "Somente leitura. Você não tem permissão para responder nesta conversa."
          )}
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
          enviarArquivo={cap.audio ? enviarArquivoDireto : undefined}
          enviandoAnexo={enviandoAnexo}
          enviarPending={enviar.isPending || criarTarefaMut.isPending}
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
          capabilities={{
            notaInterna: cap.notaInterna,
            tarefa: cap.tarefa,
            retorno: cap.retorno,
            anexo: cap.anexo,
            respostasRapidas: cap.respostasRapidas,
            audio: cap.audio,
          }}
        />
      )}

      <AlertDialog open={!!confirmarExcluir} onOpenChange={(o) => !o && setConfirmarExcluir(null)}>
        <AlertDialogContent className="z-[90]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem será marcada como excluída para você e para o cliente. Esta ação não pode
              ser desfeita.
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

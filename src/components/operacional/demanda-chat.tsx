import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCheck, Loader2, Maximize2, MessageCircle, Search, Send } from "lucide-react";
import { toast } from "sonner";
import {
  abrirDemandaChatFlutuante,
  fecharChatFlutuante,
  useFloatingChat,
} from "@/components/shared/floating-chat-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { supabase } from "@/integrations/supabase/client";
import {
  comentarDemanda,
  marcarDemandaLida,
  obterDemanda,
} from "@/lib/operacional/demandas.functions";
import { getMinhaSessao } from "@/lib/session.functions";
import { cn } from "@/lib/utils";

type DemandaChatInfo = {
  numero?: string | null;
  titulo?: string | null;
  statusLabel?: string | null;
  interlocutorNome?: string | null;
  interlocutorFoto?: string | null;
};

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
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function DemandaChatTab({
  demandaId,
  info,
}: {
  demandaId: string;
  info?: DemandaChatInfo;
}) {
  const flutuante = useFloatingChat();
  const estaFlutuando = flutuante?.kind === "demanda" && flutuante.demandaId === demandaId;

  if (estaFlutuando) {
    return (
      <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Maximize2 className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Aberta em janela flutuante</p>
          <p className="text-xs text-muted-foreground">
            A conversa continua disponível enquanto você navega pelo sistema.
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
    <div className="relative h-full min-h-[32rem] min-w-0 overflow-hidden">
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => abrirDemandaChatFlutuante(demandaId, info)}
          title="Soltar em janela flutuante"
          aria-label="Soltar em janela flutuante"
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Maximize2 className="size-3.5" />
          <span className="hidden sm:inline">Soltar chat</span>
        </button>
        <ConversaMenuAcoesLive
          chatTipo="demanda"
          chatId={demandaId}
          nomeReferencia={info?.interlocutorNome ?? info?.titulo ?? info?.numero ?? null}
        />
      </div>

      <DemandaChatConversa demandaId={demandaId} info={info} />
    </div>
  );
}

export function DemandaChatConversa({
  demandaId,
  info,
}: {
  demandaId: string;
  info?: DemandaChatInfo;
}) {
  const qc = useQueryClient();
  const obterFn = useServerFn(obterDemanda);
  const comentarFn = useServerFn(comentarDemanda);
  const marcarLidaFn = useServerFn(marcarDemandaLida);
  const sessaoFn = useServerFn(getMinhaSessao);
  const fimRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [buscaMsg, setBuscaMsg] = useState("");

  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => sessaoFn(),
    staleTime: 5 * 60_000,
  });
  const meuId = sessao?.profile?.id ?? null;
  const meuNome = sessao?.profile?.nome?.trim() || "Eu";
  const queryKey = useMemo(() => ["demanda", demandaId] as const, [demandaId]);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => obterFn({ data: { id: demandaId } }),
  });

  useEffect(() => {
    const canal = supabase
      .channel(`demanda:${demandaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "demanda_mensagens", filter: `demanda_id=eq.${demandaId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "demandas", filter: `id=eq.${demandaId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [demandaId, qc, queryKey]);

  const ultimaMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    const mensagens = (data as any)?.mensagens ?? [];
    const ultima = mensagens[mensagens.length - 1]?.id ?? null;
    if (ultima && ultima !== ultimaMsgIdRef.current) {
      ultimaMsgIdRef.current = ultima;
      marcarLidaFn({ data: { demanda_id: demandaId } }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["demandas"] });
    }
  }, [(data as any)?.mensagens, demandaId, marcarLidaFn, qc, queryKey]);

  const mensagens = ((data as any)?.mensagens ?? []) as any[];
  const chatItens = useMemo(
    () => mensagens.map((m) => ({ id: m.id as string, mine: m.autor_id === meuId })),
    [mensagens, meuId],
  );
  useIncomingChatSound(chatItens, demandaId);

  useEffect(() => {
    if (!buscaAberta) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length, buscaAberta]);

  const filtradas = useMemo(() => {
    const termo = buscaMsg.trim().toLowerCase();
    if (!buscaAberta || !termo) return mensagens;
    return mensagens.filter((m) => (m.corpo ?? "").toLowerCase().includes(termo));
  }, [buscaAberta, buscaMsg, mensagens]);

  const enviar = useMutation({
    mutationFn: (corpo: string) =>
      comentarFn({ data: { demanda_id: demandaId, corpo, visivel_cliente: false } }),
    onMutate: async (corpo) => {
      await qc.cancelQueries({ queryKey });
      const anterior = qc.getQueryData<any>(queryKey);
      const otimista = {
        id: `otimista-${crypto.randomUUID()}`,
        demanda_id: demandaId,
        autor_id: meuId,
        nome_autor: meuNome,
        corpo,
        created_at: new Date().toISOString(),
      };
      if (anterior) {
        qc.setQueryData(queryKey, {
          ...anterior,
          mensagens: [...(anterior.mensagens ?? []), otimista],
        });
      }
      setTexto("");
      return { anterior };
    },
    onError: (err, _corpo, ctx) => {
      if (ctx?.anterior) qc.setQueryData(queryKey, ctx.anterior);
      toast.error(err instanceof Error ? err.message : "Falha ao enviar mensagem.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
  });

  function submeter() {
    const corpo = texto.trim();
    if (!corpo || enviar.isPending) return;
    enviar.mutate(corpo);
  }

  const demanda = (data as any)?.demanda;
  const titulo = demanda?.titulo ?? info?.titulo ?? "Demanda";
  const numero = demanda?.numero ?? info?.numero ?? "DEM-—";
  const statusLabel = info?.statusLabel ?? demanda?.status ?? "Demanda";
  const primeiroOutroAutor = [...mensagens]
    .reverse()
    .find((m) => m.autor_id && m.autor_id !== meuId)?.nome_autor as string | null | undefined;
  const nomeCriador = ((data as any)?.nome_criador as string | null | undefined) ?? null;
  const nomeResponsavel = ((data as any)?.nome_responsavel as string | null | undefined) ?? null;
  const souCriador = Boolean(meuId && demanda?.criador_id === meuId);
  const souResponsavel = Boolean(meuId && demanda?.responsavel_id === meuId);
  const interlocutorNome =
    info?.interlocutorNome ??
    primeiroOutroAutor ??
    (souCriador ? nomeResponsavel : souResponsavel ? nomeCriador : nomeResponsavel ?? nomeCriador) ??
    "Usuário";
  const interlocutorContexto = souCriador
    ? "Responsável pela demanda"
    : souResponsavel
      ? "Solicitante da demanda"
      : "Participante da demanda";

  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-border/60 shadow-sm">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b bg-card px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm ring-2 ring-primary/15">
          {info?.interlocutorFoto ? (
            <img src={info.interlocutorFoto} alt={interlocutorNome} className="size-full object-cover" />
          ) : (
            iniciais(interlocutorNome)
          )}
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-success" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate pr-24 text-sm font-semibold text-foreground sm:pr-32">
            Conversando com {interlocutorNome}
          </p>
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="h-5 shrink-0 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold uppercase text-warning-foreground">
              {numero}
            </span>
            <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground sm:inline-flex">
              {interlocutorContexto}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {titulo} · {statusLabel}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 overflow-hidden sm:gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-lg text-muted-foreground"
            onClick={() => {
              setBuscaAberta((v) => !v);
              setBuscaMsg("");
            }}
            title="Buscar na conversa"
          >
            <Search className="size-4" />
          </Button>
        </div>
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

      <div className="chat-surface min-w-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-12 w-2/3 rounded-2xl bg-muted" />
            <div className="ml-auto h-12 w-2/3 rounded-2xl bg-muted" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="size-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {buscaAberta && buscaMsg.trim() ? "Nenhuma mensagem encontrada" : "Nenhuma mensagem ainda"}
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
            const minha = m.autor_id === meuId;
            const anterior = filtradas[i - 1];
            const proxima = filtradas[i + 1];
            const mostrarDia = !anterior || formatarDia(anterior.created_at) !== formatarDia(m.created_at);
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
                      {iniciais(m.nome_autor)}
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
                    {!mesmoAutorAntes && (
                      <p
                        className={cn(
                          "mb-0.5 text-[11px] font-semibold",
                          minha ? "text-primary-foreground/90" : "text-chat-them-foreground/80",
                        )}
                      >
                        {m.nome_autor ?? (minha ? "Eu" : "Usuário")}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.corpo}</p>
                    <div
                      className={cn(
                        "mt-1 flex items-center justify-end gap-1 text-[10px]",
                        minha ? "text-primary-foreground/70" : "text-chat-them-foreground/60",
                      )}
                    >
                      <span>{formatarHora(m.created_at)}</span>
                      {minha && (
                        <span title={otimista ? "Enviando" : "Enviado"}>
                          {otimista ? <Check className="size-3.5" /> : <CheckCheck className="size-3.5" />}
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
            if (e.key === "Escape") setTexto("");
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
            {enviar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Enviar
          </Button>
        </div>
      </div>
    </Card>
  );
}

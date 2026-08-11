import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { Archive, ArrowLeft, Loader2, MessageCircle, MessagesSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { listarThreadsCentral, type ThreadKind } from "@/lib/chats/central.functions";
import {
  listarEstadoChatDoUsuario,
  listarEtiquetas,
  listarVinculosEtiqueta,
  type EstadoChat,
  type EtiquetaChat,
} from "@/lib/chats/gestao.functions";
import {
  chaveConversa,
  ehSelecionado,
  threadParaSelecionado,
  type SelecionadoState,
} from "./helpers";
import { ThreadItem } from "./thread-item";
import { IniciarDmInline, NovaConversaDialog } from "./iniciar-dm";
import { PainelConversa } from "./painel-conversa";

export function CentralChatPage() {
  const listarFn = useServerFn(listarThreadsCentral);
  const listarEstadoFn = useServerFn(listarEstadoChatDoUsuario);
  const listarVinculosFn = useServerFn(listarVinculosEtiqueta);
  const listarEtiquetasFn = useServerFn(listarEtiquetas);
  const { data: threads, isLoading } = useQuery({
    queryKey: ["threads-central"],
    queryFn: () => listarFn(),
    refetchInterval: 15_000,
  });
  const { data: estados } = useQuery({
    queryKey: ["chat-estado-usuario"],
    queryFn: () => listarEstadoFn(),
    refetchInterval: 30_000,
  });
  const { data: vinculos } = useQuery({
    queryKey: ["chat-etiqueta-vinculos"],
    queryFn: () => listarVinculosFn(),
    refetchInterval: 30_000,
  });
  const { data: etiquetas } = useQuery({
    queryKey: ["chat-etiquetas"],
    queryFn: () => listarEtiquetasFn(),
  });

  const estadoPor = useMemo(() => {
    const m = new Map<string, EstadoChat>();
    for (const e of estados ?? []) m.set(chaveConversa(e.chat_tipo, e.chat_id), e);
    return m;
  }, [estados]);

  const etiquetaPor = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const v of vinculos ?? []) {
      const k = chaveConversa(v.chat_tipo, v.chat_id);
      const arr = m.get(k) ?? [];
      arr.push(v.etiqueta_id);
      m.set(k, arr);
    }
    return m;
  }, [vinculos]);

  const catalogoEtiquetas = useMemo(() => {
    const m = new Map<string, EtiquetaChat>();
    for (const e of etiquetas ?? []) m.set(e.id, e);
    return m;
  }, [etiquetas]);

  const [aba, setAba] = useState<"todos" | ThreadKind | "arquivadas">("todos");
  const [termo, setTermo] = useState("");
  const [selecionado, setSelecionado] = useState<SelecionadoState>(null);

  const filtradas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    const list = (threads ?? [])
      .map((th) => {
        const st = estadoPor.get(chaveConversa(th.kind, th.id));
        return {
          th,
          arquivado: !!st?.arquivado_em,
          oculto: !!st?.oculto_em,
          fixado: !!st?.pinado_em,
          apelido: st?.apelido ?? null,
        };
      })
      .filter((r) => !r.oculto)
      .filter((r) => (aba === "arquivadas" ? r.arquivado : !r.arquivado))
      .filter((r) => (aba === "todos" || aba === "arquivadas" ? true : r.th.kind === aba))
      .filter((r) => {
        if (!t) return true;
        const th = r.th;
        return (
          th.titulo.toLowerCase().includes(t) ||
          (r.apelido?.toLowerCase().includes(t) ?? false) ||
          (th.subtitulo?.toLowerCase().includes(t) ?? false) ||
          (th.demanda_titulo?.toLowerCase().includes(t) ?? false) ||
          (th.ultima_mensagem?.toLowerCase().includes(t) ?? false)
        );
      });
    list.sort((a, b) => {
      if (a.fixado !== b.fixado) return a.fixado ? -1 : 1;
      const ta = a.th.ultima_em ? new Date(a.th.ultima_em).getTime() : 0;
      const tb = b.th.ultima_em ? new Date(b.th.ultima_em).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [threads, aba, termo, estadoPor]);

  const totalNaoLidas = (threads ?? []).reduce((acc, t) => acc + (t.nao_lidas ?? 0), 0);
  const totalArquivadas = (threads ?? []).filter(
    (t) => estadoPor.get(chaveConversa(t.kind, t.id))?.arquivado_em,
  ).length;

  const router = useRouter();

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] w-full max-w-[1400px] flex-col gap-3 px-2 py-2 sm:px-4 sm:py-3 lg:px-6">
      <div className="flex items-center gap-3 px-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => (selecionado ? setSelecionado(null) : router.history.back())}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">Conversas</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Colegas, clientes e demandas — tudo em um só lugar.
          </p>
        </div>
        {totalNaoLidas > 0 && (
          <Badge
            variant="secondary"
            className="rounded-full bg-primary/10 font-semibold text-primary"
          >
            {totalNaoLidas}
          </Badge>
        )}
        <NovaConversaDialog
          onCriado={(conv) =>
            setSelecionado({ kind: "dm", conversaId: conv.id, nome: conv.nome, foto: null })
          }
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-3xl border border-border/50 bg-card/50 shadow-sm backdrop-blur lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Coluna de conversas — estilo mensageiro */}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col overflow-hidden lg:border-r lg:border-border/50",
            selecionado ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="space-y-2.5 border-b border-border/40 p-3">
            <IniciarDmInline
              onCriado={(conv) =>
                setSelecionado({ kind: "dm", conversaId: conv.id, nome: conv.nome, foto: null })
              }
            />
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Buscar conversas…"
                className="h-10 rounded-full border-transparent bg-muted/60 pl-10 text-sm shadow-inner focus-visible:border-primary/40 focus-visible:bg-background"
              />
            </div>
            <Tabs value={aba} onValueChange={(v) => setAba(v as any)}>
              <TabsList className="flex h-9 w-full items-center gap-1 rounded-full bg-muted/50 p-1">
                <TabsTrigger
                  value="todos"
                  className="flex-1 rounded-full text-[11.5px] font-semibold"
                >
                  Tudo
                </TabsTrigger>
                <TabsTrigger value="dm" className="flex-1 rounded-full text-[11.5px] font-semibold">
                  Diretas
                </TabsTrigger>
                <TabsTrigger
                  value="cliente"
                  className="flex-1 rounded-full text-[11.5px] font-semibold"
                >
                  Clientes
                </TabsTrigger>
                <TabsTrigger
                  value="demanda"
                  className="flex-1 rounded-full text-[11.5px] font-semibold"
                >
                  Demandas
                </TabsTrigger>
                <TabsTrigger
                  value="arquivadas"
                  className="shrink-0 gap-1 rounded-full px-2"
                  aria-label="Arquivadas"
                >
                  <Archive className="size-3.5" />
                  {totalArquivadas > 0 && <span className="text-[10px]">{totalArquivadas}</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !filtradas.length ? (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                  <MessagesSquare className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Nenhuma conversa por aqui</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Chame um colega para bater um papo 👋
                  </p>
                </div>
              </div>
            ) : (
              <ul className="py-1">
                {filtradas.map((r) => {
                  const t = r.th;
                  const chave = chaveConversa(t.kind, t.id);
                  const etiquetasDaConv = (etiquetaPor.get(chave) ?? [])
                    .map((id) => catalogoEtiquetas.get(id))
                    .filter(Boolean) as EtiquetaChat[];
                  return (
                    <li key={chave}>
                      <ThreadItem
                        thread={t}
                        selecionado={ehSelecionado(selecionado, t)}
                        onClick={() => setSelecionado(threadParaSelecionado(t))}
                        apelido={r.apelido}
                        fixado={r.fixado}
                        arquivado={r.arquivado}
                        etiquetas={etiquetasDaConv}
                        etiquetaIds={etiquetaPor.get(chave) ?? []}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Área da conversa */}
        <div
          className={cn(
            "min-h-0 min-w-0 flex-col bg-gradient-to-br from-background/60 via-background/40 to-muted/20",
            selecionado ? "flex" : "hidden lg:flex",
          )}
        >
          {!selecionado ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary shadow-inner">
                <MessageCircle className="size-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Suas conversas ficam aqui</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha um contato ao lado ou comece uma nova conversa.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col p-2 sm:p-3">
              <PainelConversa
                selecionado={selecionado}
                estadoPor={estadoPor}
                etiquetaPor={etiquetaPor}
                onVoltar={() => setSelecionado(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

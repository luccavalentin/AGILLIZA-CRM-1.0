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
import {
  listarThreadsCentral,
  type ThreadKind,
} from "@/lib/chats/central.functions";
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
    <div className="mx-auto flex h-[calc(100vh-9rem)] w-full max-w-[1400px] flex-col gap-4 px-4 py-4 lg:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => router.history.back()}
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Central de Conversas</h1>
          <p className="text-sm text-muted-foreground">
            Todos os chats do sistema em um único lugar — colegas, clientes e demandas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalNaoLidas > 0 && <Badge className="rounded-full">{totalNaoLidas} não lidas</Badge>}
          <NovaConversaDialog
            onCriado={(conv) =>
              setSelecionado({ kind: "dm", conversaId: conv.id, nome: conv.nome })
            }
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="space-y-3 border-b p-3">
            <IniciarDmInline
              onCriado={(conv) =>
                setSelecionado({ kind: "dm", conversaId: conv.id, nome: conv.nome })
              }
            />
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Pesquisar conversas…"
                className="pl-9"
              />
            </div>
            <Tabs value={aba} onValueChange={(v) => setAba(v as any)}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="todos">Tudo</TabsTrigger>
                <TabsTrigger value="dm">Diretas</TabsTrigger>
                <TabsTrigger value="cliente">Clientes</TabsTrigger>
                <TabsTrigger value="demanda">Demandas</TabsTrigger>
                <TabsTrigger value="arquivadas" className="gap-1">
                  <Archive className="size-3" />
                  {totalArquivadas > 0 && <span className="text-[10px]">{totalArquivadas}</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !filtradas.length ? (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                  <MessagesSquare className="size-6" />
                </div>
                <p className="text-sm font-medium">Nenhuma conversa</p>
                <p className="text-xs text-muted-foreground">
                  Inicie uma nova conversa direta com um colega.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
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
        </Card>

        <div className="min-h-0 min-w-0">
          {!selecionado ? (
            <Card className="flex h-full flex-col items-center justify-center gap-3 border-dashed p-10 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="size-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Selecione uma conversa</p>
                <p className="text-sm text-muted-foreground">
                  Escolha uma conversa à esquerda ou inicie uma nova mensagem direta.
                </p>
              </div>
            </Card>
          ) : (
            <PainelConversa
              selecionado={selecionado}
              estadoPor={estadoPor}
              etiquetaPor={etiquetaPor}
            />
          )}
        </div>
      </div>
    </div>
  );
}

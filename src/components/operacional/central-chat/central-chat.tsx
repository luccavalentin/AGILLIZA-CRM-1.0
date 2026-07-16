import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  Maximize2,
  MessageCircle,
  MessagesSquare,
  Plus,
  Search,
  UserCircle2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  abrirChatFlutuante,
  abrirDemandaChatFlutuante,
  abrirDmFlutuante,
} from "@/components/shared/floating-chat-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatClienteConversa } from "@/components/crm/chat-cliente-tab";
import { DemandaChatConversa } from "@/components/operacional/demanda-chat";
import { DmConversa } from "@/components/operacional/central-chat/dm-conversa";
import {
  buscarColegasDm,
  iniciarDm,
  listarThreadsCentral,
  type ThreadCentral,
  type ThreadKind,
} from "@/lib/chats/central.functions";
import {
  ConversaMenuAcoes,
  EtiquetasPills,
} from "@/components/shared/conversa-menu-acoes";
import {
  listarEstadoChatDoUsuario,
  listarEtiquetas,
  listarVinculosEtiqueta,
  type ChatTipo,
  type EstadoChat,
  type EtiquetaChat,
} from "@/lib/chats/gestao.functions";
import { cn } from "@/lib/utils";

function chaveConversa(kind: ChatTipo | ThreadKind, id: string) {
  return `${kind}-${id}`;
}

function iniciais(nome?: string | null): string {
  if (!nome) return "?";
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const agora = new Date();
  const diff = (agora.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  const dias = Math.floor(diff / 86400);
  if (dias < 7) return `${dias} d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const RÓTULOS: Record<ThreadKind, { label: string; icon: typeof Users }> = {
  dm: { label: "Direta", icon: UserCircle2 },
  cliente: { label: "Cliente", icon: MessageCircle },
  demanda: { label: "Demanda", icon: MessagesSquare },
};

type SelecionadoState =
  | { kind: "dm"; conversaId: string; nome: string | null }
  | { kind: "cliente"; clienteId: string; nome: string | null; foto: string | null }
  | {
      kind: "demanda";
      demandaId: string;
      numero: string | null;
      titulo: string | null;
      interlocutorNome: string | null;
      interlocutorFoto: string | null;
    }
  | null;

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
      .filter((r) =>
        aba === "arquivadas" ? r.arquivado : !r.arquivado,
      )
      .filter((r) =>
        aba === "todos" || aba === "arquivadas" ? true : r.th.kind === aba,
      )
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
          {totalNaoLidas > 0 && (
            <Badge className="rounded-full">{totalNaoLidas} não lidas</Badge>
          )}
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="todos">Tudo</TabsTrigger>
                <TabsTrigger value="dm">Diretas</TabsTrigger>
                <TabsTrigger value="cliente">Clientes</TabsTrigger>
                <TabsTrigger value="demanda">Demandas</TabsTrigger>
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
                {filtradas.map((t) => (
                  <li key={`${t.kind}-${t.id}`}>
                    <ThreadItem
                      thread={t}
                      selecionado={ehSelecionado(selecionado, t)}
                      onClick={() => setSelecionado(threadParaSelecionado(t))}
                    />
                  </li>
                ))}
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
          ) : selecionado.kind === "dm" ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="mb-2 flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                <Avatar className="size-10 border border-border/60">
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                    {iniciais(selecionado.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                    Mensagem direta
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    Conversando com {selecionado.nome ?? "colega"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    abrirDmFlutuante(selecionado.conversaId, { nome: selecionado.nome })
                  }
                >
                  <Maximize2 className="size-3.5" />
                  <span className="hidden sm:inline">Soltar chat</span>
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <DmConversa conversaId={selecionado.conversaId} />
              </div>
            </div>
          ) : selecionado.kind === "cliente" ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="mb-2 flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                <Avatar className="size-10 border border-border/60">
                  {selecionado.foto && <AvatarImage src={selecionado.foto} alt={selecionado.nome ?? ""} />}
                  <AvatarFallback className="bg-success text-xs font-semibold text-success-foreground">
                    {iniciais(selecionado.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    Cliente
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    Conversando com {selecionado.nome ?? "cliente"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    abrirChatFlutuante(selecionado.clienteId, { nome: selecionado.nome ?? "Cliente" })
                  }
                >
                  <Maximize2 className="size-3.5" />
                  <span className="hidden sm:inline">Soltar chat</span>
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <ChatClienteConversa
                  clienteId={selecionado.clienteId}
                  info={{ nome: selecionado.nome ?? "Cliente" }}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="mb-2 flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                <Avatar className="size-10 border border-border/60">
                  {selecionado.interlocutorFoto && (
                    <AvatarImage
                      src={selecionado.interlocutorFoto}
                      alt={selecionado.interlocutorNome ?? "Usuário"}
                    />
                  )}
                  <AvatarFallback className="bg-warning text-xs font-semibold text-warning-foreground">
                    {iniciais(selecionado.interlocutorNome ?? selecionado.numero ?? "DE")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                    Demanda · {selecionado.numero ?? "—"}
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    Conversando com {selecionado.interlocutorNome ?? "usuário da demanda"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selecionado.titulo ?? "Chat da demanda"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    abrirDemandaChatFlutuante(selecionado.demandaId, {
                      numero: selecionado.numero,
                      titulo: selecionado.titulo,
                      interlocutorNome: selecionado.interlocutorNome,
                      interlocutorFoto: selecionado.interlocutorFoto,
                    })
                  }
                >
                  <Maximize2 className="size-3.5" />
                  <span className="hidden sm:inline">Soltar chat</span>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/operacional/demandas/$id" params={{ id: selecionado.demandaId }}>
                    Abrir demanda
                  </Link>
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <DemandaChatConversa
                  demandaId={selecionado.demandaId}
                  info={{
                    numero: selecionado.numero,
                    titulo: selecionado.titulo,
                    interlocutorNome: selecionado.interlocutorNome,
                    interlocutorFoto: selecionado.interlocutorFoto,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ehSelecionado(sel: SelecionadoState, t: ThreadCentral): boolean {
  if (!sel) return false;
  if (sel.kind !== t.kind) return false;
  if (sel.kind === "dm" && t.kind === "dm") return sel.conversaId === t.id;
  if (sel.kind === "cliente" && t.kind === "cliente") return sel.clienteId === t.id;
  if (sel.kind === "demanda" && t.kind === "demanda") return sel.demandaId === t.id;
  return false;
}

function threadParaSelecionado(t: ThreadCentral): SelecionadoState {
  if (t.kind === "dm") return { kind: "dm", conversaId: t.id, nome: t.titulo };
  if (t.kind === "cliente")
    return { kind: "cliente", clienteId: t.id, nome: t.titulo, foto: t.avatar_url ?? null };
  return {
    kind: "demanda",
    demandaId: t.id,
    numero: t.subtitulo,
    titulo: t.demanda_titulo ?? null,
    interlocutorNome: t.interlocutor_nome ?? t.titulo ?? null,
    interlocutorFoto: t.interlocutor_foto ?? t.avatar_url ?? null,
  };
}

function ThreadItem({
  thread,
  selecionado,
  onClick,
}: {
  thread: ThreadCentral;
  selecionado: boolean;
  onClick: () => void;
}) {
  const rot = RÓTULOS[thread.kind];
  const Icon = rot.icon;

  // Nome de exibição principal — a pessoa com quem se conversa.
  const nomePrincipal =
    thread.kind === "demanda"
      ? thread.interlocutor_nome?.trim() || thread.titulo || "Usuário da demanda"
      : thread.titulo;

  const contexto =
    thread.kind === "demanda"
      ? [thread.subtitulo?.trim(), thread.demanda_titulo?.trim()].filter(Boolean).join(" · ") || null
      : null;

  const badgeClasses: Record<ThreadKind, string> = {
    dm: "bg-primary text-primary-foreground",
    cliente: "bg-success text-success-foreground",
    demanda: "bg-warning text-warning-foreground",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
        selecionado && "bg-primary/10 hover:bg-primary/10",
      )}
    >
      <Avatar className="size-10 border border-border/60">
        {thread.avatar_url && <AvatarImage src={thread.avatar_url} alt={nomePrincipal} />}
        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
          {iniciais(nomePrincipal)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              badgeClasses[thread.kind],
            )}
          >
            <Icon className="size-3" />
            {rot.label}
          </span>
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            {tempoRelativo(thread.ultima_em)}
          </span>
        </div>
        <p className="truncate text-sm font-semibold text-foreground">
          {thread.kind === "demanda" ? `Conversando com ${nomePrincipal}` : nomePrincipal}
        </p>
        {contexto && (
          <p className="truncate text-[11px] text-muted-foreground/90">{contexto}</p>
        )}
        <p className="truncate text-xs text-muted-foreground">
          {thread.ultima_mensagem?.trim() || "Sem mensagens ainda"}
        </p>
      </div>
      {thread.nao_lidas > 0 && (
        <Badge className="mt-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
          {thread.nao_lidas}
        </Badge>
      )}
    </button>
  );
}

function NovaConversaDialog({
  onCriado,
}: {
  onCriado: (v: { id: string; nome: string | null }) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const buscarFn = useServerFn(buscarColegasDm);
  const iniciarFn = useServerFn(iniciarDm);
  const qc = useQueryClient();

  const { data: colegas, isLoading } = useQuery({
    queryKey: ["dm-colegas", termo],
    queryFn: () => buscarFn({ data: { termo } }),
    enabled: aberto,
  });

  const iniciar = useMutation({
    mutationFn: (other: { id: string; nome: string | null }) =>
      iniciarFn({ data: { other_id: other.id } }).then((r) => ({ id: r.id, nome: other.nome })),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["threads-central"] });
      setAberto(false);
      onCriado(r);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao iniciar conversa."),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" /> Nova mensagem
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar mensagem direta</DialogTitle>
          <DialogDescription>Escolha um colega para começar a conversa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar por nome…"
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-64 rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !colegas?.length ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum colega encontrado.
              </p>
            ) : (
              <ul className="divide-y">
                {colegas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => iniciar.mutate({ id: c.id, nome: c.nome })}
                      disabled={iniciar.isPending}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                    >
                      <Avatar className="size-9 border border-border/60">
                        {c.foto_url && <AvatarImage src={c.foto_url} alt={c.nome ?? ""} />}
                        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                          {iniciais(c.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.nome ?? "Sem nome"}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.email ?? ""}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

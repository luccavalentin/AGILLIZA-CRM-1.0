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
import { cn } from "@/lib/utils";

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
  | { kind: "demanda"; demandaId: string; numero: string | null; titulo: string | null }
  | null;

export function CentralChatPage() {
  const listarFn = useServerFn(listarThreadsCentral);
  const { data: threads, isLoading } = useQuery({
    queryKey: ["threads-central"],
    queryFn: () => listarFn(),
    refetchInterval: 15_000,
  });

  const [aba, setAba] = useState<"todos" | ThreadKind>("todos");
  const [termo, setTermo] = useState("");
  const [selecionado, setSelecionado] = useState<SelecionadoState>(null);

  const filtradas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return (threads ?? [])
      .filter((th) => (aba === "todos" ? true : th.kind === aba))
      .filter((th) =>
        !t
          ? true
          : th.titulo.toLowerCase().includes(t) ||
            (th.subtitulo?.toLowerCase().includes(t) ?? false) ||
            (th.ultima_mensagem?.toLowerCase().includes(t) ?? false),
      );
  }, [threads, aba, termo]);

  const totalNaoLidas = (threads ?? []).reduce((acc, t) => acc + (t.nao_lidas ?? 0), 0);

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] w-full max-w-[1400px] flex-col gap-4 px-4 py-4 lg:px-6">
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
            <DmConversa conversaId={selecionado.conversaId} />
          ) : selecionado.kind === "cliente" ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="mb-2 flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                <Avatar className="size-10 border border-border/60">
                  {selecionado.foto && <AvatarImage src={selecionado.foto} alt={selecionado.nome ?? ""} />}
                  <AvatarFallback className="bg-emerald-600 text-xs font-semibold text-white">
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
                  <AvatarFallback className="bg-amber-600 text-xs font-semibold text-white">
                    {iniciais(selecionado.numero ?? "DE")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Demanda · {selecionado.numero ?? "—"}
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {selecionado.titulo ?? "Chat da demanda"}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/operacional/demandas/$id" params={{ id: selecionado.demandaId }}>
                    Abrir demanda
                  </Link>
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <DemandaChatConversa
                  demandaId={selecionado.demandaId}
                  info={{ numero: selecionado.numero, titulo: selecionado.titulo }}
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
  return { kind: "demanda", demandaId: t.id, numero: t.subtitulo, titulo: t.titulo };
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

  // Nome de exibição principal — a "pessoa" com quem se conversa.
  //  - DM: nome do colega (thread.titulo)
  //  - Cliente: nome do cliente (thread.titulo)
  //  - Demanda: número da demanda (identificação clara, não o título)
  const nomePrincipal =
    thread.kind === "demanda"
      ? thread.subtitulo?.trim() || "Demanda"
      : thread.titulo;

  // Linha secundária de contexto (aparece antes da última mensagem):
  //  - Demanda: mostra o título da demanda
  //  - Cliente/DM: sem contexto extra
  const contexto =
    thread.kind === "demanda" ? thread.titulo?.trim() || null : null;

  const badgeClasses: Record<ThreadKind, string> = {
    dm: "bg-sky-600 text-white dark:bg-sky-500",
    cliente: "bg-emerald-600 text-white dark:bg-emerald-500",
    demanda: "bg-amber-600 text-white dark:bg-amber-500",
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
        <p className="truncate text-sm font-semibold text-foreground">{nomePrincipal}</p>
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

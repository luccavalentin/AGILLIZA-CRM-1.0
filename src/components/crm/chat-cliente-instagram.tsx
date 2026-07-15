import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Phone,
  MessageSquare,
  Mail,
  Users2,
  MapPin,
  Clock,
  MessagesSquare,
  FileText,
  Workflow,
  History,
  ChevronLeft,
  Activity,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { listarInteracoes, listarHistorico } from "@/lib/crm/clientes.functions";
import { ChatClienteConversa, type ChatClienteInfo } from "./chat-cliente-tab";

function iniciais(nome?: string | null) {
  if (!nome) return "?";
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function tempoRelativo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `${dias} d`;
  return d.toLocaleDateString("pt-BR", {  day: "2-digit", month: "short" });
}

type EventoFeed = {
  id: string;
  em: string;
  titulo: string;
  descricao?: string | null;
  autor?: string | null;
  Icon: typeof Phone;
  cor: string;
};

const CANAL_ICON: Record<string, { Icon: typeof Phone; label: string }> = {
  ligacao: { Icon: Phone, label: "Ligação" },
  whatsapp: { Icon: MessageSquare, label: "WhatsApp" },
  email: { Icon: Mail, label: "E-mail" },
  reuniao: { Icon: Users2, label: "Reunião" },
  presencial: { Icon: MapPin, label: "Presencial" },
  followup: { Icon: Clock, label: "Follow-up" },
  outro: { Icon: MessageSquare, label: "Contato" },
};

const HIST_ICON: Record<string, { Icon: typeof Phone; cor: string }> = {
  documento: { Icon: FileText, cor: "text-sky-500" },
  etapa: { Icon: Workflow, cor: "text-primary" },
  pipeline: { Icon: Workflow, cor: "text-primary" },
  mensagem: { Icon: MessagesSquare, cor: "text-emerald-500" },
};

/**
 * Chat do cliente em layout "rede social": à esquerda o histórico de todos os
 * chats e interações; à direita a conversa refinada (reaproveita
 * ChatClienteConversa, o mesmo motor do chat do correspondente).
 */
export function ChatClienteInstagram({
  clienteId,
  info,
}: {
  clienteId: string;
  info?: ChatClienteInfo;
}) {
  const [mobileView, setMobileView] = useState<"lista" | "chat">("chat");
  const interFn = useServerFn(listarInteracoes);
  const histFn = useServerFn(listarHistorico);

  const { data: interacoes, isLoading: carregandoInter } = useQuery({
    queryKey: ["cliente-interacoes", clienteId],
    queryFn: () => interFn({ data: { cliente_id: clienteId } }),
  });
  const { data: historico, isLoading: carregandoHist } = useQuery({
    queryKey: ["cliente-historico", clienteId],
    queryFn: () => histFn({ data: { cliente_id: clienteId } }),
  });

  const feed: EventoFeed[] = useMemo(() => {
    const eventos: EventoFeed[] = [];
    for (const i of (interacoes ?? []) as any[]) {
      const meta = CANAL_ICON[i.canal] ?? CANAL_ICON.outro;
      eventos.push({
        id: `int-${i.id}`,
        em: i.ocorrido_em ?? i.created_at,
        titulo: meta.label + (i.resultado ? ` · ${i.resultado}` : ""),
        descricao: i.observacao,
        autor: i.responsavel?.nome ?? null,
        Icon: meta.Icon,
        cor: "text-primary",
      });
    }
    for (const h of (historico ?? []) as any[]) {
      const meta = HIST_ICON[h.tipo] ?? { Icon: History, cor: "text-muted-foreground" };
      eventos.push({
        id: `hist-${h.id}`,
        em: h.created_at,
        titulo: h.descricao ?? h.tipo,
        Icon: meta.Icon,
        cor: meta.cor,
      });
    }
    return eventos.sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());
  }, [interacoes, historico]);

  const carregando = carregandoInter || carregandoHist;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[clamp(280px,26%,340px)_1fr]">
      {/* Sidebar — histórico de chats e interações */}
      <aside
        className={cn(
          "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
          mobileView === "chat" ? "hidden lg:flex" : "flex",
        )}
      >
        <header className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-br from-primary/10 to-transparent px-4 py-3.5">
          <Avatar className="size-11 shrink-0 border border-border/60">
            <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
              {iniciais(info?.nome)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {info?.nome ?? "Cliente"}
            </p>
            {info?.contexto && (
              <p className="truncate text-xs text-muted-foreground">{info.contexto}</p>
            )}
          </div>
        </header>

        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Activity className="size-3.5" />
          Linha do tempo
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {carregando ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3 rounded-lg p-2">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))
            ) : feed.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <History className="size-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">
                  Ainda não há interações ou histórico com este cliente.
                </p>
              </div>
            ) : (
              feed.map((e) => (
                <div
                  key={e.id}
                  className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full bg-muted",
                      e.cor,
                    )}
                  >
                    <e.Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-snug text-foreground">{e.titulo}</p>
                    {e.descricao && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {e.descricao}
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                      <span>{tempoRelativo(e.em)}</span>
                      {e.autor && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{e.autor}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <button
          type="button"
          onClick={() => setMobileView("chat")}
          className="flex items-center justify-center gap-2 border-t border-border/60 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 lg:hidden"
        >
          <MessagesSquare className="size-4" /> Abrir conversa
        </button>
      </aside>

      {/* Conversa */}
      <div
        className={cn(
          "relative min-h-0",
          mobileView === "lista" ? "hidden lg:block" : "block",
        )}
      >
        <button
          type="button"
          onClick={() => setMobileView("lista")}
          className="absolute left-2 top-2.5 z-20 flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground lg:hidden"
        >
          <ChevronLeft className="size-3.5" /> Histórico
        </button>
        <ChatClienteConversa clienteId={clienteId} info={info} />
      </div>
    </div>
  );
}

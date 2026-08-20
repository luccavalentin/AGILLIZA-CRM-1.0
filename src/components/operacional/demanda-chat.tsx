import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Maximize2, Search } from "lucide-react";
import {
  abrirDemandaChatFlutuante,
  fecharChatFlutuante,
  useFloatingChats,
} from "@/components/shared/floating-chat-store";
import { ConversaMenuAcoesLive } from "@/components/shared/conversa-menu-acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatConversaCore } from "@/components/shared/chat-core/chat-conversa";
import { useAdaptadorDemanda } from "@/components/shared/chat-core/adapters/demanda";
import { obterDemanda } from "@/lib/operacional/demandas.functions";
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

export function DemandaChatTab({ demandaId, info }: { demandaId: string; info?: DemandaChatInfo }) {
  const janelas = useFloatingChats();
  const estaFlutuando = janelas.some((c) => c.kind === "demanda" && c.demandaId === demandaId);

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
          onClick={() => fecharChatFlutuante("demanda", demandaId)}
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
  const obterFn = useServerFn(obterDemanda);
  const sessaoFn = useServerFn(getMinhaSessao);

  // Meta usada apenas para o header (título, número, interlocutor).
  const { data: meta } = useQuery({
    queryKey: ["demanda-meta", demandaId],
    queryFn: () => obterFn({ data: { id: demandaId } }),
    staleTime: 30_000,
  });
  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => sessaoFn(),
    staleTime: 5 * 60_000,
  });
  const meuId = sessao?.profile?.id ?? null;

  const demanda = (meta as any)?.demanda;
  const titulo = demanda?.titulo ?? info?.titulo ?? "Demanda";
  const numero = demanda?.numero ?? info?.numero ?? "DEM-—";
  const statusLabel = info?.statusLabel ?? demanda?.status ?? "Demanda";
  const nomeCriador = ((meta as any)?.nome_criador as string | null | undefined) ?? null;
  const nomeResponsavel = ((meta as any)?.nome_responsavel as string | null | undefined) ?? null;
  const souCriador = Boolean(meuId && demanda?.criador_id === meuId);
  const souResponsavel = Boolean(meuId && demanda?.responsavel_id === meuId);
  const interlocutorNome =
    info?.interlocutorNome ??
    (souCriador
      ? nomeResponsavel
      : souResponsavel
        ? nomeCriador
        : (nomeResponsavel ?? nomeCriador)) ??
    "Usuário";
  const interlocutorContexto = souCriador
    ? "Responsável pela demanda"
    : souResponsavel
      ? "Solicitante da demanda"
      : "Participante da demanda";

  const chatInfo = useMemo(
    () => ({ nome: interlocutorNome, foto_url: info?.interlocutorFoto ?? null }),
    [interlocutorNome, info?.interlocutorFoto],
  );

  const renderHeader: React.ComponentProps<typeof ChatConversaCore>["adapter"]["renderHeader"] = ({
    buscaAberta,
    toggleBusca,
    buscaMsg,
    setBuscaMsg,
  }) => (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b bg-card px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm ring-2 ring-primary/15">
          {info?.interlocutorFoto ? (
            <img
              src={info.interlocutorFoto}
              alt={interlocutorNome}
              className="size-full object-cover"
            />
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
            className={cn(
              "size-9 shrink-0 rounded-lg text-muted-foreground",
              buscaAberta && "bg-accent text-foreground",
            )}
            onClick={toggleBusca}
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
    </>
  );

  const adapter = useAdaptadorDemanda({
    demandaId,
    info: chatInfo,
    renderHeader,
  });

  return <ChatConversaCore adapter={adapter} />;
}

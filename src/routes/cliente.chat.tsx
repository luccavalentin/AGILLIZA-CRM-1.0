import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  SlidersHorizontal,
  SquarePen,
  ChevronRight,
  Paperclip,
  FileText,
  UserRound,
  Clock3,
  Download,
  MessageCircle,
  ChevronDown,
  Mail,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { ChatConfigSheet } from "@/components/shared/chat-config-sheet";
import { ThreadChat, iniciais, horaCurta } from "@/components/cliente/chat-cliente";
import {
  clienteListarAtendentes,
  clienteObterVisaoGeral,
  clienteMeusDocumentos,
  type AtendenteCliente,
} from "@/lib/portal/cliente.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cliente/chat")({
  head: () => ({ meta: [{ title: "Conversar — Meu Financiamento" }] }),
  component: ChatPage,
});

type Filtro = "todas" | "nao_lidas" | "arquivadas";

function ChatPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [selId, setSelId] = useState<string | null>(null);

  const { data: atendentes, isLoading: loadingAt } = useQuery({
    queryKey: ["cliente", "atendentes"],
    queryFn: () => clienteListarAtendentes(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 12000),
  });

  const { data: visao } = useQuery({
    queryKey: ["cliente", "visao-geral"],
    queryFn: () => clienteObterVisaoGeral(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 30000),
  });

  const { data: docs } = useQuery({
    queryKey: ["cliente", "meus-documentos"],
    queryFn: () => clienteMeusDocumentos(),
  });

  const lista = useMemo(() => {
    const src = atendentes ?? [];
    const q = busca.trim().toLowerCase();
    return src.filter((a) => {
      if (filtro === "nao_lidas" && a.nao_lidas <= 0) return false;
      if (filtro === "arquivadas") return false;
      if (!q) return true;
      return (
        a.nome.toLowerCase().includes(q) || (a.ultima_mensagem ?? "").toLowerCase().includes(q)
      );
    });
  }, [atendentes, busca, filtro]);

  // Seleção padrão: primeira conversa disponível.
  useEffect(() => {
    if (!selId && lista.length > 0) setSelId(lista[0].atendente_id);
  }, [selId, lista]);

  const selecionado = useMemo(
    () => (atendentes ?? []).find((a) => a.atendente_id === selId) ?? null,
    [atendentes, selId],
  );

  // Comportamento mobile/tablet estilo WhatsApp: só mostra lista OU thread por vez.
  // ≥lg (1024px): 3 colunas simultâneas.
  const mostrarThreadMobile = selId != null;

  return (
    <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      {/* Coluna 1 — Conversas */}
      <aside
        className={cn(
          "flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_50px_-30px_color-mix(in_oklab,var(--brand-azul-profundo)_45%,transparent)] h-[calc(100dvh-10rem)] min-h-[520px] lg:flex",
          mostrarThreadMobile ? "hidden" : "flex",
        )}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-base font-semibold text-foreground">Conversas</p>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-md"
            aria-label="Nova conversa"
          >
            <SquarePen className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 px-3 pt-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conversas…"
              className="h-9 rounded-full bg-muted/40 pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            aria-label="Filtros"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          <FiltroChip ativo={filtro === "todas"} onClick={() => setFiltro("todas")}>
            Todas
          </FiltroChip>
          <FiltroChip ativo={filtro === "nao_lidas"} onClick={() => setFiltro("nao_lidas")}>
            Não lidas
          </FiltroChip>
          <FiltroChip ativo={filtro === "arquivadas"} onClick={() => setFiltro("arquivadas")}>
            Arquivadas
          </FiltroChip>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingAt ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : lista.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                Nenhuma conversa {filtro === "nao_lidas" ? "não lida" : "encontrada"}.
              </p>
            </div>
          ) : (
            <ul>
              {lista.map((a) => (
                <li key={a.atendente_id} className="group relative">
                  <ItemConversa
                    atendente={a}
                    selecionado={a.atendente_id === selId}
                    onClick={() => setSelId(a.atendente_id)}
                  />
                  <button
                    type="button"
                    aria-label={`Excluir conversa com ${a.nome}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!window.confirm("Excluir esta conversa da sua lista?")) return;
                      import("@/lib/portal/cliente.functions")
                        .then((m) =>
                          m.clienteExcluirConversa({ data: { atendente_id: a.atendente_id } }),
                        )
                        .then(() => {
                          toast.success("Conversa excluída.");
                          qc.invalidateQueries({ queryKey: ["cliente", "atendentes"] });
                          if (selId === a.atendente_id) setSelId(null);
                        })
                        .catch((err) => toast.error(err?.message ?? "Erro ao excluir."));
                    }}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-100 shadow-sm backdrop-blur transition hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="shrink-0 border-t border-border/60 p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between rounded-full bg-muted/40 hover:bg-muted"
          >
            Ver todas as conversas
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Coluna 2 — Thread */}
      <section className={cn("min-w-0", mostrarThreadMobile ? "block" : "hidden lg:block")}>
        {selecionado ? (
          <ThreadChat
            key={selecionado.atendente_id}
            atendente={selecionado}
            altura="h-[calc(100dvh-10rem)] min-h-[520px]"
            podeVoltar={true}
            onVoltar={() => setSelId(null)}
            headerExtras={<ChatConfigSheet />}
            quickActions={<AcoesRapidas />}
          />
        ) : (
          <div className="hidden h-[calc(100dvh-10rem)] min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card text-center lg:flex">
            <div className="max-w-sm space-y-2 px-6">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-foreground">Selecione uma conversa</p>
              <p className="text-xs text-muted-foreground">
                Escolha um atendente na lista para começar a conversar.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Coluna 3 — Contexto do atendimento (só desktop) */}
      <aside className="hidden min-w-0 flex-col gap-3 lg:flex lg:h-[calc(100dvh-10rem)] lg:overflow-y-auto">
        <CardResumo visao={visao ?? null} selecionado={selecionado} />
        <CardProgresso visao={visao ?? null} />
        <CardDocumentos docs={docs ?? []} />
      </aside>
    </div>
  );
}

function FiltroChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        ativo
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/40 text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ItemConversa({
  atendente: a,
  selecionado,
  onClick,
}: {
  atendente: AtendenteCliente;
  selecionado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        selecionado ? "bg-primary/5" : "hover:bg-muted/60",
      )}
    >
      {selecionado ? (
        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />
      ) : null}
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11">
          {a.foto_url ? <AvatarImage src={a.foto_url} alt={a.nome} /> : null}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {iniciais(a.nome)}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{a.nome}</p>
          {a.ultima_em ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {horaCurta(a.ultima_em)}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-xs",
              a.nao_lidas > 0 ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
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
  );
}

function AcoesRapidas() {
  const responder = useMutation({
    mutationFn: (p: { mensagem: string }) =>
      import("@/lib/portal/cliente.functions").then((m) =>
        m.clienteEnviarMensagem({ data: { atendente_id: "", mensagem: p.mensagem } }),
      ),
    onSuccess: () => toast.success("Solicitação enviada."),
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <BotaoAcao
        icon={Paperclip}
        label="Enviar documento"
        to="/cliente/acompanhar-minha-proposta"
      />
      <BotaoAcao icon={FileText} label="Ver proposta" to="/cliente/acompanhar-minha-proposta" />
      <BotaoAcao icon={UserRound} label="Falar com especialista" to="/cliente/chat" />
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-full border-border/70 bg-background text-xs font-medium"
        onClick={() =>
          responder.mutate({
            mensagem: "Olá, tudo bem? Gostaria de um retorno referente à minha proposta.",
          })
        }
      >
        <Clock3 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
        Solicitar retorno
      </Button>
    </div>
  );
}

function BotaoAcao({
  icon: Icon,
  label,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-8 rounded-full border-border/70 bg-background text-xs font-medium"
    >
      <Link to={to}>
        <Icon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Link>
    </Button>
  );
}

function CardResumo({
  visao,
  selecionado,
}: {
  visao: Awaited<ReturnType<typeof clienteObterVisaoGeral>> | null;
  selecionado: AtendenteCliente | null;
}) {
  const contato = visao?.contato ?? null;
  const responsavelNome = contato?.nome ?? selecionado?.nome ?? "Atendente";
  const responsavelFoto = contato?.foto_url ?? selecionado?.foto_url ?? null;
  const ultima = visao?.processo.ultima_atualizacao ?? null;
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Resumo do atendimento</p>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 space-y-3 text-xs">
        <div>
          <p className="text-muted-foreground">Responsável</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Avatar className="h-9 w-9">
              {responsavelFoto ? <AvatarImage src={responsavelFoto} alt={responsavelNome} /> : null}
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                {iniciais(responsavelNome)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{responsavelNome}</p>
              <p className="truncate text-[11px] text-muted-foreground">Especialista em crédito</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                aria-label="Mensagem"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground">Etapa atual</p>
          <Badge
            variant="secondary"
            className="mt-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/10"
          >
            {visao?.processo.etapa_atual ?? "Aguardando"}
          </Badge>
        </div>
        <div>
          <p className="text-muted-foreground">Última atualização</p>
          <p className="mt-0.5 font-medium text-foreground">{ultima ? horaCurta(ultima) : "—"}</p>
        </div>
      </div>
    </div>
  );
}

function CardProgresso({
  visao,
}: {
  visao: Awaited<ReturnType<typeof clienteObterVisaoGeral>> | null;
}) {
  const total = Math.max(1, visao?.processo.total ?? 5);
  const atual = Math.min(total, Math.max(0, visao?.processo.ordem_atual ?? 0));
  // Compacta em até 5 pontos para não estourar largura no sidebar.
  const pontos = Math.min(5, total);
  const posAtual = Math.round((atual / total) * pontos);
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-sm font-semibold text-foreground">Progresso do processo</p>
      <div className="mt-3 flex items-center justify-between">
        {Array.from({ length: pontos }).map((_, i) => {
          const idx = i + 1;
          const done = idx < posAtual;
          const current = idx === posAtual;
          return (
            <div key={i} className="flex flex-1 items-center">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  current &&
                    "border-primary bg-primary/10 text-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_15%,transparent)]",
                  !done && !current && "border-border bg-card text-muted-foreground",
                )}
              >
                {idx}
              </span>
              {i < pontos - 1 && (
                <span
                  className={cn(
                    "mx-1 h-0.5 flex-1 rounded-full",
                    idx < posAtual ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {atual} de {total} etapas concluídas
      </p>
    </div>
  );
}

function CardDocumentos({
  docs,
}: {
  docs: Array<{
    id: string;
    tipo_documento: string | null;
    nome_arquivo: string | null;
    status: string;
  }>;
}) {
  const compartilhados = docs
    .filter((d) => (d.status ?? "").toLowerCase() !== "pendente")
    .slice(0, 4);
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-sm font-semibold text-foreground">Documentos compartilhados</p>
      <ul className="mt-3 space-y-2.5">
        {compartilhados.length === 0 ? (
          <li className="text-xs text-muted-foreground">Nenhum documento compartilhado ainda.</li>
        ) : (
          compartilhados.map((d) => (
            <li key={d.id} className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {d.tipo_documento ?? d.nome_arquivo ?? "Documento"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {d.nome_arquivo ?? "Arquivo enviado"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                aria-label="Baixar"
              >
                <Download className="h-4 w-4" />
              </Button>
            </li>
          ))
        )}
      </ul>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="mt-3 w-full justify-between rounded-full bg-muted/40 hover:bg-muted"
      >
        <Link to="/cliente/acompanhar-minha-proposta">
          Ver todos os documentos
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

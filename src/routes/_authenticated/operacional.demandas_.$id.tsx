import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  MessageCircle,
  User,
  FileText,
  Calculator,
  Users2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterDemanda,
  comentarDemanda,
  moverStatusDemanda,
  marcarDemandaLida,
  transicaoDemandaPermitida,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import { TransferirDialog } from "@/components/operacional/transferir-dialog";
import { statusDemanda, PRIORIDADE } from "@/components/operacional/status";
import { PriorityChip, OpAvatar } from "@/components/operacional/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getMinhaSessao } from "@/lib/session.functions";
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/demandas_/$id")({
  head: () => ({ meta: [{ title: "Demanda — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

function fmtHora(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const sameDay =
    d.getFullYear() === hoje.getFullYear() &&
    d.getMonth() === hoje.getMonth() &&
    d.getDate() === hoje.getDate();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Pagina() {
  const { id } = useParams({ from: "/_authenticated/operacional/demandas_/$id" });
  const qc = useQueryClient();
  const comentarFn = useServerFn(comentarDemanda);
  const moverFn = useServerFn(moverStatusDemanda);
  const marcarLidaFn = useServerFn(marcarDemandaLida);

  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => getMinhaSessao(),
    staleTime: 5 * 60_000,
  });
  const meuId = sessao?.profile?.id ?? null;

  const { data, refetch } = useQuery({
    queryKey: ["demanda", id],
    queryFn: () => obterDemanda({ data: { id } }),
  });

  // Realtime nas mensagens
  useEffect(() => {
    const canal = supabase
      .channel(`demanda:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "demanda_mensagens", filter: `demanda_id=eq.${id}` },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "demandas", filter: `id=eq.${id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, refetch]);

  // Marca como lida ao abrir e sempre que chega mensagem nova
  const ultimaMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    const msgs = data?.mensagens ?? [];
    const ultima = msgs[msgs.length - 1]?.id ?? null;
    if (ultima !== ultimaMsgIdRef.current) {
      ultimaMsgIdRef.current = ultima;
      marcarLidaFn({ data: { demanda_id: id } }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["demandas"] });
    }
  }, [data?.mensagens, id, marcarLidaFn, qc]);

  // Som + piscar menu quando chega mensagem de outro autor
  const chatItens = useMemo(
    () =>
      (data?.mensagens ?? []).map((m: any) => ({
        id: m.id as string,
        mine: m.autor_id === meuId,
      })),
    [data?.mensagens, meuId],
  );
  useIncomingChatSound(chatItens, id);

  // Auto-scroll ao fim
  const fimRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.mensagens?.length]);

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function enviar() {
    const corpo = texto.trim();
    if (!corpo) return;
    setEnviando(true);
    try {
      await comentarFn({ data: { demanda_id: id, corpo, visivel_cliente: false } });
      setTexto("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  async function trocarStatus(novo: DemandaStatus) {
    if (!data?.demanda) return;
    if (!transicaoDemandaPermitida(data.demanda.status as DemandaStatus, novo)) {
      toast.error("Transição de status não permitida.");
      return;
    }
    try {
      await moverFn({ data: { id, status: novo } });
      refetch();
      qc.invalidateQueries({ queryKey: ["demandas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover status.");
    }
  }

  if (!data)
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
    );
  const d = data.demanda as any;
  if (!d)
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Demanda não encontrada.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link to="/operacional/demandas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>
    );

  const cfg = statusDemanda(d.status as DemandaStatus);
  const restante = d.prazo_sla ? new Date(d.prazo_sla).getTime() - Date.now() : null;
  const slaTone =
    d.status === "concluida"
      ? "text-success"
      : restante === null
        ? "text-muted-foreground"
        : restante < 0
          ? "text-destructive"
          : restante < 24 * 3600_000
            ? "text-warning"
            : "text-muted-foreground";

  return (
    <div className="grid min-h-[calc(100vh-6rem)] gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* ============ Coluna esquerda: resumo & vínculos ============ */}
      <aside className="space-y-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/operacional/demandas">
              <ArrowLeft className="mr-1 h-4 w-4" /> Demandas
            </Link>
          </Button>
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {d.numero ?? "DEM-—"}
              </span>
              <PriorityChip prioridade={d.prioridade} />
              <Badge variant="outline">{cfg.label}</Badge>
            </div>
            <h1 className="mt-2 text-lg font-bold leading-tight text-foreground">{d.titulo}</h1>
            {d.descricao && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {d.descricao}
              </p>
            )}

            <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
              <Linha icone={<User className="h-3.5 w-3.5" />} label="Responsável">
                <OpAvatar nome={data.nome_responsavel} className="size-5 text-[9px]" />
                <span>{data.nome_responsavel ?? "—"}</span>
              </Linha>
              <Linha icone={<Users2 className="h-3.5 w-3.5" />} label="Solicitante">
                <span>{data.nome_criador ?? "—"}</span>
              </Linha>
              <Linha
                icone={
                  restante !== null && restante < 0 ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : d.status === "concluida" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )
                }
                label="SLA"
              >
                <span className={cn("tabular-nums", slaTone)}>
                  {d.prazo_sla
                    ? new Date(d.prazo_sla).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Sem prazo"}
                </span>
              </Linha>
            </div>
          </div>
        </div>

        {/* Vínculos */}
        {(d.cliente_id || d.proposta_id || d.simulacao_id) && (
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vínculos
            </p>
            <div className="space-y-2 text-sm">
              {d.cliente_id && (
                <VinculoRow
                  icone={<User className="h-4 w-4 text-primary" />}
                  label={d.clientes?.nome ?? "Cliente"}
                  sub={d.clientes?.numero_cliente}
                  to={`/crm/clientes/${d.cliente_id}`}
                />
              )}
              {d.proposta_id && (
                <VinculoRow
                  icone={<FileText className="h-4 w-4 text-primary" />}
                  label="Proposta"
                  sub={null}
                  to={`/operacional/propostas/${d.proposta_id}`}
                />
              )}
              {d.simulacao_id && (
                <VinculoRow
                  icone={<Calculator className="h-4 w-4 text-primary" />}
                  label="Simulação"
                  sub={null}
                  to={`/operacional/simulacoes/${d.simulacao_id}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </p>
          <Select
            value={d.status}
            onValueChange={(v) => trocarStatus(v as DemandaStatus)}
            disabled={!data.permissoes?.pode_mover_status}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="aguardando">Aguardando</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          {data.permissoes?.pode_transferir && (
            <TransferirDialog
              demandaId={id}
              onTransferida={() => {
                refetch();
                qc.invalidateQueries({ queryKey: ["demandas"] });
              }}
            />
          )}
        </div>
      </aside>

      {/* ============ Coluna direita: chat realtime ============ */}
      <section className="flex flex-col rounded-2xl border border-border/60 bg-card shadow-sm">
        <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Conversa</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {(data.mensagens ?? []).length} mensagens
          </span>
        </header>

        <div className="brand-scroll flex-1 space-y-2 overflow-y-auto p-4">
          {(data.mensagens ?? []).length === 0 && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Sem mensagens ainda. Comece a conversa.
            </p>
          )}
          {(data.mensagens ?? []).map((m: any) => {
            const minha = m.autor_id === meuId;
            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-end gap-2",
                  minha ? "justify-end" : "justify-start",
                )}
              >
                {!minha && <OpAvatar nome={m.nome_autor} className="size-6 text-[10px]" />}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                    minha
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border/60 bg-background text-foreground",
                  )}
                >
                  {!minha && (
                    <p className="mb-0.5 text-[10.5px] font-semibold text-muted-foreground">
                      {m.nome_autor ?? "—"}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words leading-snug">{m.corpo}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px] tabular-nums",
                      minha ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {fmtHora(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={fimRef} />
        </div>

        <footer className="border-t border-border/60 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder="Escreva uma mensagem…  (Enter para enviar)"
              rows={2}
              className="resize-none"
            />
            <Button onClick={enviar} disabled={enviando || !texto.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function Linha({
  icone,
  label,
  children,
}: {
  icone: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex w-24 items-center gap-1.5 text-muted-foreground">
        {icone}
        {label}
      </span>
      <span className="flex flex-1 items-center gap-1.5 text-sm text-foreground">{children}</span>
    </div>
  );
}

function VinculoRow({
  icone,
  label,
  sub,
  to,
}: {
  icone: React.ReactNode;
  label: string;
  sub?: string | null;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-2.5 py-2 transition hover:border-primary/40 hover:bg-primary/5"
    >
      {icone}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}

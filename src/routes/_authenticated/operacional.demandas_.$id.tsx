import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  FileText,
  Calculator,
  Users2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Paperclip,
  Users,
  ChevronDown,
  Maximize2,
  MoreVertical,
  Pencil,
  UserPlus,
  Copy,
  Check,
  Repeat,
  StickyNote,
  Activity,
  Download,
  FileSearch,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterDemanda,
  moverStatusDemanda,
  transicaoDemandaPermitida,
  urlAnexoDemanda,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import {
  DemandaChatConversa,
} from "@/components/operacional/demanda-chat";
import { abrirDemandaChatFlutuante, useFloatingChat, fecharChatFlutuante } from "@/components/shared/floating-chat-store";
import { TransferirDialog } from "@/components/operacional/transferir-dialog";
import { EditarDemandaDialog } from "@/components/operacional/editar-demanda-dialog";
import { AdicionarParticipanteDialog } from "@/components/operacional/adicionar-participante-dialog";
import { statusDemanda } from "@/components/operacional/status";
import { PriorityChip, OpAvatar } from "@/components/operacional/ui";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/demandas_/$id")({
  head: () => ({ meta: [{ title: "Demanda — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

type Aba = "conversas" | "notas" | "arquivos" | "atividades";

function formatarTempoAberto(inicio?: string | null, fim?: string | null): string {
  if (!inicio) return "—";
  const ini = new Date(inicio).getTime();
  const fimTs = fim ? new Date(fim).getTime() : Date.now();
  const diff = Math.max(0, fimTs - ini);
  const dias = Math.floor(diff / (24 * 3600_000));
  const horas = Math.floor((diff % (24 * 3600_000)) / 3600_000);
  if (dias > 0) return `${dias}d ${horas}h`;
  const mins = Math.floor((diff % 3600_000) / 60_000);
  if (horas > 0) return `${horas}h ${mins}m`;
  return `${mins}m`;
}

function Pagina() {
  const { id } = useParams({ from: "/_authenticated/operacional/demandas_/$id" });
  const qc = useQueryClient();
  const moverFn = useServerFn(moverStatusDemanda);
  const [aba, setAba] = useState<Aba>("conversas");
  const [copiado, setCopiado] = useState(false);
  const flutuante = useFloatingChat();
  const estaFlutuando = flutuante?.kind === "demanda" && flutuante.demandaId === id;

  const { data, refetch } = useQuery({
    queryKey: ["demanda", id],
    queryFn: () => obterDemanda({ data: { id } }),
  });

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

  async function copiarNumero() {
    if (!data?.demanda?.numero) return;
    await navigator.clipboard.writeText(data.demanda.numero);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1200);
  }

  const d = data?.demanda as any;
  const mensagens = data?.mensagens ?? [];
  const participantes = data?.participantes ?? [];
  const anexos = data?.anexos ?? [];
  const historico = data?.historico ?? [];

  const participantesIds = useMemo(
    () => (participantes as any[]).map((p) => p.user_id),
    [participantes],
  );

  if (!data)
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
    );

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
  const slaVencido = restante !== null && restante < 0 && d.status !== "concluida";
  const slaVencidoHa = slaVencido && restante !== null ? formatarTempoAberto(new Date(Date.now() + restante).toISOString()) : null;

  const tempoAberto = formatarTempoAberto(
    d.created_at ?? d.criado_em,
    d.concluida_em,
  );

  // Tom preenchido do status para o pill principal (destaque como no reference).
  const statusPillCls: Record<string, string> = {
    aberta: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/25",
    em_andamento: "bg-primary text-primary-foreground",
    aguardando: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/30",
    concluida: "bg-success/15 text-success ring-1 ring-inset ring-success/30",
    cancelada: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  };
  const statusCls = statusPillCls[d.status as string] ?? statusPillCls.aberta;
  const interlocutorDemandaNome = data.permissoes?.sou_criador
    ? data.nome_responsavel
    : data.permissoes?.sou_responsavel
      ? data.nome_criador
      : data.nome_responsavel ?? data.nome_criador;

  return (
    <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1400px] gap-5 p-4 md:p-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* ============ Coluna esquerda: resumo & vínculos ============ */}
      <aside className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground">
          <Link to="/operacional/demandas">
            <ArrowLeft className="h-4 w-4" /> Voltar para demandas
          </Link>
        </Button>

        {/* Card informação principal */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {d.numero ?? "DEM-—"}
            </span>
            <button
              type="button"
              onClick={copiarNumero}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Copiar número"
            >
              {copiado ? <Check className="size-3" /> : <Copy className="size-3" />}
            </button>
            <PriorityChip prioridade={d.prioridade} />
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", statusCls)}>
              {cfg.label}
            </span>
          </div>
          <h1 className="mt-3 text-lg font-bold leading-tight text-foreground">{d.titulo}</h1>
          {d.descricao && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {d.descricao}
            </p>
          )}

          <div className="mt-4 space-y-2.5 border-t border-border/60 pt-4">
            <Linha icone={<User className="h-3.5 w-3.5" />} label="Responsável">
              <OpAvatar nome={data.nome_responsavel} className="size-5 text-[9px]" />
              <span className="truncate">{data.nome_responsavel ?? "—"}</span>
            </Linha>
            <Linha icone={<Users2 className="h-3.5 w-3.5" />} label="Solicitante">
              <OpAvatar nome={data.nome_criador} className="size-5 text-[9px]" />
              <span className="truncate">{data.nome_criador ?? "—"}</span>
            </Linha>
            <div className="flex items-start gap-2 text-xs">
              <span className="flex w-24 shrink-0 items-center gap-1.5 pt-0.5 text-muted-foreground">
                {slaVencido ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                ) : d.status === "concluida" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
                SLA
              </span>
              <div className="flex-1">
                <p className={cn("text-sm font-semibold tabular-nums", slaTone)}>
                  {slaVencido
                    ? `Vencido há ${slaVencidoHa}`
                    : d.prazo_sla
                      ? new Date(d.prazo_sla).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Sem prazo"}
                </p>
                {d.prazo_sla && (
                  <p className="text-[11px] text-muted-foreground">
                    Prazo era {new Date(d.prazo_sla).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>


        {/* Vínculos */}
        {(d.cliente_id || d.proposta_id || d.simulacao_id) && (
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Vínculos
            </p>
            <div className="space-y-2">
              {d.cliente_id && (
                <VinculoRow
                  icone={<User className="h-4 w-4 text-primary" />}
                  label="Cliente"
                  nome={d.clientes?.nome ?? "Cliente"}
                  sub={d.clientes?.numero_cliente}
                  to={`/crm/clientes/${d.cliente_id}`}
                />
              )}
              {d.proposta_id && (
                <VinculoRow
                  icone={<FileText className="h-4 w-4 text-primary" />}
                  label="Proposta"
                  nome={d.propostas?.numero_proposta ? `#${d.propostas.numero_proposta}` : "Proposta"}
                  sub={d.propostas?.created_at ? `Criada em ${new Date(d.propostas.created_at).toLocaleDateString("pt-BR")}` : null}
                  to={`/operacional/propostas/${d.proposta_id}`}
                />
              )}
              {d.simulacao_id && (
                <VinculoRow
                  icone={<Calculator className="h-4 w-4 text-primary" />}
                  label="Simulação"
                  nome={d.simulacoes?.numero_simulacao ? `#${d.simulacoes.numero_simulacao}` : "Simulação"}
                  sub={d.simulacoes?.updated_at ? `Atualizada em ${new Date(d.simulacoes.updated_at).toLocaleDateString("pt-BR")}` : null}
                  to={`/operacional/simulacoes/${d.simulacao_id}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="space-y-3">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ações
          </p>
          <div className="space-y-1.5">
            <label className="px-1 text-[11px] text-muted-foreground">Status da demanda</label>
            <Select
              value={d.status}
              onValueChange={(v) => trocarStatus(v as DemandaStatus)}
              disabled={!data.permissoes?.pode_mover_status}
            >
              <SelectTrigger className="w-full">
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
          </div>

          <div className="space-y-2">
            {data.permissoes?.pode_editar && (
              <EditarDemandaDialog
                demanda={{
                  id: d.id,
                  titulo: d.titulo,
                  descricao: d.descricao ?? null,
                  prioridade: d.prioridade,
                  sla_horas: d.sla_horas ?? null,
                }}
                onSalva={() => {
                  refetch();
                  qc.invalidateQueries({ queryKey: ["demandas"] });
                }}
                trigger={
                  <Button className="w-full justify-center gap-2">
                    <Pencil className="h-4 w-4" /> Editar demanda
                  </Button>
                }
              />
            )}
            {data.permissoes?.pode_transferir && (
              <TransferirDialog
                demandaId={id}
                onTransferida={() => {
                  refetch();
                  qc.invalidateQueries({ queryKey: ["demandas"] });
                }}
                trigger={
                  <Button variant="outline" className="w-full justify-center gap-2">
                    <Repeat className="h-4 w-4" /> Transferir responsável
                  </Button>
                }
              />
            )}
            {data.permissoes?.pode_editar && (
              <AdicionarParticipanteDialog
                demandaId={id}
                jaParticipantes={participantesIds}
                onAdicionado={() => {
                  refetch();
                  qc.invalidateQueries({ queryKey: ["demandas"] });
                }}
                trigger={
                  <Button variant="outline" className="w-full justify-center gap-2">
                    <UserPlus className="h-4 w-4" /> Adicionar participante
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </aside>

      {/* ============ Coluna direita ============ */}
      <section className="flex min-h-0 min-w-0 flex-col gap-4">
        {/* Barra de KPIs */}
        <div className="flex flex-wrap items-center gap-3">
          <StatPill icone={<Clock className="h-4 w-4 text-primary" />} valor={tempoAberto} label="Tempo em aberto" />
          <StatPill icone={<MessageCircle className="h-4 w-4 text-primary" />} valor={String(mensagens.length)} label="Mensagens" />
          <StatPill icone={<Paperclip className="h-4 w-4 text-primary" />} valor={String(anexos.length)} label="Anexos" />
          <StatPill icone={<Users className="h-4 w-4 text-primary" />} valor={String(participantes.length)} label="Participantes" />

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Mais ações <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => window.print()}>
                  <Download className="mr-2 h-4 w-4" /> Exportar / imprimir
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAba("atividades")}>
                  <Activity className="mr-2 h-4 w-4" /> Ver histórico
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => document.documentElement.requestFullscreen?.()}
              title="Expandir"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Card com abas + conteúdo */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {/* Header com tabs */}
          <div className="flex items-center justify-between border-b border-border/60 px-4">
            <div className="flex">
              <TabBtn active={aba === "conversas"} onClick={() => setAba("conversas")}>Conversas</TabBtn>
              <TabBtn active={aba === "notas"} onClick={() => setAba("notas")}>Notas internas</TabBtn>
              <TabBtn active={aba === "arquivos"} onClick={() => setAba("arquivos")}>
                Arquivos {anexos.length > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({anexos.length})</span>}
              </TabBtn>
              <TabBtn active={aba === "atividades"} onClick={() => setAba("atividades")}>Atividades</TabBtn>
            </div>
            <div className="flex items-center gap-1.5 py-2">
              {aba === "conversas" && !estaFlutuando && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() =>
                    abrirDemandaChatFlutuante(id, {
                      numero: d.numero,
                      titulo: d.titulo,
                      statusLabel: cfg.label,
                      interlocutorNome: interlocutorDemandaNome,
                    })
                  }
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Soltar chat
                </Button>
              )}
              {aba === "conversas" && estaFlutuando && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => fecharChatFlutuante()}
                >
                  Reacoplar chat
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => refetch()}>Atualizar conversa</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex min-h-0 flex-1 flex-col">
            {aba === "conversas" && (
              estaFlutuando ? (
                <ChatFlutuandoAviso />
              ) : (
                <DemandaChatConversa
                  demandaId={id}
                  info={{
                    numero: d.numero,
                    titulo: d.titulo,
                    statusLabel: cfg.label,
                    interlocutorNome: interlocutorDemandaNome,
                  }}
                />
              )
            )}
            {aba === "notas" && <NotasInternas />}
            {aba === "arquivos" && <ArquivosTab demandaId={id} anexos={anexos} />}
            {aba === "atividades" && <AtividadesTab historico={historico} />}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------ subcomponentes ------------------------ */

function Linha({
  icone,
  label,
  children,
}: {
  icone: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
        {icone}
        {label}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-foreground">
        {children}
      </span>
    </div>
  );
}

function VinculoRow({
  icone,
  label,
  nome,
  sub,
  to,
}: {
  icone: ReactNode;
  label: string;
  nome: string;
  sub?: string | null;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="block truncate text-sm font-semibold text-foreground">{nome}</span>
        {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function StatPill({
  icone,
  valor,
  label,
}: {
  icone: ReactNode;
  valor: string;
  label: string;
}) {
  return (
    <div className="flex min-w-[9rem] flex-1 items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5 shadow-sm sm:flex-none">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10">
        {icone}
      </span>
      <div className="min-w-0">
        <p className="text-base font-bold leading-tight tabular-nums text-foreground">{valor}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative border-b-2 px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ChatFlutuandoAviso() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Maximize2 className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Conversa aberta em janela flutuante</p>
        <p className="text-xs text-muted-foreground">
          Continua disponível enquanto você navega pelo sistema.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => fecharChatFlutuante()}>
        Reacoplar janela
      </Button>
    </div>
  );
}

function NotasInternas() {
  return (
    <div className="flex flex-1 items-center justify-center p-10 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted/50 text-muted-foreground">
          <StickyNote className="size-5" />
        </div>
        <p className="text-sm font-medium text-foreground">Notas internas</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Espaço reservado para comentários privados da equipe — não visíveis ao cliente.
        </p>
      </div>
    </div>
  );
}

function ArquivosTab({ demandaId: _demandaId, anexos }: { demandaId: string; anexos: any[] }) {
  const urlFn = useServerFn(urlAnexoDemanda);
  async function abrir(anexoId: string) {
    try {
      const url = await urlFn({ data: { id: anexoId } });
      if (typeof url === "string") window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o arquivo.");
    }
  }
  if (!anexos.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted/50 text-muted-foreground">
            <Paperclip className="size-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhum arquivo anexado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Compartilhe arquivos direto no chat da demanda usando o ícone de anexo.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-4">
      {anexos.map((a: any) => (
        <button
          key={a.id}
          type="button"
          onClick={() => abrir(a.id)}
          className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileSearch className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{a.nome_arquivo ?? "Arquivo"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {a.nome_autor ? `Enviado por ${a.nome_autor} · ` : ""}
              {a.created_at ? new Date(a.created_at).toLocaleString("pt-BR") : ""}
            </p>
          </div>
          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function AtividadesTab({ historico }: { historico: any[] }) {
  if (!historico.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted/50 text-muted-foreground">
            <Activity className="size-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Sem atividades registradas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ações como criação, edição, transferência e mudanças de status aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {historico.map((h: any) => (
        <div key={h.id} className="flex gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1 pb-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">{h.nome_ator ?? "Sistema"}</span>{" "}
              <span className="text-muted-foreground">— {h.acao}</span>
            </p>
            {h.detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{h.detalhe}</p>}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {h.created_at ? new Date(h.created_at).toLocaleString("pt-BR") : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

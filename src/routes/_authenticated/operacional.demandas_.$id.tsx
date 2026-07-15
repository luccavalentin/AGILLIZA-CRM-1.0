import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Paperclip,
  Download,
  Trash2,
  Send,
  MessageCircle,
  History,
  FileText,
  Layers,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  StickyNote,
  Cog,
  FileArchive,
  AlertTriangle,
  UserCog,
  CalendarClock,
  ListChecks,
  ArrowUpRight,
  Sparkles,
  MoreHorizontal,
  Check,
} from "lucide-react";
import { getMinhaSessao } from "@/lib/session.functions";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterDemanda,
  comentarDemanda,
  moverStatusDemanda,
  marcarDemandaLida,
  registrarAnexoDemanda,
  removerAnexoDemanda,
  urlAnexoDemanda,
  excluirDemanda,
  editarDemanda,
  listarDemandas,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import { TransferirDialog } from "@/components/operacional/transferir-dialog";
import { EditarDemandaDialog } from "@/components/operacional/editar-demanda-dialog";
import { NovaTarefaDialog } from "@/components/operacional/nova-tarefa-dialog";
import { SlaCountdown } from "@/components/operacional/sla-countdown";
import { ToneBadge } from "@/components/crm/tone-badge";
import { PRIORIDADE, statusDemanda } from "@/components/operacional/status";
import { Button } from "@/components/ui/button";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/demandas_/$id")({
  head: () => ({ meta: [{ title: "Demanda — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

const STATUS_OPCOES: DemandaStatus[] = [
  "aberta",
  "em_andamento",
  "aguardando",
  "concluida",
  "cancelada",
];

// Ordem visual do stepper
const STEPPER: { key: DemandaStatus | "criada" | "aceita"; label: string }[] = [
  { key: "criada", label: "Criada" },
  { key: "aberta", label: "Aceita" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "aguardando", label: "Aguardando retorno" },
  { key: "concluida", label: "Concluída" },
];

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDataCurta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDia(iso: string): string {
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

function iniciaisChat(nome?: string | null): string {
  if (!nome) return "?";
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function tempoAberto(sla_inicio: string, concluida_em: string | null): string {
  const fim = concluida_em ? new Date(concluida_em).getTime() : Date.now();
  const ini = new Date(sla_inicio).getTime();
  const diffMs = Math.max(0, fim - ini);
  const dias = Math.floor(diffMs / 86_400_000);
  const horas = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (dias > 0) return `${dias}d ${horas}h`;
  const min = Math.floor((diffMs % 3_600_000) / 60_000);
  if (horas > 0) return `${horas}h ${min}m`;
  return `${min}m`;
}

type AbaChat = "tudo" | "mensagens" | "notas" | "sistema" | "arquivos";

function Pagina() {
  const { id } = useParams({ from: "/_authenticated/operacional/demandas_/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [corpo, setCorpo] = useState("");
  const [modoNotaInterna, setModoNotaInterna] = useState(true); // padrão interno
  const [aba, setAba] = useState<AbaChat>("tudo");
  const comentarFn = useServerFn(comentarDemanda);
  const moverFn = useServerFn(moverStatusDemanda);
  const lidaFn = useServerFn(marcarDemandaLida);
  const registrarAnexoFn = useServerFn(registrarAnexoDemanda);
  const removerAnexoFn = useServerFn(removerAnexoDemanda);
  const urlAnexoFn = useServerFn(urlAnexoDemanda);
  const excluirFn = useServerFn(excluirDemanda);
  const editarFn = useServerFn(editarDemanda);
  const [excluindo, setExcluindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviandoMsg, setEnviandoMsg] = useState(false);
  const [arquivoChat, setArquivoChat] = useState<File | null>(null);
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["demanda", id],
    queryFn: () => obterDemanda({ data: { id } }),
  });

  const [escopoPilha, setEscopoPilha] = useState<"minhas" | "equipe">("equipe");
  const { data: pilha } = useQuery({
    queryKey: ["demandas", "pilha", escopoPilha],
    queryFn: () => listarDemandas({ data: { escopo: escopoPilha } }),
  });

  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => getMinhaSessao(),
  });
  const meuId = sessao?.profile?.id ?? null;

  useIncomingChatSound(
    (data?.mensagens ?? []).map((m: any) => ({ id: m.id, mine: m.autor_id === meuId })),
    id,
  );

  useEffect(() => {
    lidaFn({ data: { demanda_id: id } }).catch(() => {});
  }, [id, lidaFn]);

  useEffect(() => {
    const canal = supabase
      .channel(`demanda:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "demanda_mensagens", filter: `demanda_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["demanda", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, qc]);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["demanda", id] });
    qc.invalidateQueries({ queryKey: ["demandas"] });
  }

  async function enviarMensagem() {
    const texto = corpo.trim();
    if (!texto && !arquivoChat) return;
    setEnviandoMsg(true);
    try {
      let anexo_path: string | undefined;
      let anexo_nome: string | undefined;
      let anexo_tamanho: number | undefined;
      if (arquivoChat) {
        const path = `${id}/chat/${Date.now()}-${arquivoChat.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("demanda-anexos").upload(path, arquivoChat);
        if (error) throw error;
        anexo_path = path;
        anexo_nome = arquivoChat.name;
        anexo_tamanho = arquivoChat.size;
      }
      await comentarFn({
        data: {
          demanda_id: id,
          corpo: texto,
          visivel_cliente: !modoNotaInterna,
          anexo_path,
          anexo_nome,
          anexo_tamanho,
        },
      });
      setCorpo("");
      setArquivoChat(null);
      invalidar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar mensagem.");
    } finally {
      setEnviandoMsg(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    try {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("demanda-anexos").upload(path, file);
      if (error) throw error;
      await registrarAnexoFn({
        data: { demanda_id: id, nome: file.name, storage_path: path, tamanho: file.size },
      });
      invalidar();
      toast.success("Anexo enviado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function baixarAnexo(storage_path: string, nome: string) {
    try {
      const { url } = await urlAnexoFn({ data: { storage_path } });
      setVisualizando({ url, nome });
    } catch {
      toast.error("Falha ao gerar link do anexo.");
    }
  }

  async function excluir() {
    setExcluindo(true);
    try {
      await excluirFn({ data: { id } });
      toast.success("Demanda excluída.");
      qc.invalidateQueries({ queryKey: ["demandas"] });
      navigate({ to: "/operacional/demandas" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  const mensagensFiltradas = useMemo(() => {
    const lista = data?.mensagens ?? [];
    if (aba === "mensagens") return lista.filter((m: any) => m.visivel_cliente);
    if (aba === "notas") return lista.filter((m: any) => !m.visivel_cliente);
    if (aba === "arquivos") return lista.filter((m: any) => !!m.anexo_path);
    return lista;
  }, [data?.mensagens, aba]);

  const d = data?.demanda;
  if (!d) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  const perm = data?.permissoes;
  const totalMensagens = (data?.mensagens ?? []).length;
  const totalAnexos = (data?.anexos ?? []).length;
  const ultimaMsg = (data?.mensagens ?? []).at(-1);
  const historico = data?.historico ?? [];
  const ultimaAtividade =
    ultimaMsg?.created_at ?? historico[0]?.created_at ?? d.updated_at ?? d.sla_inicio;

  // Determinar o índice atual do stepper com base no status
  const stepperIdxMap: Record<string, number> = {
    aberta: 1,
    em_andamento: 2,
    aguardando: 3,
    concluida: 4,
    cancelada: 4,
  };
  const stepAtual = stepperIdxMap[d.status] ?? 0;
  const slaCritico =
    !!d.prazo_sla && d.status !== "concluida" && new Date(d.prazo_sla).getTime() < Date.now();
  const proximaAcao =
    d.status === "aberta"
      ? "Iniciar atendimento"
      : d.status === "em_andamento"
        ? "Aguardando retorno do responsável"
        : d.status === "aguardando"
          ? "Aguardando retorno do cliente"
          : d.status === "concluida"
            ? "Demanda concluída"
            : "Cancelada";

  const abas: { key: AbaChat; label: string; icon: React.ComponentType<{ className?: string }> }[] =
    [
      { key: "tudo", label: "Tudo", icon: Layers },
      { key: "mensagens", label: "Mensagens", icon: MessageSquare },
      { key: "notas", label: "Notas internas", icon: StickyNote },
      { key: "sistema", label: "Sistema", icon: Cog },
      { key: "arquivos", label: "Arquivos", icon: FileArchive },
    ];

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-6">
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        {/* Coluna esquerda — pilha de demandas */}
        <aside className="flex flex-col rounded-2xl border border-border/70 bg-card shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Layers className="h-4 w-4 text-muted-foreground" /> Demandas
            </h2>
            <div className="flex rounded-lg border border-border/60 p-0.5">
              {(["equipe", "minhas"] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setEscopoPilha(op)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                    escopoPilha === op
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {op === "equipe" ? "Geral" : "Minhas"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
            {(pilha ?? []).length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                Nenhuma demanda.
              </p>
            ) : (
              (pilha ?? []).map((item) => {
                const ativo = item.id === id;
                return (
                  <Link
                    key={item.id}
                    to="/operacional/demandas/$id"
                    params={{ id: item.id }}
                    className={cn(
                      "block rounded-xl border px-3 py-2.5 transition-colors",
                      ativo
                        ? "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/20"
                        : "border-border/60 bg-background hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block h-1.5 w-4 shrink-0 rounded-full",
                          PRIORIDADE[item.prioridade as "p1"].bar,
                        )}
                      />
                      <span className="truncate font-mono text-[10px] text-muted-foreground">
                        {item.numero}
                      </span>
                      <ToneBadge tone={statusDemanda(item.status).tone}>
                        {statusDemanda(item.status).label}
                      </ToneBadge>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {item.titulo}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.nome_responsavel ?? "Sem responsável"}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        {/* Coluna central */}
        <div className="min-w-0 space-y-4">
          {/* Barra superior */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/operacional/demandas">
                <ArrowLeft className="mr-1 h-4 w-4" /> Demanda
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {perm?.pode_mover_status && d.status !== "concluida" && (
                <Button
                  size="sm"
                  onClick={async () => {
                    await moverFn({ data: { id, status: "concluida" } });
                    invalidar();
                    toast.success("Demanda concluída.");
                  }}
                >
                  <Check className="mr-1 h-4 w-4" /> Concluir demanda
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Mais ações
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {STATUS_OPCOES.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      disabled={!perm?.pode_mover_status || s === d.status}
                      onClick={async () => {
                        await moverFn({ data: { id, status: s } });
                        invalidar();
                        toast.success("Status atualizado.");
                      }}
                    >
                      Mover para: {statusDemanda(s).label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {perm?.pode_excluir && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir demanda
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir demanda?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A demanda {d.numero} e seu histórico
                            serão removidos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={excluir}
                            disabled={excluindo}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {excluindo ? "Excluindo…" : "Excluir"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Cabeçalho da demanda — compacto e refinado */}
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5">
              {/* Meta linha superior */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground ring-1 ring-border/60">
                  {d.numero}
                </span>
                <ToneBadge tone={statusDemanda(d.status).tone}>
                  {statusDemanda(d.status).label}
                </ToneBadge>
                <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60">
                  <span
                    className={cn(
                      "inline-block h-1 w-3 rounded-full",
                      PRIORIDADE[d.prioridade as "p1"].bar,
                    )}
                  />
                  {PRIORIDADE[d.prioridade as "p1"].label}
                </span>
                {slaCritico && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive ring-1 ring-destructive/30">
                    <AlertTriangle className="h-3 w-3" />
                    SLA estourado
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <h1 className="break-words text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">
                  {d.titulo}
                </h1>
                {d.descricao && (
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted-foreground">
                    {d.descricao}
                  </p>
                )}
              </div>

              {/* Próxima ação — linha fina */}
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2",
                  slaCritico
                    ? "border-destructive/30 bg-destructive/[0.04]"
                    : "border-border/60 bg-muted/30",
                )}
              >
                <ArrowUpRight
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    slaCritico ? "text-destructive" : "text-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Próxima ação
                  </p>
                  <p className="break-words text-[13px] font-medium leading-snug text-foreground">
                    {proximaAcao}
                    {data?.nome_responsavel ? (
                      <span className="font-normal text-muted-foreground">
                        {" · "}
                        {data.nome_responsavel}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    SLA
                  </p>
                  <p
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      slaCritico ? "text-destructive" : "text-foreground",
                    )}
                  >
                    <SlaCountdown
                      inicio={d.sla_inicio}
                      prazo={d.prazo_sla}
                      concluida={d.status === "concluida"}
                      concluidaEm={d.concluida_em}
                    />
                  </p>
                </div>
              </div>
            </div>

            {/* Stepper compacto */}
            <div className="border-b border-border/60">
              <div className="overflow-x-auto px-4 py-3.5 sm:px-5">
                <div className="flex min-w-[520px] items-start">
                  {STEPPER.map((step, i) => {
                    const done = i < stepAtual;
                    const active = i === stepAtual;
                    return (
                      <div key={step.key} className="flex flex-1 items-start last:flex-none">
                        <div className="flex min-w-0 flex-col items-center gap-1">
                          <div
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full ring-2 transition-colors",
                              done && "bg-primary text-primary-foreground ring-primary",
                              active && "bg-background text-primary ring-primary",
                              !done && !active &&
                                "bg-background text-muted-foreground/60 ring-border",
                            )}
                          >
                            {done ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : active ? (
                              <div className="size-2 rounded-full bg-primary" />
                            ) : (
                              <Circle className="h-2.5 w-2.5" />
                            )}
                          </div>
                          <span
                            className={cn(
                              "whitespace-nowrap text-[10px] font-medium",
                              active
                                ? "text-primary"
                                : done
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                            )}
                          >
                            {step.label}
                          </span>
                        </div>
                        {i < STEPPER.length - 1 && (
                          <div
                            className={cn(
                              "mx-1.5 mt-3 h-px flex-1",
                              i < stepAtual ? "bg-primary" : "bg-border",
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Métricas inline — chips que quebram naturalmente, sem grid rígido */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/60 bg-muted/20 px-4 py-2.5 sm:px-5">
              <InlineMetric
                dot={slaCritico ? "bg-destructive" : "bg-emerald-500"}
                rotulo="Tempo em aberto"
                valor={tempoAberto(d.sla_inicio, d.concluida_em)}
              />
              <InlineMetric
                icon={MessageSquare}
                rotulo="Interações"
                valor={String(totalMensagens)}
              />
              <InlineMetric icon={Paperclip} rotulo="Anexos" valor={String(totalAnexos)} />
              <InlineMetric
                icon={Sparkles}
                rotulo="Última atividade"
                valor={ultimaAtividade ? fmtDataCurta(ultimaAtividade) : "—"}
              />
            </div>

            {d.dados_simulacao && (
              <div className="p-4 sm:px-5 sm:py-4">
                <div className="rounded-lg border border-primary/25 bg-primary/[0.03] p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                    <FileText className="h-3 w-3" /> Dados da simulação
                  </p>
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
                    {d.dados_simulacao}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Conversas e atividades */}
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Conversas e atividades</h2>
              <span className="text-xs text-muted-foreground">
                {totalMensagens} interações
              </span>
            </div>

            {/* Abas */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 px-3 py-2">
              {abas.map((t) => {
                const Icon = t.icon;
                const ativo = aba === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setAba(t.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      ativo
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Lista */}
            <div className="chat-surface max-h-[28rem] space-y-1 overflow-y-auto p-4">
              {aba === "sistema" ? (
                historico.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Sem eventos do sistema.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {historico.map((h: any) => (
                      <li
                        key={h.id}
                        className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3"
                      >
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Cog className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium text-foreground">
                              {h.nome_ator ?? "Sistema"}
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {fmtData(h.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {h.acao}
                          </p>
                          {h.detalhe && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{h.detalhe}</p>
                          )}
                          {h.motivo && (
                            <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-foreground">
                              {h.motivo}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )
              ) : mensagensFiltradas.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageCircle className="size-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Nenhuma mensagem aqui</p>
                  <p className="text-xs text-muted-foreground">
                    Envie a primeira mensagem desta demanda.
                  </p>
                </div>
              ) : (
                mensagensFiltradas.map((m: any, i: number) => {
                  const meu = meuId != null && m.autor_id === meuId;
                  const anterior = mensagensFiltradas[i - 1];
                  const proxima = mensagensFiltradas[i + 1];
                  const mostrarDia =
                    !anterior || fmtDia(anterior.created_at) !== fmtDia(m.created_at);
                  const mesmoAutorAntes = !mostrarDia && anterior?.autor_id === m.autor_id;
                  const mesmoAutorDepois =
                    proxima?.autor_id === m.autor_id &&
                    fmtDia(proxima?.created_at ?? "") === fmtDia(m.created_at);
                  return (
                    <div key={m.id}>
                      {mostrarDia && (
                        <div className="my-3 flex items-center justify-center">
                          <span className="rounded-full bg-background/80 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground shadow-sm ring-1 ring-border/50 backdrop-blur">
                            {fmtDia(m.created_at)}
                          </span>
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex items-end gap-2",
                          meu ? "justify-end" : "justify-start",
                          mesmoAutorAntes ? "mt-0.5" : "mt-2",
                        )}
                      >
                        {!meu &&
                          (mesmoAutorDepois ? (
                            <span className="size-7 shrink-0" />
                          ) : (
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/50 text-[10px] font-semibold text-primary-foreground shadow-sm">
                              {iniciaisChat(m.nome_autor)}
                            </span>
                          ))}
                        <div
                          className={cn(
                            "chat-bubble max-w-[80%] px-3.5 py-2 text-sm",
                            meu
                              ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-2xl rounded-bl-md border border-chat-them-border bg-chat-them text-chat-them-foreground",
                            mesmoAutorAntes && (meu ? "rounded-tr-md" : "rounded-tl-md"),
                          )}
                        >
                          {!mesmoAutorAntes && (
                            <div className="mb-0.5 flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[11px] font-semibold",
                                  meu ? "text-primary-foreground/90" : "text-primary",
                                )}
                              >
                                {meu ? "Você" : (m.nome_autor ?? "—")}
                              </span>
                              <ToneBadge tone={m.visivel_cliente ? "info" : "muted"}>
                                {m.visivel_cliente ? "Cliente" : "Interno"}
                              </ToneBadge>
                            </div>
                          )}
                          {m.corpo && (
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {m.corpo}
                            </p>
                          )}
                          {m.anexo_path && (
                            <button
                              type="button"
                              onClick={() => baixarAnexo(m.anexo_path, m.anexo_nome ?? "arquivo")}
                              className={cn(
                                "mt-1.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                                meu
                                  ? "bg-primary-foreground/15 hover:bg-primary-foreground/25"
                                  : "bg-muted hover:bg-muted/70",
                              )}
                            >
                              <Paperclip className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {m.anexo_nome ?? "arquivo"}
                              </span>
                              <Download className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          )}
                          <p
                            className={cn(
                              "mt-1 text-right text-[10px]",
                              meu ? "text-primary-foreground/70" : "text-muted-foreground",
                            )}
                          >
                            {fmtHora(m.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modo de mensagem */}
            <div className="flex items-center gap-1 border-t border-border/60 px-3 pt-2">
              <button
                type="button"
                onClick={() => setModoNotaInterna(false)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  !modoNotaInterna
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Mensagem
              </button>
              <button
                type="button"
                onClick={() => setModoNotaInterna(true)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  modoNotaInterna
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Nota interna
              </button>
            </div>

            {/* Input */}
            <div className="space-y-2.5 px-3 pb-3.5 pt-2">
              {arquivoChat && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {arquivoChat.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setArquivoChat(null)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-background p-1.5 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
                <input
                  ref={chatFileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setArquivoChat(f);
                    if (chatFileRef.current) chatFileRef.current.value = "";
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  onClick={() => chatFileRef.current?.click()}
                  title="Anexar arquivo"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  value={corpo}
                  onChange={(e) => setCorpo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviarMensagem();
                    }
                  }}
                  placeholder={
                    modoNotaInterna
                      ? "Escreva uma nota interna…"
                      : "Escreva uma mensagem para o cliente…"
                  }
                  className="min-h-[40px] max-h-32 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl shadow-sm"
                  disabled={(!corpo.trim() && !arquivoChat) || enviandoMsg}
                  onClick={enviarMensagem}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita — Resumo */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {/* Informações gerais */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Informações gerais</h2>
            </div>
            <dl className="divide-y divide-border/60 px-4 py-2 text-sm">
              <InfoLinha
                rotulo="Status"
                valor={
                  <ToneBadge tone={statusDemanda(d.status).tone}>
                    {statusDemanda(d.status).label}
                  </ToneBadge>
                }
              />
              <InfoLinha
                rotulo="Prioridade"
                valor={
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-4 rounded-full",
                        PRIORIDADE[d.prioridade as "p1"].bar,
                      )}
                    />
                    <span className="text-foreground">
                      {PRIORIDADE[d.prioridade as "p1"].label}
                    </span>
                  </span>
                }
              />
              <InfoLinha
                rotulo="Tipo"
                valor={
                  d.tipo === "simulacao"
                    ? "Simulação"
                    : d.tipo === "diversos"
                      ? "Diversos"
                      : d.tipo
                }
              />
              <InfoLinha
                rotulo="Responsável atual"
                valor={data?.nome_responsavel ?? "—"}
              />
              <InfoLinha rotulo="Solicitante" valor={d.clientes?.nome ?? "—"} />
              <InfoLinha rotulo="Criada em" valor={fmtData(d.created_at)} />
              <InfoLinha
                rotulo="Última atualização"
                valor={fmtData(ultimaAtividade)}
              />
            </dl>
          </div>

          {/* Próxima ação */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Próxima ação</h2>
            </div>
            <div className="space-y-1 px-4 py-3 text-sm">
              <p className="text-foreground">{proximaAcao}</p>
              <p className="text-xs text-muted-foreground">
                Prazo:{" "}
                <span
                  className={cn(
                    "font-medium",
                    slaCritico ? "text-destructive" : "text-foreground",
                  )}
                >
                  {slaCritico ? "vencido há " : ""}
                  <SlaCountdown
                    inicio={d.sla_inicio}
                    prazo={d.prazo_sla}
                    concluida={d.status === "concluida"}
                    concluidaEm={d.concluida_em}
                  />
                </span>
              </p>
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Ações rápidas</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {perm?.pode_transferir ? (
                <div className="[&_button]:!w-full [&_button]:!justify-start [&_button]:!h-auto [&_button]:!rounded-xl [&_button]:!border [&_button]:!border-border/60 [&_button]:!bg-background [&_button]:!p-3 [&_button]:!text-left [&_button]:hover:!border-primary/40 [&_button]:hover:!bg-primary/[0.04]">
                  <TransferirDialog demandaId={id} onTransferida={invalidar} />
                </div>
              ) : null}
              {perm?.pode_editar && (
                <div className="[&_button]:!w-full [&_button]:!justify-start [&_button]:!h-auto [&_button]:!rounded-xl [&_button]:!border [&_button]:!border-border/60 [&_button]:!bg-background [&_button]:!p-3 [&_button]:!text-left [&_button]:hover:!border-primary/40 [&_button]:hover:!bg-primary/[0.04]">
                  <EditarDemandaDialog
                    demanda={{
                      id: d.id,
                      titulo: d.titulo,
                      descricao: d.descricao ?? null,
                      prioridade: d.prioridade,
                      sla_horas: d.sla_horas ?? null,
                    }}
                    onSalva={invalidar}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate({ to: "/operacional/tarefas" })}
                className="flex flex-col items-start gap-1 rounded-xl border border-border/60 bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
              >
                <ListChecks className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-foreground">Criar tarefa</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!perm?.pode_mover_status) return;
                  await moverFn({ data: { id, status: "aguardando" } });
                  invalidar();
                  toast.success("Demanda escalonada.");
                }}
                className="flex flex-col items-start gap-1 rounded-xl border border-border/60 bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
              >
                <ArrowUpRight className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-foreground">Escalonar</span>
              </button>
            </div>
          </div>

          {/* Insight operacional */}
          <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Insight operacional
            </p>
            <ul className="space-y-1.5 text-xs text-foreground">
              <li className="flex gap-1.5">
                <span className="mt-1 inline-block size-1 shrink-0 rounded-full bg-primary" />
                <span>
                  {slaCritico
                    ? "A demanda está sem resposta e o SLA já venceu."
                    : d.status === "concluida"
                      ? "Demanda concluída dentro do prazo."
                      : "A demanda está dentro do SLA — continue o atendimento."}
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="mt-1 inline-block size-1 shrink-0 rounded-full bg-primary" />
                <span>
                  Última interação realizada por{" "}
                  <span className="font-medium">
                    {ultimaMsg?.nome_autor ?? historico[0]?.nome_ator ?? "—"}
                  </span>
                  .
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="mt-1 inline-block size-1 shrink-0 rounded-full bg-primary" />
                <span>
                  Próxima ação recomendada:{" "}
                  <span className="font-medium">{proximaAcao}</span>.
                </span>
              </li>
            </ul>
          </div>

          {/* Anexos */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Paperclip className="h-4 w-4 text-muted-foreground" /> Anexos
                {totalAnexos > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {totalAnexos}
                  </span>
                )}
              </h2>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
              <Button
                variant="outline"
                size="sm"
                disabled={enviando}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="mr-1 h-3.5 w-3.5" /> {enviando ? "Enviando…" : "Anexar"}
              </Button>
            </div>
            <div className="space-y-2 p-3">
              {totalAnexos === 0 ? (
                <p className="px-1 py-4 text-center text-sm text-muted-foreground">
                  Nenhum anexo.
                </p>
              ) : (
                (data?.anexos ?? []).map((a: any) => (
                  <div
                    key={a.id}
                    className="group flex items-center gap-2.5 rounded-xl border border-border/60 bg-background p-2.5 text-sm transition-colors hover:border-primary/40"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{a.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.nome_autor ?? "—"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => baixarAnexo(a.storage_path, a.nome)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={async () => {
                        await removerAnexoFn({ data: { id: a.id } });
                        invalidar();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Histórico */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
            </div>
            <div className="max-h-80 overflow-y-auto p-4">
              {historico.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">Sem registros.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-border/60 pl-4">
                  {historico.map((h: any) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary/60 ring-2 ring-card" />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {h.nome_ator ?? "Sistema"}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {fmtData(h.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {h.acao}
                      </p>
                      {h.acao === "transferida" && (
                        <p className="mt-0.5 text-xs">
                          <span className="text-muted-foreground line-through">
                            {h.nome_anterior ?? "—"}
                          </span>
                          {" → "}
                          <span className="text-primary">{h.nome_novo ?? "—"}</span>
                        </p>
                      )}
                      {h.motivo && (
                        <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-foreground">
                          {h.motivo}
                        </p>
                      )}
                      {h.detalhe && h.acao !== "transferida" && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{h.detalhe}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </aside>
      </div>

      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o: boolean) => !o && setVisualizando(null)}
      />
    </div>
  );
}

function MetricCell({
  icon: Icon,
  dot,
  rotulo,
  valor,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  dot?: string;
  rotulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 bg-card px-3.5 py-3 sm:px-4">
      {Icon ? (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot)} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <div className="mt-0.5 break-words text-sm font-semibold leading-tight text-foreground">
          {valor}
        </div>
      </div>
    </div>
  );
}

function InlineMetric({
  icon: Icon,
  dot,
  rotulo,
  valor,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  dot?: string;
  rotulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      )}
      <span className="text-[11px] font-medium text-muted-foreground">{rotulo}</span>
      <span className="text-[12px] font-semibold text-foreground">{valor}</span>
    </div>
  );
}

function InfoLinha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 truncate text-right text-sm text-foreground">{valor}</dd>
    </div>
  );
}

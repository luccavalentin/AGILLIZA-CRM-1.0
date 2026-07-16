import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { corDoBanco } from "@/lib/bancos/cores";
import { numeroBancoParaExibir } from "@/lib/propostas/numero-banco-display";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Ban,
  Loader2,
  Plus,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Building2,
  Info,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterProposta,
  selecionarBancoProposta,
  enviarPropostaHomeFin,
  sincronizarProposta,
  cancelarProposta,
  moverStatusProposta,
  adicionarFollowup,
  adicionarEnvolvido,
  obterConjugeCliente,
  atualizarEnvolvido,
  removerEnvolvido,
  registrarDocumento,
  removerDocumento,
  urlDocumento,
  salvarIq,
  definirSituacaoBanco,
  SITUACOES_BANCO,
} from "@/lib/propostas/propostas.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PipelineStepper } from "@/components/propostas/pipeline-stepper";
import { FunilBancoTimeline } from "@/components/propostas/funil-banco-timeline";
import { PropostaStatusBadge } from "@/components/propostas/status-badge";
import { statusBancoConfig, bancoJaEnviado } from "@/components/proposta/status-bancos-proposta";
import { BradescoRetornoTimer, isBradesco } from "@/components/proposta/bradesco-timer";
import { ToneBadge } from "@/components/crm/tone-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Clock, Check, LayoutDashboard, Users, Store, ClipboardList, Home, FolderOpen, Activity, MessageSquare } from "lucide-react";
import {
  baixarPropostaSimplificadaPDF,
  baixarPropostaDetalhadaPDF,
  baixarPropostaConsolidadoPDF,
} from "@/lib/propostas/proposta-pdf";
import { TRANSICOES, STATUS_EDITAVEIS, type PropostaStatus } from "@/lib/propostas/state-machine";
import { statusProposta } from "@/components/propostas/status";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import {
  ParticipanteDialog,
  envolvidoParaForm,
  participanteCompleto,
  type ParticipanteForm,
} from "@/components/proposta/participante-form";
import { ClienteSecao } from "@/components/proposta/cliente-secoes";
import { AbaEnviarBanco } from "@/components/proposta/aba-enviar-banco";

type SituacaoBanco = (typeof SITUACOES_BANCO)[number];

const SITUACAO_BANCO_LABEL: Record<SituacaoBanco, string> = {
  nao_enviado: "Não enviado",
  em_analise: "Em análise de crédito",
  condicionado: "Aprovado com condições",
  aprovado: "Crédito aprovado",
  recusado: "Crédito recusado",
  cancelado: "Cancelado",
};

const SITUACAO_BANCO_TONE: Record<
  SituacaoBanco,
  "success" | "danger" | "warning" | "info" | "muted"
> = {
  nao_enviado: "muted",
  em_analise: "info",
  condicionado: "warning",
  aprovado: "success",
  recusado: "danger",
  cancelado: "muted",
};

export const Route = createFileRoute("/_authenticated/operacional/propostas_/$id")({
  head: () => ({ meta: [{ title: "Proposta — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  validateSearch: (search: Record<string, unknown>): { complementar?: 1 } =>
    search.complementar === 1 || search.complementar === "1" ? { complementar: 1 } : {},
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar a proposta.</div>
  ),
});

const TABS = [
  "RESUMO",
  "COMPRADORES",
  "VENDEDORES",
  "IQ",
  "IMÓVEL",
  "DOCUMENTOS",
  "ENVIAR_BANCO",
  "ATIVIDADES",
  "FUP",
] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Partial<Record<Tab, string>> = {
  ENVIAR_BANCO: "Enviar ao banco",
  FUP: "Follow-up",
};

const TAB_ICONS: Record<Tab, React.ComponentType<{ className?: string }>> = {
  RESUMO: LayoutDashboard,
  COMPRADORES: Users,
  VENDEDORES: Store,
  IQ: ClipboardList,
  IMÓVEL: Home,
  DOCUMENTOS: FolderOpen,
  ENVIAR_BANCO: Upload,
  ATIVIDADES: Activity,
  FUP: MessageSquare,
};

/** Formata data/hora em pt-BR (ex.: "12/07/2026 14:30"). */
function formatarDataHora(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}



function Pagina() {
  const { id } = Route.useParams();
  const { complementar } = Route.useSearch();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("RESUMO");
  const [autoAbrir, setAutoAbrir] = useState(false);
  const [autoEnviar, setAutoEnviar] = useState(false);
  const [enviandoAuto, setEnviandoAuto] = useState(false);
  // Quando o envio falha por cadastro incompleto, destaca os campos obrigatórios pendentes.
  const [destacarObrigatorios, setDestacarObrigatorios] = useState(false);
  const enviarAutoFn = useServerFn(enviarPropostaHomeFin);
  const onCadastroIncompleto = () => {
    setTab("COMPRADORES");
    // Reinicia o destaque para forçar novo scroll até o primeiro campo pendente,
    // mesmo quando o usuário já estava com o destaque ativo.
    setDestacarObrigatorios(false);
    requestAnimationFrame(() => setDestacarObrigatorios(true));
  };


  const { data, isLoading } = useQuery({
    queryKey: ["proposta", id],
    queryFn: () => obterProposta({ data: { id } }),
    // Fallback de atualização automática caso o realtime não entregue o evento
    // (aba em background, websocket caído, etc.). Para em desfechos terminais.
    refetchInterval: (q: any) => {
      const st = q.state.data?.proposta?.status as string | undefined;
      if (!st) return 30_000;
      const terminais = ["contrato_emitido", "cancelada", "credito_recusado"];
      return terminais.includes(st) ? false : 30_000;
    },
    refetchOnWindowFocus: true,
  });

  // Polling automático silencioso da API do banco (Itaú, Santander, Bradesco…).
  // Enquanto a proposta estiver em análise ativa, dispara sincronização a cada 60s
  // para trazer o retorno do banco sem depender do clique manual em "Sincronizar".
  const sincronizarAutoFn = useServerFn(sincronizarProposta);
  const propostaStatus = data?.proposta?.status as string | undefined;
  useEffect(() => {
    const terminais = ["contrato_emitido", "cancelada", "credito_recusado", "rascunho"];
    if (!propostaStatus || terminais.includes(propostaStatus)) return;
    let cancelado = false;
    const tick = async () => {
      if (cancelado) return;
      try {
        const r = await sincronizarAutoFn({ data: { proposta_id: id } });
        if (!cancelado && r?.atualizado) {
          qc.invalidateQueries({ queryKey: ["proposta", id] });
        }
      } catch {
        // silencioso: mantém o botão manual como fallback visível ao usuário.
      }
    };
    // Primeiro disparo imediato após montar, depois a cada 60s.
    const t0 = setTimeout(tick, 2_000);
    const iv = setInterval(tick, 60_000);
    return () => {
      cancelado = true;
      clearTimeout(t0);
      clearInterval(iv);
    };
  }, [id, propostaStatus, sincronizarAutoFn, qc]);


  // Ao chegar de "Criar proposta", abre o cadastro complementar automaticamente
  // e marca a proposta para envio automático assim que o formulário for fechado.
  useEffect(() => {
    if (complementar === 1) {
      setTab("COMPRADORES");
      setAutoAbrir(true);
      setAutoEnviar(true);
    }
  }, [complementar]);

  // Envia a proposta ao banco imediatamente após o fechamento do cadastro
  // complementar (quando a proposta veio do fluxo "Criar proposta").
  async function enviarAposComplementar() {
    if (!autoEnviar) return;
    setAutoEnviar(false);
    setEnviandoAuto(true);
    const tid = toast.loading("Enviando proposta ao banco…");
    try {
      const r = await enviarAutoFn({ data: { proposta_id: id } });
      const numero =
        r?.bancos?.find((x: any) => x?.numero_proposta_banco)?.numero_proposta_banco ?? null;
      toast.success(
        numero
          ? `Proposta enviada ao banco. Nº do banco: ${numero}`
          : "Proposta enviada ao banco. O número será atualizado em instantes.",
        { id: tid },
      );
      await qc.invalidateQueries({ queryKey: ["proposta", id] });
      setTab("RESUMO");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar ao banco.", { id: tid });
    } finally {
      setEnviandoAuto(false);
    }
  }




  // realtime na proposta, nos bancos e no histórico — qualquer mudança dispara
  // uma reconsulta da proposta para refletir o retorno do banco em tempo real.
  useEffect(() => {
    const invalidar = () => qc.invalidateQueries({ queryKey: ["proposta", id] });
    const channel = supabase
      .channel(`proposta-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "propostas", filter: `id=eq.${id}` },
        invalidar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proposta_bancos", filter: `proposta_id=eq.${id}` },
        invalidar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proposta_historico", filter: `proposta_id=eq.${id}` },
        invalidar,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const p = data.proposta as any;
  const status = p.status as PropostaStatus;
  const diasDesde = Math.max(
    0,
    Math.round((Date.now() - new Date(p.created_at).getTime()) / 86400000),
  );
  const bancosEnviados = (data.bancos ?? []).filter(
    (b: any) => b.selecionado || b.status_banco === "enviada",
  );
  const multiBanco = bancosEnviados.length > 1;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-4 md:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
        <Link to="/operacional/propostas">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para propostas
        </Link>
      </Button>

      {(data.bancos ?? []).some(
        (b: any) =>
          isBradesco(b.nome_banco) &&
          bancoJaEnviado(b) &&
          ["enviada", "em_analise", "", null, undefined].includes(b.status_banco),
      ) && <BradescoRetornoTimer enviadoEm={p.enviada_em} />}

      {/* Header */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {p.produto ?? "Operação"}
            </span>
            <h1 className="mt-2 truncate text-2xl font-semibold text-foreground">
              {(() => { const nb = numeroBancoParaExibir(p.numero_proposta_banco); return nb ? `Proposta banco ${nb}` : `Proposta ${p.numero_proposta}`; })()}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {numeroBancoParaExibir(p.numero_proposta_banco) && <span className="mr-2">Interno {p.numero_proposta} ·</span>}
              {status === "cancelada"
                ? "Proposta cancelada"
                : `Ativa há ${diasDesde} dia(s)`}
            </p>
          </div>
          <AcoesTopo proposta={p} propostaId={id} bancos={data.bancos} envolvidos={data.envolvidos} documentos={data.documentos} followups={data.followups} onCadastroIncompleto={onCadastroIncompleto} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 divide-y divide-border border-b border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
          <Kpi
            label={multiBanco ? "Bancos enviados" : "Banco escolhido"}
            valor={
              multiBanco ? (
                `${bancosEnviados.length} bancos`
              ) : p.nome_banco ? (
                <span className="flex min-w-0 items-center gap-2">
                  <BancoLogo nome={p.nome_banco} size="lg" className="shrink-0" />
                  <span
                    className="truncate"
                    style={{ color: corDoBanco(p.nome_banco) }}
                  >
                    {p.nome_banco}
                  </span>
                </span>
              ) : (
                "—"
              )
            }
          />
          <Kpi label="Valor financiado" valor={formatBRL(p.valor_financiamento)} />
          <Kpi
            label="Situação"
            valor={
              multiBanco ? (
                <span className="text-sm text-muted-foreground">Ver por banco abaixo</span>
              ) : (
                <PropostaStatusBadge status={status} banco={p.nome_banco} />
              )
            }
          />
        </div>

        {multiBanco && (
          <div className="border-b border-border p-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Situação por banco
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {bancosEnviados.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <BancoLogo nome={b.nome_banco} size="md" className="shrink-0" />
                    <span
                      className="truncate text-sm font-semibold"
                      style={{ color: corDoBanco(b.nome_banco) }}
                    >
                      {b.nome_banco}
                    </span>
                  </span>
                  <ToneBadge
                    tone={SITUACAO_BANCO_TONE[(b.situacao_banco as SituacaoBanco) ?? "nao_enviado"]}
                  >
                    {SITUACAO_BANCO_LABEL[(b.situacao_banco as SituacaoBanco) ?? "nao_enviado"]}
                  </ToneBadge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-5">
          <PipelineStepper status={status} detalheStatus={p.detalhe_status_atual} />
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            {p.status_atualizado_em && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Nesta etapa desde {formatarDataHora(p.status_atualizado_em)}
              </span>
            )}
            {p.ultima_sincronizacao_em && (
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Última leitura do banco: {formatarDataHora(p.ultima_sincronizacao_em)}
              </span>
            )}
            {p.contrato_emitido_em && (
              <span className="inline-flex items-center gap-1 font-medium text-success">
                <Check className="h-3 w-3" />
                Contrato emitido em {formatarDataHora(p.contrato_emitido_em)}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Tabs — barra sofisticada com ícones, gradient underline e halo do ativo */}
      <div className="relative rounded-xl border border-border/70 bg-gradient-to-b from-card to-muted/30 p-1.5 shadow-sm">
        <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const Icone = TAB_ICONS[t];
            const ativo = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "group relative flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-300",
                  ativo
                    ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.5)] ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icone
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-300",
                    ativo ? "scale-110" : "group-hover:scale-110",
                  )}
                />
                <span>{TAB_LABELS[t] ?? t}</span>
                {ativo && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-3 bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-transparent via-primary-foreground/80 to-transparent"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>


      <div key={tab} className="animate-fade-in">
        {tab === "RESUMO" && <TabResumo proposta={p} bancos={data.bancos} propostaId={id} />}
        {tab === "COMPRADORES" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="comprador" destacarObrigatorios={destacarObrigatorios} onSalvoComprador={autoEnviar ? enviarAposComplementar : () => setTab("RESUMO")} />}
        {tab === "VENDEDORES" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="vendedores" />}
        {tab === "IQ" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="iq" />}
        {tab === "IMÓVEL" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="imovel" />}
        {tab === "DOCUMENTOS" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="documentos" />}
        {tab === "ENVIAR_BANCO" && <AbaEnviarBanco clienteId={p.cliente_id} propostaId={id} />}
        {tab === "ATIVIDADES" && <TabAtividades historico={data.historico} />}
        {tab === "FUP" && <TabFup propostaId={id} followups={data.followups} />}
      </div>

    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="p-5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-base font-semibold text-foreground">{valor}</div>
    </div>
  );
}

function MetricaBanco({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 to-muted/10 px-3.5 py-2.5 transition-colors">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[15px] font-semibold tabular-nums leading-tight text-foreground">
        {valor}
      </p>
    </div>
  );
}


/* ===== Ações do topo ===== */
function AcoesTopo({
  proposta,
  propostaId,
  bancos,
  envolvidos,
  documentos,
  followups,
  onCadastroIncompleto,
}: {
  proposta: any;
  propostaId: string;
  bancos: any[];
  envolvidos?: any[];
  documentos?: any[];
  followups?: any[];
  onCadastroIncompleto?: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const enviarFn = useServerFn(enviarPropostaHomeFin);
  const cancelarFn = useServerFn(cancelarProposta);
  const moverFn = useServerFn(moverStatusProposta);
  const sincronizarFn = useServerFn(sincronizarProposta);
  const status = proposta.status as PropostaStatus;
  const proximos = TRANSICOES[status].filter((s) => s !== "cancelada");

  async function enviar() {
    setBusy(true);
    try {
      const r = await enviarFn({ data: { proposta_id: propostaId } });
      toast.success(`Proposta enviada (${r.status}).`);
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao enviar.";
      toast.error(msg);
      if (/cadastro complementar|cadastro incompleto|obrigat/i.test(msg)) {
        onCadastroIncompleto?.();
      }
    } finally {
      setBusy(false);
    }
  }


  async function sincronizar() {
    setBusy(true);
    try {
      const r = await sincronizarFn({ data: { proposta_id: propostaId } });
      toast.success(
        r.atualizado
          ? `Situação atualizada${r.etapa ? `: ${r.etapa}` : ""}.`
          : "Nenhuma novidade do banco.",
      );
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar o banco.");
    } finally {
      setBusy(false);
    }
  }

  async function mover(novo: string) {
    setBusy(true);
    try {
      await moverFn({ data: { proposta_id: propostaId, novo_status: novo } });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transição inválida.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelar() {
    if (motivo.trim().length < 5) {
      toast.error("Informe um motivo com pelo menos 5 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await cancelarFn({ data: { proposta_id: propostaId, motivo } });
      toast.success("Proposta cancelada.");
      setCancelOpen(false);
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  // Bancos selecionados que ainda não foram ao banco (para envio adicional).
  const bancosPendentes = (bancos ?? []).filter(
    (b: any) => b.selecionado && !bancoJaEnviado(b),
  );
  const jaEnviou = Boolean(proposta.enviada_em);
  const podeEnviarNovos =
    jaEnviou &&
    bancosPendentes.length > 0 &&
    !["cancelada", "registrado", "credito_recusado", "contrato_emitido"].includes(status);

  const temDecisao = proximos.length > 0 || (status !== "cancelada" && status !== "registrado");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
      <div className="flex flex-wrap items-center gap-2">

      {(status === "rascunho" || status === "erro_envio") && (
        <Button size="sm" onClick={enviar} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1 h-4 w-4" />
          )}
          {proposta.enviada_em ? "Reenviar" : "Enviar ao banco"}
        </Button>
      )}
      {podeEnviarNovos && (
        <Button size="sm" onClick={enviar} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1 h-4 w-4" />
          )}
          Enviar a{" "}
          {bancosPendentes.length > 1 ? `${bancosPendentes.length} novos bancos` : "novo banco"}
        </Button>
      )}
      {proposta.homefin_id_oportunidade && status !== "cancelada" && (
        <Button size="sm" variant="outline" onClick={sincronizar} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Atualizar status
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary">
            <Download className="mr-1 h-4 w-4" /> Baixar PDF
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Documentos da proposta</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              const gerar = async () => {
                const t = toast.loading("Gerando ficha da proposta…");
                try {
                  const { baixarPropostaOficialPDF } = await import(
                    "@/lib/propostas/proposta-oficial-pdf"
                  );
                  // adia para o próximo tick para o menu fechar antes do trabalho síncrono do jsPDF
                  await new Promise((r) => setTimeout(r, 30));
                  baixarPropostaOficialPDF({
                    proposta,
                    bancos: bancos ?? [],
                    envolvidos: envolvidos ?? [],
                    documentos: documentos ?? [],
                    followups: followups ?? [],
                  });
                  toast.success("Ficha da proposta gerada.", { id: t });
                } catch (err) {
                  console.error("Falha ao gerar ficha da proposta", err);
                  toast.error(
                    err instanceof Error ? err.message : "Falha ao gerar a ficha da proposta.",
                    { id: t },
                  );
                }
              };
              void gerar();
            }}
          >
            Ficha da proposta (cadastro, checklist, etapas)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Extrato para o cliente</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              const gerar = async () => {
                const t = toast.loading("Gerando cronograma detalhado…");
                try {
                  await new Promise((r) => setTimeout(r, 30));
                  baixarPropostaDetalhadaPDF({ proposta, bancos });
                  toast.success("Cronograma gerado.", { id: t });
                } catch (err) {
                  console.error(err);
                  toast.error(
                    err instanceof Error ? err.message : "Falha ao gerar o cronograma.",
                    { id: t },
                  );
                }
              };
              void gerar();
            }}
            disabled={(bancos ?? []).length === 0}
          >
            Cronograma detalhado (todas as parcelas)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              const gerar = async () => {
                const t = toast.loading("Gerando comparativo consolidado…");
                try {
                  await new Promise((r) => setTimeout(r, 30));
                  baixarPropostaConsolidadoPDF({ proposta, bancos });
                  toast.success("Comparativo gerado.", { id: t });
                } catch (err) {
                  console.error(err);
                  toast.error(
                    err instanceof Error ? err.message : "Falha ao gerar o comparativo.",
                    { id: t },
                  );
                }
              };
              void gerar();
            }}
            disabled={(bancos ?? []).length === 0}
          >
            Comparativo consolidado
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>

      {temDecisao && (
        <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-border sm:pl-2">
      {proximos.map((s) => {
        const tone = statusProposta(s).tone;
        const isRecusa = s === "credito_recusado";
        const isAprova = s === "credito_aprovado";
        return (
          <Button
            key={s}
            size="sm"
            variant={isRecusa ? "destructive" : "secondary"}
            onClick={() => mover(s)}
            disabled={busy}
            className={cn(
              isAprova &&
                "bg-success text-success-foreground hover:bg-success/90",
            )}
          >
            {isRecusa ? "✕" : "→"} {statusProposta(s).label}
          </Button>
        );
      })}
      {status !== "cancelada" && status !== "registrado" && (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive">
              <Ban className="mr-1 h-4 w-4" /> Cancelar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar proposta</DialogTitle>
            </DialogHeader>
            <Label>Motivo do cancelamento</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelOpen(false)}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={cancelar} disabled={busy}>
                Confirmar cancelamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
        </div>
      )}
    </div>
  );
}

/* ===== RESUMO ===== */
function TabResumo({
  proposta,
  bancos,
  propostaId,
}: {
  proposta: any;
  bancos: any[];
  propostaId: string;
}) {
  const qc = useQueryClient();
  const selecionarFn = useServerFn(selecionarBancoProposta);
  const enviarFn = useServerFn(enviarPropostaHomeFin);
  const situacaoFn = useServerFn(definirSituacaoBanco);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [resultadoEnvio, setResultadoEnvio] = useState<
    { nome_banco: string | null; status: string; mensagem?: string }[] | null
  >(null);
  const [detalheBanco, setDetalheBanco] = useState<any | null>(null);

  async function mudarSituacao(pbId: string, situacao: SituacaoBanco) {
    try {
      await situacaoFn({
        data: { proposta_id: propostaId, proposta_banco_id: pbId, situacao_banco: situacao },
      });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
      toast.success("Situação do banco atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar situação.");
    }
  }

  const status = proposta.status as PropostaStatus;
  // Depois que a proposta já foi ao banco, mostra somente os bancos realmente
  // enviados (não a lista de simulações vinculadas). Antes do envio, mostra
  // todos para o usuário escolher qual enviar.
  const houveEnvio = (bancos ?? []).some((b) => bancoJaEnviado(b));
  const bancosVisiveis = houveEnvio
    ? (bancos ?? []).filter((b) => bancoJaEnviado(b) || b.status_banco === "erro")
    : (bancos ?? []);
  const podeEnviarBanco =
    Boolean(proposta.homefin_id_oportunidade) &&
    !["cancelada", "registrado", "credito_recusado", "contrato_emitido"].includes(status);



  async function selecionar(pbId: string) {
    try {
      await selecionarFn({ data: { proposta_id: propostaId, proposta_banco_id: pbId } });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao selecionar banco.");
    }
  }

  async function enviarBanco(pbId: string) {
    setEnviandoId(pbId);
    try {
      const r = await enviarFn({ data: { proposta_id: propostaId, banco_id: pbId } });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
      if (r.bancos.length > 0) {
        setResultadoEnvio(r.bancos);
      } else {
        toast.error("Nenhum banco foi enviado.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar ao banco.");
    } finally {
      setEnviandoId(null);
    }
  }

  const bancosEnviados = (bancos ?? []).filter((b) => bancoJaEnviado(b));
  const bancoReprovado =
    (bancos ?? []).find(
      (b: any) => b.situacao_credito === "reprovado" || b.status_banco === "credito_recusado",
    )?.nome_banco ?? null;

  return (
    <div className="space-y-5">
      <FunilBancoTimeline
        etapas={proposta.etapas_banco}
        statusProposta={proposta.status}
        bancoReprovado={bancoReprovado}
      />



      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 text-sm font-medium text-muted-foreground">
          {houveEnvio
            ? "Banco enviado nesta proposta"
            : "Bancos / Simulações vinculadas — envie somente o banco escolhido nesta proposta"}
        </div>

        {/* Mobile: cards responsivos (sem scroll horizontal) */}
        <div className="divide-y divide-border md:hidden">
          {bancosVisiveis.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum banco vinculado.
            </p>
          )}
          {bancosVisiveis.map((b) => (
            <div
              key={b.id}
              className={cn(
                "space-y-4 p-4 transition-colors",
                b.selecionado && "bg-accent/30",
              )}
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <Checkbox
                  checked={b.selecionado}
                  disabled={bancoJaEnviado(b)}
                  onCheckedChange={() => selecionar(b.id)}
                  aria-label={`Selecionar ${b.nome_banco}`}
                  className="shrink-0"
                />
                <span className="flex min-w-0 items-center gap-2.5">
                  <BancoLogo nome={b.nome_banco} size="md" className="shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span
                      className="truncate text-sm font-semibold leading-tight"
                      style={{ color: corDoBanco(b.nome_banco) }}
                    >
                      {b.nome_banco}
                    </span>
                    {(() => { const nb = numeroBancoParaExibir(b.numero_proposta_banco); return nb ? (
                      <span className="truncate text-[11px] tabular-nums text-muted-foreground">
                        Nº banco {nb}
                      </span>
                    ) : null; })()}
                  </span>
                </span>
                <ToneBadge tone={statusBancoConfig(b.status_banco).tone}>
                  {statusBancoConfig(b.status_banco).label}
                </ToneBadge>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <MetricaBanco label="R$ Financiamento" valor={formatBRL(b.valor_financiamento_max)} />
                <MetricaBanco label="Parcela" valor={formatBRL(b.valor_parcela)} />
                <MetricaBanco label="Prazo" valor={String(b.prazo_pagamento_max ?? "—")} />
                <MetricaBanco
                  label="Taxa/ano"
                  valor={b.taxa_juros_ano != null ? `${b.taxa_juros_ano}%` : "—"}
                />
              </div>

              <div className="border-t border-border/60 pt-3">
                <Label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Situação de crédito
                </Label>
                <Select
                  value={(b.situacao_banco as SituacaoBanco) ?? "nao_enviado"}
                  onValueChange={(v) => mudarSituacao(b.id, v as SituacaoBanco)}
                >
                  <SelectTrigger className="mt-1.5 h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITUACOES_BANCO.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SITUACAO_BANCO_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 flex-1"
                  onClick={() => setDetalheBanco(b)}
                >
                  <Info className="mr-1 h-4 w-4" /> Detalhamento
                </Button>
                {bancoJaEnviado(b) ? (
                  <span className="flex-1 rounded-md bg-emerald-500/10 py-2 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Enviado
                  </span>

                ) : podeEnviarBanco ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 flex-1"
                    onClick={() => enviarBanco(b.id)}
                    disabled={enviandoId !== null}
                  >
                    {enviandoId === b.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1 h-4 w-4" />
                    )}
                    {b.status_banco === "erro" ? "Reenviar" : "Enviar"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden overflow-x-auto md:block">
        <Table className="min-w-[880px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Nº banco</TableHead>
              <TableHead className="text-right">R$ Financiamento</TableHead>
              <TableHead className="text-right">Parcela</TableHead>
              <TableHead className="text-right">Prazo</TableHead>
              <TableHead className="text-right">Taxa/ano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Situação de crédito</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bancosVisiveis.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum banco vinculado.
                </TableCell>
              </TableRow>
            )}
            {bancosVisiveis.map((b) => (
              <TableRow key={b.id} className={cn(b.selecionado && "bg-accent/40")}>
                <TableCell>
                  <Checkbox
                    checked={b.selecionado}
                    disabled={bancoJaEnviado(b)}
                    onCheckedChange={() => selecionar(b.id)}
                    aria-label={`Selecionar ${b.nome_banco}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <BancoLogo nome={b.nome_banco} size="md" className="shrink-0" />
                    <span className="whitespace-nowrap" style={{ color: corDoBanco(b.nome_banco) }}>
                      {b.nome_banco}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="max-w-44 truncate text-xs tabular-nums text-muted-foreground">
                  {(() => { const nb = numeroBancoParaExibir(b.numero_proposta_banco); return nb ? `Nº banco ${nb}` : "—"; })()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(b.valor_financiamento_max)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(b.valor_parcela)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.prazo_pagamento_max ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.taxa_juros_ano != null ? `${b.taxa_juros_ano}%` : "—"}
                </TableCell>
                <TableCell>
                  <ToneBadge tone={statusBancoConfig(b.status_banco).tone}>
                    {statusBancoConfig(b.status_banco).label}
                  </ToneBadge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select
                      value={(b.situacao_banco as SituacaoBanco) ?? "nao_enviado"}
                      onValueChange={(v) => mudarSituacao(b.id, v as SituacaoBanco)}
                    >
                      <SelectTrigger className="h-8 w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SITUACOES_BANCO.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SITUACAO_BANCO_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 shrink-0"
                      onClick={() => setDetalheBanco(b)}
                    >
                      <Info className="mr-1 h-4 w-4" /> Detalhamento
                    </Button>
                  </div>
                </TableCell>


                <TableCell className="text-right">
                  {bancoJaEnviado(b) ? (
                    <span className="text-xs text-muted-foreground">Enviado</span>
                  ) : podeEnviarBanco ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => enviarBanco(b.id)}
                      disabled={enviandoId !== null}
                    >
                      {enviandoId === b.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-1 h-4 w-4" />
                      )}
                      {b.status_banco === "erro" ? "Reenviar" : "Enviar"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>



      <EnvioResultadoDialog
        resultado={resultadoEnvio}
        onClose={() => setResultadoEnvio(null)}
      />

      <DetalhamentoBancoDialog banco={detalheBanco} onClose={() => setDetalheBanco(null)} />
    </div>
  );
}

/* ===== Detalhamento da situação de crédito por banco ===== */
function DetalhamentoBancoDialog({
  banco,
  onClose,
}: {
  banco: any | null;
  onClose: () => void;
}) {
  const situacao = (banco?.situacao_banco as SituacaoBanco) ?? "nao_enviado";

  const conteudo: Record<
    SituacaoBanco,
    { icone: React.ReactNode; titulo: string; mensagem: string }
  > = {
    nao_enviado: {
      icone: <Info className="h-6 w-6 text-muted-foreground" />,
      titulo: "Proposta ainda não enviada",
      mensagem:
        "Esta proposta ainda não foi enviada ao banco. Envie-a para acompanhar a análise de crédito.",
    },
    em_analise: {
      icone: <Loader2 className="h-6 w-6 text-info" />,
      titulo: "Em análise de crédito",
      mensagem:
        "O banco está analisando a proposta. Assim que houver um retorno, o detalhamento será atualizado aqui.",
    },
    condicionado: {
      icone: <CheckCircle2 className="h-6 w-6 text-warning" />,
      titulo: "Aprovado com condições",
      mensagem:
        "O crédito foi aprovado, mas o banco estabeleceu condições. Confira abaixo as observações enviadas pelo banco.",
    },
    aprovado: {
      icone: <CheckCircle2 className="h-6 w-6 text-success" />,
      titulo: "Parabéns! Crédito aprovado 🎉",
      mensagem:
        "O banco aprovou o crédito desta proposta. Prossiga com as próximas etapas para dar sequência ao financiamento.",
    },
    recusado: {
      icone: <XCircle className="h-6 w-6 text-destructive" />,
      titulo: "Crédito recusado",
      mensagem:
        "Infelizmente o banco recusou o crédito.",
    },
    cancelado: {
      icone: <Ban className="h-6 w-6 text-muted-foreground" />,
      titulo: "Proposta cancelada",
      mensagem: "Esta proposta foi cancelada neste banco.",
    },
  };

  const info = conteudo[situacao];

  return (
    <Dialog open={banco !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {info?.icone}
            {info?.titulo}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {banco?.nome_banco && (
            <p className="flex items-center gap-2 font-medium" style={{ color: corDoBanco(banco.nome_banco) }}>
              <BancoLogo nome={banco.nome_banco} size="md" className="shrink-0" />
              {banco.nome_banco}
            </p>
          )}
          <p className="text-muted-foreground">{info?.mensagem}</p>
          {banco?.mensagem_banco && (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Retorno do banco
              </p>
              <p className="whitespace-pre-wrap text-foreground">{banco.mensagem_banco}</p>
            </div>
          )}
          {(() => { const nb = numeroBancoParaExibir(banco?.numero_proposta_banco); return nb ? (
            <p className="text-xs text-muted-foreground">
              Nº oficial da proposta no banco: {nb}
            </p>
          ) : null; })()}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== Popup centralizado de confirmação de envio ao banco ===== */
function EnvioResultadoDialog({
  resultado,
  onClose,
}: {
  resultado: { nome_banco: string | null; status: string; mensagem?: string }[] | null;
  onClose: () => void;
}) {
  const aberto = resultado !== null;
  const enviados = (resultado ?? []).filter((r) => r.status !== "erro");
  const comErro = (resultado ?? []).filter((r) => r.status === "erro");
  const soSucesso = comErro.length === 0 && enviados.length > 0;
  const soErro = enviados.length === 0 && comErro.length > 0;

  const titulo = soSucesso
    ? enviados.length > 1
      ? "Proposta enviada aos bancos"
      : "Proposta enviada ao banco"
    : soErro
      ? "Falha no envio"
      : "Envio concluído com ressalvas";

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div
            className={cn(
              "mb-1 flex h-14 w-14 items-center justify-center rounded-2xl",
              soErro
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {soErro ? (
              <XCircle className="h-7 w-7" />
            ) : (
              <CheckCircle2 className="h-7 w-7" />
            )}
          </div>
          <DialogTitle className="text-center">{titulo}</DialogTitle>
          <DialogDescription className="text-center">
            {enviados.length > 0
              ? `A proposta foi enviada para ${enviados.length === 1 ? "o banco" : `${enviados.length} bancos`} abaixo.`
              : "Não foi possível enviar a proposta."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {enviados.map((r, i) => (
            <div
              key={`ok-${i}`}
              className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5"
            >
              <BancoLogo nome={r.nome_banco} size="lg" className="shrink-0" />
              <span
                className="flex-1 text-sm font-medium"
                style={{ color: corDoBanco(r.nome_banco ?? "") }}
              >
                {r.nome_banco ?? "Banco"}
              </span>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            </div>
          ))}

          {comErro.map((r, i) => (
            <div
              key={`err-${i}`}
              className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5"
            >
              <BancoLogo nome={r.nome_banco} size="lg" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {r.nome_banco ?? "Banco"}
                </p>
                {r.mensagem && (
                  <p className="text-xs text-muted-foreground">{r.mensagem}</p>
                )}
              </div>
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full sm:w-auto">
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== Compradores / Vendedores ===== */
function TabEnvolvidos({
  tipo,
  propostaId,
  envolvidos,
  autoAbrir,
  onAutoAbriu,
  onFechouAposSalvar,
}: {
  tipo: "CO" | "VD";
  propostaId: string;
  envolvidos: any[];
  autoAbrir?: boolean;
  onAutoAbriu?: () => void;
  onFechouAposSalvar?: () => void;
}) {
  const qc = useQueryClient();
  const addFn = useServerFn(adicionarEnvolvido);
  const updFn = useServerFn(atualizarEnvolvido);
  const delFn = useServerFn(removerEnvolvido);
  const conjClienteFn = useServerFn(obterConjugeCliente);
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [inicial, setInicial] = useState<ParticipanteForm | undefined>(undefined);
  const [conjugeInicial, setConjugeInicial] = useState<ParticipanteForm | undefined>(undefined);
  const [conjugeId, setConjugeId] = useState<string | null>(null);

  // Compradores: mostra CO e TI, mas oculta o cônjuge já vinculado a um titular
  // (ele é editado dentro do formulário do titular).
  const lista = envolvidos.filter((e) =>
    tipo === "CO"
      ? (e.tipo_qualificacao === "CO" || e.tipo_qualificacao === "TI") && !e.conjuge_de
      : e.tipo_qualificacao === tipo,
  );

  const completo = participanteCompleto;

  function novo() {
    setEditId(null);
    setInicial(undefined);
    setConjugeInicial(undefined);
    setConjugeId(null);
    setOpen(true);
  }

  async function editar(e: any) {
    setEditId(e.id);
    setInicial(envolvidoParaForm(e));
    const conj = envolvidos.find((x) => x.conjuge_de === e.id);
    setConjugeInicial(conj ? envolvidoParaForm(conj) : undefined);
    setConjugeId(conj?.id ?? null);
    setOpen(true);
    // Sem cônjuge cadastrado na proposta: puxa os dados do cônjuge já
    // preenchidos na ficha do cliente (CRM) para pré-preencher o formulário.
    // O próprio server fn decide se o cliente é casado e tem cônjuge cadastrado.
    if (!conj && e.cliente_id) {
      try {
        const dadosConj = await conjClienteFn({ data: { cliente_id: e.cliente_id } });
        if (dadosConj) setConjugeInicial(envolvidoParaForm(dadosConj));
      } catch {
        /* ignora: mantém o bloco do cônjuge vazio */
      }
    }
  }



  // Abre automaticamente o formulário do comprador principal ao criar a proposta.
  useEffect(() => {
    if (!autoAbrir || tipo !== "CO") return;
    const principal =
      lista.find((e) => e.tipo_qualificacao === "CO") ?? lista[0] ?? null;
    if (principal) {
      editar(principal);
    } else {
      novo();
    }
    onAutoAbriu?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAbrir]);

  async function salvar(principal: any, conjuge: any) {
    setSalvando(true);
    try {
      let titularId = editId;
      if (editId) {
        await updFn({ data: { id: editId, dados: principal } });
      } else {
        const r = await addFn({
          data: {
            proposta_id: propostaId,
            dados: { ...principal, tipo_qualificacao: principal.tipo_qualificacao ?? tipo },
          },
        });
        titularId = r.id;
      }

      // Cônjuge (coproponente) — vinculado ao titular via conjuge_de.
      if (conjuge && titularId) {
        const dadosConj = { ...conjuge, tipo_qualificacao: "TI", conjuge_de: titularId };
        if (conjugeId) {
          await updFn({ data: { id: conjugeId, dados: dadosConj } });
        } else {
          await addFn({ data: { proposta_id: propostaId, dados: dadosConj } });
        }
      } else if (!conjuge && conjugeId) {
        // Deixou de ser casado: remove o cônjuge previamente cadastrado.
        await delFn({ data: { id: conjugeId } });
      }

      toast.success(editId ? "Participante atualizado." : "Participante incluído.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
      // Fluxo "Criar proposta": ao fechar o cadastro complementar, dispara o
      // envio automático da proposta ao(s) banco(s) selecionado(s).
      onFechouAposSalvar?.();

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }


  async function remover(id: string) {
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha ao remover participante.",
      );
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium text-muted-foreground">
          {tipo === "CO" ? "Compradores" : "Vendedores"}
        </span>
        <Button size="sm" onClick={novo}>
          <Plus className="mr-1 h-4 w-4" /> Incluir pessoa
        </Button>
      </div>

      <ParticipanteDialog
        open={open}
        onOpenChange={setOpen}
        titulo={
          editId
            ? "Editar participante"
            : `Incluir ${tipo === "CO" ? "comprador" : "vendedor"}`
        }
        inicial={inicial}
        conjugeInicial={conjugeInicial}
        tipoQualificacaoFixo={tipo === "VD" ? "VD" : undefined}
        salvando={salvando}
        onSalvar={salvar}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CPF/CNPJ</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Celular</TableHead>
            <TableHead>Dados</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                Nenhum {tipo === "CO" ? "comprador" : "vendedor"} cadastrado
              </TableCell>
            </TableRow>
          )}
          {lista.map((e) => (
            <TableRow
              key={e.id}
              className="cursor-pointer"
              onClick={() => editar(e)}
            >
              <TableCell>{e.cpf_cnpj ?? "—"}</TableCell>
              <TableCell className="font-medium">{e.nome}</TableCell>
              <TableCell>{e.email ?? "—"}</TableCell>
              <TableCell>{e.celular ?? "—"}</TableCell>
              <TableCell>
                <ToneBadge tone={completo(e) ? "success" : "warning"}>
                  {completo(e) ? "Completo" : "Incompleto"}
                </ToneBadge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    remover(e.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


/* ===== IQ ===== */
function TabIq({ proposta, propostaId }: { proposta: any; propostaId: string }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarIq);
  const [nome, setNome] = useState(proposta.iq_nome ?? "");
  const [comentario, setComentario] = useState(proposta.iq_comentario ?? "");

  async function salvar() {
    try {
      await salvarFn({
        data: { proposta_id: propostaId, iq_nome: nome, iq_comentario: comentario },
      });
      toast.success("Dados do interveniente salvos.");
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Dados do interveniente quitante
      </p>
      <div>
        <Label>Nome</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div>
        <Label>Comentário sobre o processo</Label>
        <Textarea
          value={comentario}
          maxLength={2000}
          rows={5}
          onChange={(e) => setComentario(e.target.value)}
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{comentario.length}/2000</p>
      </div>
      <div className="flex justify-end">
        <Button onClick={salvar}>Salvar</Button>
      </div>
    </div>
  );
}

/* ===== Imóvel ===== */
function TabImovel({ proposta, propostaId }: { proposta: any; propostaId: string }) {
  const editavel = STATUS_EDITAVEIS.includes(proposta.status);
  const campos: [string, string][] = [
    ["Tipo do imóvel", proposta.tipo_imovel ?? "—"],
    ["Uso do imóvel", proposta.uso_imovel ?? "—"],
    ["CEP", proposta.cep_imovel ?? "—"],
    ["Endereço", proposta.endereco_imovel ?? "—"],
    ["Bairro", proposta.bairro_imovel ?? "—"],
    ["Cidade", proposta.cidade_imovel ?? "—"],
    ["UF", proposta.uf ?? "—"],
  ];
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Dados do imóvel
      </p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {campos.map(([l, v]) => (
          <div key={l}>
            <Label className="text-xs text-muted-foreground">{l}</Label>
            <div className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {v}
            </div>
          </div>
        ))}
      </div>
      {!editavel && (
        <p className="mt-4 text-xs text-muted-foreground">Dados congelados no status atual.</p>
      )}
    </div>
  );
}

/* ===== Documentos ===== */
const TIPOS_DOC = [
  "RG",
  "CPF",
  "COMP_RENDA",
  "IR",
  "EXT_BANC",
  "MATRICULA",
  "IPTU",
  "CERT_NASC",
  "CERT_CAS",
];

function TabDocumentos({ propostaId, documentos }: { propostaId: string; documentos: any[] }) {
  const qc = useQueryClient();
  const registrarFn = useServerFn(registrarDocumento);
  const removerFn = useServerFn(removerDocumento);
  const urlFn = useServerFn(urlDocumento);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState("RG");
  const [parte, setParte] = useState("comprador1");
  const [uploading, setUploading] = useState(false);
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);

  async function onFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo acima de 10 MB. Escolha um arquivo menor.");
      return;
    }
    setUploading(true);
    try {
      const path = `${propostaId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("documentos-proposta").upload(path, file);
      if (error) throw new Error(error.message);
      await registrarFn({
        data: {
          proposta_id: propostaId,
          nome_documento: file.name,
          tipo_documento: tipo,
          parte,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
        },
      });
      toast.success("Documento anexado.");
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  async function baixar(storage_path: string, nome: string) {
    try {
      const { url } = await urlFn({ data: { storage_path } });
      setVisualizando({ url, nome });
    } catch {
      toast.error("Não foi possível gerar o link.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DOC.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Participante</Label>
          <Select value={parte} onValueChange={setParte}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comprador1">Comprador 1</SelectItem>
              <SelectItem value="comprador2">Comprador 2</SelectItem>
              <SelectItem value="vendedor">Vendedor</SelectItem>
              <SelectItem value="imovel">Imóvel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1 h-4 w-4" />
          )}
          Adicionar documento
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participante</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum documento anexado.
                </TableCell>
              </TableRow>
            )}
            {documentos.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.parte ?? "—"}</TableCell>
                <TableCell>{d.tipo_documento ?? "—"}</TableCell>
                <TableCell className="font-medium">{d.nome_documento}</TableCell>
                <TableCell>
                  <ToneBadge
                    tone={
                      d.status === "aprovado"
                        ? "success"
                        : d.status === "reprovado"
                          ? "danger"
                          : "info"
                    }
                  >
                    {d.status}
                  </ToneBadge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => baixar(d.storage_path, d.nome_documento ?? "documento")}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await removerFn({ data: { id: d.id } });
                      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o: boolean) => !o && setVisualizando(null)}
      />
    </div>
  );
}

/* ===== Atividades (histórico) ===== */
function TabAtividades({ historico }: { historico: any[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evento</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {historico.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                Sem atividades.
              </TableCell>
            </TableRow>
          )}
          {historico.map((h) => (
            <TableRow key={h.id}>
              <TableCell className="font-medium">{h.tipo_evento}</TableCell>
              <TableCell className="text-muted-foreground">
                {h.descricao ?? (h.status_novo ? statusProposta(h.status_novo).label : "—")}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(h.created_at).toLocaleString("pt-BR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ===== FUP ===== */
function TabFup({ propostaId, followups }: { propostaId: string; followups: any[] }) {
  const qc = useQueryClient();
  const addFn = useServerFn(adicionarFollowup);
  const [tipo, setTipo] = useState<"interno" | "externo">("interno");
  const [titulo, setTitulo] = useState("");
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);

  async function incluir() {
    if (comentario.trim().length === 0) {
      toast.error("Escreva um comentário.");
      return;
    }
    setBusy(true);
    try {
      await addFn({
        data: { proposta_id: propostaId, tipo, titulo: titulo || undefined, comentario },
      });
      setTitulo("");
      setComentario("");
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao incluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Incluir comentário
        </p>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interno">Interno</SelectItem>
              <SelectItem value="externo">Externo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Título</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <Label>Comentário</Label>
          <Textarea
            value={comentario}
            maxLength={4000}
            rows={4}
            onChange={(e) => setComentario(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{comentario.length}/4000</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={incluir} disabled={busy}>
            Incluir comentário
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico de comentários
        </p>
        <div className="space-y-3">
          {followups.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum comentário.</p>
          )}
          {followups.map((f) => {
            const rotulo =
              f.tipo === "banco" ? "Banco" : f.tipo === "externo" ? "Externo" : "Interno";
            const tone =
              f.tipo === "banco" ? "success" : f.tipo === "externo" ? "info" : "muted";
            return (
              <div key={f.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <ToneBadge tone={tone as any}>{rotulo}</ToneBadge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {f.titulo && <p className="mt-2 font-medium text-foreground">{f.titulo}</p>}
                <p className="text-sm text-muted-foreground">{f.comentario}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

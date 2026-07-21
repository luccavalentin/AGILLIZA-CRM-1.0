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
import { TabIq } from "@/components/proposta/tabs/tab-iq";
import { TabImovel } from "@/components/proposta/tabs/tab-imovel";
import { TabDocumentos } from "@/components/proposta/tabs/tab-documentos";
import { TabAtividades } from "@/components/proposta/tabs/tab-atividades";
import { TabFup } from "@/components/proposta/tabs/tab-fup";
import { TabEnvolvidos } from "@/components/proposta/tabs/tab-envolvidos";
import { TabResumo } from "@/components/proposta/tabs/tab-resumo";
import { AcoesTopo } from "@/components/proposta/acoes-topo";
import { DetalhamentoBancoDialog } from "@/components/proposta/dialogs/detalhamento-banco-dialog";
import { EnvioResultadoDialog } from "@/components/proposta/dialogs/envio-resultado-dialog";
import {
  SITUACAO_BANCO_LABEL,
  SITUACAO_BANCO_TONE,
  type SituacaoBanco,
} from "@/components/proposta/situacao-banco-labels";



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


  // Envia a proposta ao banco de forma automática (usado tanto após salvar o
  // cadastro complementar quanto quando o cadastro já veio pronto do CRM).
  const enviouAutoRef = useRef(false);
  async function enviarAposComplementar() {
    if (enviouAutoRef.current) return;
    enviouAutoRef.current = true;
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
      // Se o envio falhar (ex.: cadastro incompleto detectado no servidor),
      // permite nova tentativa.
      enviouAutoRef.current = false;
    } finally {
      setEnviandoAuto(false);
    }
  }

  // Ao chegar de "Criar proposta": se o cadastro do titular (e do cônjuge,
  // quando existir) já está completo, dispara o envio direto ao banco.
  // Só abre o formulário complementar quando algum campo obrigatório está
  // pendente — evita a etapa de "validação" quando tudo já veio do CRM.
  useEffect(() => {
    if (complementar !== 1) return;
    if (!data) return; // aguarda os envolvidos carregarem
    if (enviouAutoRef.current) return;
    const envolvidos = (data.envolvidos ?? []) as any[];
    const titular = envolvidos.find(
      (e: any) => !e.conjuge_de && (e.tipo_qualificacao === "CO" || e.tipo_qualificacao === "TI"),
    );
    const conjuge = titular
      ? envolvidos.find((e: any) => String(e.conjuge_de ?? "") === String(titular.id))
      : envolvidos.find((e: any) => e.conjuge_de);
    const titularOk = titular ? participanteCompleto(titular) : false;
    // Cônjuge só precisa de nome/CPF/nascimento — o restante é enviado no bloco
    // "nomeConjuge/..." da oportunidade e não exige cadastro completo.
    const conjugeOk = !conjuge || Boolean(conjuge.nome && conjuge.cpf_cnpj);
    if (titularOk && conjugeOk) {
      // Cadastro já completo (veio do CRM): dispara o envio direto, sem
      // passar pelo formulário de validação.
      setAutoAbrir(false);
      // Limpa a flag da URL para que o efeito não reexecute em rerenders.
      router.navigate({
        to: "/operacional/propostas/$id",
        params: { id },
        search: {},
        replace: true,
      });
      void enviarAposComplementar();
    } else {
      setTab("COMPRADORES");
      setAutoAbrir(true);
      setAutoEnviar(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complementar, data]);




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



/* ===== Detalhamento da situação de crédito por banco ===== */



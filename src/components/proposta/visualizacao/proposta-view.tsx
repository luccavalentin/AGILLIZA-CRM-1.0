import * as React from "react";
import { Link } from "@tanstack/react-router";
import { 
  ArrowLeft, 
  AlertCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Check, 
  ChevronDown, 
  Info 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/crm/tone-badge";
import { corDoBanco } from "@/lib/bancos/cores";
import { numeroBancoParaExibir } from "@/lib/propostas/numero-banco-display";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { PipelineStepper } from "@/components/propostas/pipeline-stepper";
import { PropostaStatusBadge } from "@/components/propostas/status-badge";
import { bancoJaEnviado } from "@/components/proposta/status-bancos-proposta";
import { BradescoRetornoTimer, isBradesco } from "@/components/proposta/bradesco-timer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  SITUACAO_BANCO_LABEL, 
  SITUACAO_BANCO_TONE, 
  type SituacaoBanco 
} from "@/components/proposta/situacao-banco-labels";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import { type PropostaStatus } from "@/lib/propostas/state-machine";
import { TabResumo } from "@/components/proposta/tabs/tab-resumo";
import { ClienteSecao } from "@/components/proposta/cliente-secoes";
import { AbaEnviarBanco } from "@/components/proposta/aba-enviar-banco";
import { TabAtividades } from "@/components/proposta/tabs/tab-atividades";
import { TabFup } from "@/components/proposta/tabs/tab-fup";
import { AcoesTopo } from "@/components/proposta/acoes-topo";
import { ParticipanteDialog } from "@/components/proposta/participante-form";
import { faltantesEnvolvido, descreverParticipante } from "@/lib/propostas/campos-obrigatorios";
import { ErrorBoundaryAba } from "./error-boundary-aba";

// Tipos para as TABS
export const TABS = [
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
export type Tab = (typeof TABS)[number];

const TAB_LABELS: Partial<Record<Tab, string>> = {
  ENVIAR_BANCO: "Enviar ao banco",
  FUP: "Follow-up",
};

import { 
  LayoutDashboard, 
  Users, 
  Store, 
  ClipboardList, 
  Home, 
  FolderOpen, 
  Activity, 
  Upload, 
  MessageSquare 
} from "lucide-react";

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

function formatarDataHora(iso: string): string {
  const d = new Date(iso?.includes("T") ? iso : iso?.replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { 
    timeZone: "America/Sao_Paulo",  
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Kpi({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="p-5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-base font-semibold text-foreground">{valor}</div>
    </div>
  );
}

interface PropostaViewProps {
  id: string;
  data: any;
  handleEnviarHook: any;
  onCadastroIncompletoSemArgs: () => void;
  onCadastroIncompleto: (env: any) => void;
  inicialParticipante: any;
  conjugeInicialParticipante: any;
  indiceParticipante: number;
  totalPendentes: number;
  participanteModal: any;
  setParticipanteModal: (v: any) => void;
  onSalvarParticipante: (principal: any, conjuge: any, opcoes: any) => Promise<void>;
  nomeConjugeExistente: string | null;
  router: any;
}

export function PropostaView({
  id,
  data,
  handleEnviarHook,
  onCadastroIncompletoSemArgs,
  onCadastroIncompleto,
  inicialParticipante,
  conjugeInicialParticipante,
  indiceParticipante,
  totalPendentes,
  participanteModal,
  setParticipanteModal,
  onSalvarParticipante,
  nomeConjugeExistente,
  router
}: PropostaViewProps) {
  const [tab, setTab] = React.useState<Tab>("RESUMO");
  const [destacarObrigatorios, setDestacarObrigatorios] = React.useState(false);
  
  const p = data.proposta;
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
          <AcoesTopo proposta={p} propostaId={id} bancos={data.bancos} envolvidos={data.envolvidos} documentos={data.documentos} followups={data.followups} onCadastroIncompleto={onCadastroIncompletoSemArgs} />
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
                <div className="flex flex-col items-start gap-1">
                  <span className="text-destructive font-medium animate-bounce-subtle">
                    Escolha um banco para prosseguir
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Vá na aba "Enviar ao Banco" e selecione as opções desejadas.
                  </p>
                </div>
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

        {/* Banco feedback / Error messages */}
        {(data.bancos ?? []).map((b: any) => {
          const erroMsg = b.mensagem_banco || b.mensagem;
          if (!erroMsg && !b.retorno_integracao) return null;

          const originalMsg = String(b.retorno_integracao || "");
          const santanderRangeMatch = originalMsg.match(/"max":\s*(\d+)/);
          const valorMax = santanderRangeMatch ? Number(santanderRangeMatch[1]) : null;
          const valorInformadoMatch = originalMsg.match(/"valueProvided":\s*(\d+)/);
          const valorInformado = valorInformadoMatch ? Number(valorInformadoMatch[1]) : null;
          const diferenca = valorInformado && valorMax ? valorInformado - valorMax : 0;

          return (
            <div
              key={b.id}
              className={cn(
                "mt-4 flex flex-col gap-3 rounded-xl border p-4 mx-5 mb-5 shadow-sm",
                b.status_banco === "erro"
                  ? "border-destructive/20 bg-destructive/5"
                  : b.status_banco === "recusada" && valorMax
                  ? "border-warning/30 bg-warning/5"
                  : "border-primary/20 bg-primary/5",
              )}
            >
              <div className="flex items-start gap-3">
                {b.status_banco === "erro" ? (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                ) : b.status_banco === "recusada" && valorMax ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                ) : (
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      Retorno do {b.nome_banco}
                    </p>
                    {b.status_banco === "recusada" && valorMax && (
                       <span className="text-[10px] font-bold uppercase tracking-wider text-warning">Regra de limite</span>
                    )}
                  </div>
                  
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {erroMsg || "O banco não informou o motivo detalhado."}
                  </p>

                  {b.status_banco === "recusada" && valorMax && (
                    <div className="mt-2 space-y-2 border-t border-warning/20 pt-2">
                      <p className="text-xs font-medium text-warning-foreground">
                        Diferença: <span className="font-bold">{formatBRL(diferenca)}</span> acima do limite deste banco.
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 gap-1.5 text-[11px] font-bold uppercase tracking-wider border-warning/50 text-warning-foreground hover:bg-warning/10"
                        onClick={async () => {
                          const { supabase } = await import("@/integrations/supabase/client");
                          const { toast } = await import("sonner");
                          const tid = toast.loading("Ajustando valor e reenviando...");
                          try {
                            const { error: updErr } = await supabase
                              .from("propostas")
                              .update({ valor_financiamento: valorMax } as any)
                              .eq("id", id);
                            if (updErr) throw updErr;
                            await handleEnviarHook({ propostaId: id, bancoId: b.banco_id });
                            toast.success(`Proposta ajustada para ${formatBRL(valorMax)} e reenviada!`, { id: tid });
                          } catch (e: any) {
                            toast.error(e.message || "Falha ao ajustar e reenviar.", { id: tid });
                          }
                        }}
                      >
                         Ajustar para {formatBRL(valorMax)} e reenviar
                      </Button>
                    </div>
                  )}
                  
                  {(b.retorno_integracao || b.codigo_situacao_banco) && (
                    <div className="mt-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                            Detalhes técnicos <ChevronDown className="ml-1 h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-w-[400px]">
                          <div className="p-3 text-[11px] font-mono leading-normal text-muted-foreground">
                            {b.codigo_situacao_banco && (
                              <div className="mb-2">
                                <span className="font-bold text-foreground">Código banco:</span> {b.codigo_situacao_banco}
                              </div>
                            )}
                            {b.retorno_integracao && (
                              <div>
                                <span className="font-bold text-foreground">Payload:</span>
                                <pre className="mt-1 max-h-[200px] overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-[10px]">
                                  {typeof b.retorno_integracao === 'string' 
                                    ? b.retorno_integracao 
                                    : JSON.stringify(b.retorno_integracao, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

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

      {/* Tabs */}
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
        <ErrorBoundaryAba nomeAba={tab}>
          {tab === "RESUMO" && <TabResumo proposta={p} bancos={data.bancos} propostaId={id} />}
          {tab === "COMPRADORES" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="comprador" destacarObrigatorios={destacarObrigatorios} onSalvoComprador={() => setTab("RESUMO")} idBanco={data.bancos?.[0]?.id_banco} />}
          {tab === "VENDEDORES" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="vendedores" />}
          {tab === "IQ" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="iq" />}
          {tab === "IMÓVEL" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="imovel" />}
          {tab === "DOCUMENTOS" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="documentos" />}
          {tab === "ENVIAR_BANCO" && (
            <AbaEnviarBanco
              clienteId={p.cliente_id}
              propostaId={id}
              envolvidos={data.envolvidos}
              proposta={p}
              onCompletar={(env) => {
                if (env.tipo_qualificacao === "CO") {
                  setTab("COMPRADORES");
                  setDestacarObrigatorios(true);
                } else {
                  setParticipanteModal(env);
                }
              }}
            />
          )}
          {tab === "ATIVIDADES" && <TabAtividades historico={data.historico} />}
          {tab === "FUP" && <TabFup propostaId={id} followups={data.followups} />}
        </ErrorBoundaryAba>
      </div>

      <ParticipanteDialog
        open={Boolean(participanteModal)}
        onOpenChange={(v) => !v && setParticipanteModal(null)}
        titulo="Completar dados do participante"
        avisoTopo={
          participanteModal && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive font-medium leading-relaxed">
              <AlertTriangle className="inline-block h-4 w-4 mr-1.5 align-text-bottom" />
              Falta{faltantesEnvolvido(participanteModal).length === 1 ? "" : "m"} {faltantesEnvolvido(participanteModal).length} dado{faltantesEnvolvido(participanteModal).length === 1 ? "" : "s"} obrigatório{faltantesEnvolvido(participanteModal).length === 1 ? "" : "s"} de{" "}
              {descreverParticipante(participanteModal)} para enviar ao banco. Preencha os campos destacados em vermelho.
            </div>
          )
        }
        participanteIndex={indiceParticipante}
        totalParticipantes={totalPendentes}
        inicial={inicialParticipante}
        conjugeInicial={conjugeInicialParticipante}
        participanteId={participanteModal?.id}
        focarPendencias={true}
        nomeConjugeExistente={nomeConjugeExistente}
        onSalvar={onSalvarParticipante}
      />
    </div>
  );
}

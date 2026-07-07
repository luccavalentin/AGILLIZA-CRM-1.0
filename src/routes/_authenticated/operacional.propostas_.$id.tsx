import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { corDoBanco } from "@/lib/bancos/cores";
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
import { ChevronDown } from "lucide-react";
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
  "ATIVIDADES",
  "FUP",
] as const;
type Tab = (typeof TABS)[number];

function Pagina() {
  const { id } = Route.useParams();
  const { complementar } = Route.useSearch();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("RESUMO");
  const [autoAbrir, setAutoAbrir] = useState(false);
  const [autoEnviar, setAutoEnviar] = useState(false);
  const [enviandoAuto, setEnviandoAuto] = useState(false);
  const enviarAutoFn = useServerFn(enviarPropostaHomeFin);

  const { data, isLoading } = useQuery({
    queryKey: ["proposta", id],
    queryFn: () => obterProposta({ data: { id } }),
  });

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
      toast.success(`Proposta enviada ao banco (${r.status}).`, { id: tid });
      qc.invalidateQueries({ queryKey: ["proposta", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar ao banco.", { id: tid });
    } finally {
      setEnviandoAuto(false);
    }
  }




  // realtime na proposta
  useEffect(() => {
    const channel = supabase
      .channel(`proposta-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "propostas", filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["proposta", id] });
        },
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
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/operacional/propostas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <AcoesTopo proposta={p} propostaId={id} bancos={data.bancos} />
      </div>

      {(data.bancos ?? []).some(
        (b: any) =>
          isBradesco(b.nome_banco) &&
          bancoJaEnviado(b) &&
          ["enviada", "em_analise", "", null, undefined].includes(b.status_banco),
      ) && <BradescoRetornoTimer enviadoEm={p.enviada_em} />}


      {/* Header linha 1 */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Proposta {p.numero_proposta_banco || p.codigo_oportunidade_homefin || p.numero_proposta}
            </h1>
            <p className="text-sm text-muted-foreground">
              {p.produto ?? "Operação"} ·{" "}
              {status === "cancelada"
                ? "Proposta cancelada"
                : `Ativa há ${diasDesde} dia(s)`}
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <Kpi
              label={multiBanco ? "Bancos enviados" : "Banco escolhido"}
              valor={multiBanco ? `${bancosEnviados.length} bancos` : (p.nome_banco ?? "—")}
            />
            <Kpi label="R$ Financiado" valor={formatBRL(p.valor_financiamento)} />
            {!multiBanco && (
              <Kpi
                label="Situação"
                valor={<PropostaStatusBadge status={status} banco={p.nome_banco} />}
              />
            )}
          </div>
        </div>

        {multiBanco && (
          <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Situação por banco
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {bancosEnviados.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
                >
                  <span className="truncate text-sm font-medium" style={{ color: corDoBanco(b.nome_banco) }}>
                    {b.nome_banco}
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

        <div className="mt-6">
          <PipelineStepper status={status} detalheStatus={p.detalhe_status_atual} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "RESUMO" && <TabResumo proposta={p} bancos={data.bancos} propostaId={id} />}
      {tab === "COMPRADORES" && (
        <TabEnvolvidos
          tipo="CO"
          propostaId={id}
          envolvidos={data.envolvidos}
          autoAbrir={autoAbrir}
          onAutoAbriu={() => {
            setAutoAbrir(false);
            router.navigate({
              to: "/operacional/propostas/$id",
              params: { id },
              search: {},
              replace: true,
            });
          }}
          onFechouAposSalvar={enviarAposComplementar}
        />


      )}
      {tab === "VENDEDORES" && (
        <TabEnvolvidos tipo="VD" propostaId={id} envolvidos={data.envolvidos} />
      )}
      {tab === "IQ" && <TabIq proposta={p} propostaId={id} />}
      {tab === "IMÓVEL" && <TabImovel proposta={p} propostaId={id} />}
      {tab === "DOCUMENTOS" && <TabDocumentos propostaId={id} documentos={data.documentos} />}
      {tab === "ATIVIDADES" && <TabAtividades historico={data.historico} />}
      {tab === "FUP" && <TabFup propostaId={id} followups={data.followups} />}
    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{valor}</p>
    </div>
  );
}

/* ===== Ações do topo ===== */
function AcoesTopo({
  proposta,
  propostaId,
  bancos,
}: {
  proposta: any;
  propostaId: string;
  bancos: any[];
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
      toast.error(e instanceof Error ? e.message : "Falha ao enviar.");
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

  return (
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
          <DropdownMenuLabel>Extrato para o cliente</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => baixarPropostaSimplificadaPDF({ proposta, bancos })}
            disabled={(bancos ?? []).length === 0}
          >
            Proposta simplificada
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => baixarPropostaDetalhadaPDF({ proposta, bancos })}
            disabled={(bancos ?? []).length === 0}
          >
            Proposta detalhada (todas as parcelas)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => baixarPropostaConsolidadoPDF({ proposta, bancos })}
            disabled={(bancos ?? []).length === 0}
          >
            Comparativo consolidado (interno)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
    ? (bancos ?? []).filter((b) => bancoJaEnviado(b))
    : (bancos ?? []);
  const podeEnviarBanco =
    Boolean(proposta.homefin_id_oportunidade) &&
    !["cancelada", "registrado", "credito_recusado", "contrato_emitido"].includes(status);
  const campos: [string, string][] = [
    ["Operação", proposta.produto ?? "—"],
    ["Nº interno", proposta.numero_proposta],
    ["Nº da proposta no banco", proposta.numero_proposta_banco ?? "—"],
  ];

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

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2 text-sm font-medium text-muted-foreground">
          {houveEnvio
            ? "Banco enviado nesta proposta"
            : "Bancos / Simulações vinculadas — envie somente o banco escolhido nesta proposta"}
        </div>
        <Table>
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
                <TableCell className="font-medium" style={{ color: corDoBanco(b.nome_banco) }}>{b.nome_banco}</TableCell>
                <TableCell className="max-w-44 truncate text-xs tabular-nums text-muted-foreground">
                  {b.numero_proposta_banco ?? "—"}
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

      <div className="grid gap-3 rounded-lg border border-border bg-card p-5 sm:grid-cols-2 md:grid-cols-3">
        {campos.map(([label, valor]) => (
          <div key={label}>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <div className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              {valor}
            </div>
          </div>
        ))}
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
            <p className="font-medium" style={{ color: corDoBanco(banco.nome_banco) }}>
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
          {banco?.numero_proposta_banco && (
            <p className="text-xs text-muted-foreground">
              Nº da proposta no banco: {banco.numero_proposta_banco}
            </p>
          )}
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
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Building2 className="h-4 w-4" />
              </span>
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
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <Building2 className="h-4 w-4" />
              </span>
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

  async function baixar(storage_path: string) {
    try {
      const { url } = await urlFn({ data: { storage_path } });
      window.open(url, "_blank");
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
                  <Button size="icon" variant="ghost" onClick={() => baixar(d.storage_path)}>
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
          {followups.map((f) => (
            <div key={f.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <ToneBadge tone={f.tipo === "externo" ? "info" : "muted"}>{f.tipo}</ToneBadge>
                <span className="text-xs text-muted-foreground">
                  {new Date(f.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              {f.titulo && <p className="mt-2 font-medium text-foreground">{f.titulo}</p>}
              <p className="text-sm text-muted-foreground">{f.comentario}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

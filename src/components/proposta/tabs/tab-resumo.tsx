import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { numeroBancoParaExibir } from "@/lib/propostas/numero-banco-display";
import { FunilBancoTimeline } from "@/components/propostas/funil-banco-timeline";
import { ToneBadge } from "@/components/crm/tone-badge";
import { statusBancoConfig, bancoJaEnviado } from "@/components/proposta/status-bancos-proposta";
import { DetalhamentoBancoDialog } from "@/components/proposta/dialogs/detalhamento-banco-dialog";
import { EnvioResultadoDialog } from "@/components/proposta/dialogs/envio-resultado-dialog";
import {
  selecionarBancoProposta,
  enviarPropostaHomeFin,
  definirSituacaoBanco,
  SITUACOES_BANCO,
} from "@/lib/propostas/propostas.functions";
import { SITUACAO_BANCO_LABEL, type SituacaoBanco } from "@/components/proposta/situacao-banco-labels";
import type { PropostaStatus } from "@/lib/propostas/state-machine";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";

function MetricaBanco({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{valor}</div>
    </div>
  );
}

export function TabResumo({
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
                    {(() => {
                      const nb = numeroBancoParaExibir(b.numero_proposta_banco);
                      return nb ? (
                        <span className="truncate text-[11px] tabular-nums text-muted-foreground">
                          Nº banco {nb}
                        </span>
                      ) : null;
                    })()}
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
                    {(() => {
                      const nb = numeroBancoParaExibir(b.numero_proposta_banco);
                      return nb ? `Nº banco ${nb}` : "—";
                    })()}
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

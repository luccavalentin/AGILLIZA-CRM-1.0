import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ExternalLink,
  RefreshCw,
  X,
  Download,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { BancoStatusBadge } from "@/components/simulacao/status-badge";
import { DetalheBancoDialog } from "@/components/simulacao/detalhe-banco-dialog";
import { ToneBadge } from "@/components/crm/tone-badge";
import {
  obterSimulacao,
  enviarSimulacaoBanco,
} from "@/lib/simulacao/simulacoes.functions";
import { criarProposta, enviarPropostaHomeFin } from "@/lib/propostas/propostas.functions";
import { formatBRL, formatPercent } from "@/lib/simulacao/format";
import { corDoBanco } from "@/lib/bancos/cores";
import { extrairDetalheBanco } from "@/lib/simulacao/detalhe-banco";
import {
  rendaMinimaPelosBancos,
  parcelaExigidaPeloBanco,
  rendaMinimaParaParcela,
} from "@/lib/simulacao/renda";
import { cn } from "@/lib/utils";

interface Props {
  simulacaoId: string;
  onFechar: () => void;
}

function totalFinanciado(b: any): number | null {
  const d = extrairDetalheBanco(b?.raw_response);
  return d?.financiamentoTotal ?? d?.valorFinanciamento ?? b?.valor_financiamento_max ?? null;
}

/** Renda estimada para um único banco: usa o retorno da API quando existir. */
function rendaMinimaDoBanco(b: any): number | null {
  const d = extrairDetalheBanco(b?.raw_response);
  if (d?.rendaMinimaExigida && d.rendaMinimaExigida > 0) return d.rendaMinimaExigida;
  const parcela = parcelaExigidaPeloBanco(b);
  if (!parcela) return null;
  return rendaMinimaParaParcela(parcela);
}

export function ResultadoInlineCompleta({ simulacaoId, onFechar }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [reenviandoBanco, setReenviandoBanco] = useState<string | null>(null);
  const [criandoBanco, setCriandoBanco] = useState<string | null>(null);
  const jaBaixou = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["simulacao", simulacaoId],
    queryFn: () => obterSimulacao({ data: { id: simulacaoId } }),
    refetchInterval: (query) => {
      const d = query.state.data as any;
      if (!d) return 3000;
      const simProc = ["enviando", "rascunho"].includes(d.simulacao?.status);
      const bcoProc = (d.bancos ?? []).some(
        (b: any) => b.status_banco === "aguardando" || b.status_banco === "enviando",
      );
      return simProc || bcoProc ? 5000 : false;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`sim-inline:${simulacaoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "simulacao_bancos",
          filter: `simulacao_id=eq.${simulacaoId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["simulacao", simulacaoId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [simulacaoId, qc]);

  // Download automático dos PDFs individuais (um por banco) assim que os
  // retornos chegam. Só dispara uma vez por simulação.
  useEffect(() => {
    if (jaBaixou.current || !data) return;
    const bancos = (data.bancos as any[]) ?? [];
    if (bancos.length === 0) return;
    const aindaProcessando = bancos.some(
      (b) => b.status_banco === "aguardando" || b.status_banco === "enviando",
    );
    if (aindaProcessando) return;
    const simulados = bancos.filter((b) => b.status_banco === "simulada");
    if (simulados.length === 0) return;
    jaBaixou.current = true;
    (async () => {
      try {
        const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
        for (const b of simulados) {
          baixarSimulacaoDetalhadaPDF({ simulacao: data.simulacao, bancos: [b] });
        }
        toast.success(
          `Simulação realizada. ${simulados.length} PDF${simulados.length === 1 ? "" : "s"} por banco baixado${simulados.length === 1 ? "" : "s"} automaticamente.`,
        );
      } catch {
        toast.error("Não foi possível baixar automaticamente os PDFs.");
      }
    })();
  }, [data]);

  async function reenviarBanco(bancoId: string) {
    setReenviandoBanco(bancoId);
    try {
      await enviarSimulacaoBanco({ data: { simulacao_id: simulacaoId, banco_ids: [bancoId] } });
      toast.success("Banco reenviado.");
      qc.invalidateQueries({ queryKey: ["simulacao", simulacaoId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reenviar.");
    } finally {
      setReenviandoBanco(null);
    }
  }

  async function enviarAprovacao(bancoId: string) {
    setCriandoBanco(bancoId);
    try {
      const { proposta_id } = await criarProposta({
        data: { simulacao_id: simulacaoId, banco_id: bancoId },
      });
      try {
        await enviarPropostaHomeFin({ data: { proposta_id, banco_id: bancoId } });
        toast.success("Proposta enviada ao banco.");
      } catch (envioErr) {
        toast.warning(
          envioErr instanceof Error
            ? `Proposta criada. Complete os dados para enviar: ${envioErr.message}`
            : "Proposta criada. Complete os dados para enviar ao banco.",
        );
      }
      router.navigate({
        to: "/operacional/propostas/$id",
        params: { id: proposta_id },
        search: { complementar: 1 },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar proposta.");
    } finally {
      setCriandoBanco(null);
    }
  }

  if (isLoading || !data) {
    return (
      <Card className="border-primary/20 bg-primary/[0.02] p-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Consultando bancos…
        </div>
      </Card>
    );
  }

  const s = data.simulacao as any;
  const bancos = ((data.bancos as any[]) ?? []);
  const bancosComTaxa = bancos
    .filter((b: any) => b.status_banco === "simulada" && b.valor_parcela != null)
    .sort((a: any, b: any) => (a.valor_parcela ?? 0) - (b.valor_parcela ?? 0));
  const rendaInformada =
    (Number(s.renda_total) || 0) + (s.compoe_renda ? Number(s.renda_conjuge) || 0 : 0);
  const rendaBancos = rendaMinimaPelosBancos(bancos, rendaInformada || null);
  const melhorId = bancosComTaxa.length > 1 ? bancosComTaxa[0]?.id : undefined;

  return (
    <Card className="overflow-hidden border-primary/30 shadow-lg ring-1 ring-primary/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-primary/10 via-card to-card px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
            Resultado — {s.numero_simulacao}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Prazo: <span className="font-medium text-foreground">{s.prazo} meses</span>
            {" · "}
            Financiamento:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatBRL(s.valor_financiamento)}
            </span>
            {" · "}
            Ajuste o prazo no formulário acima e clique em <em>Gerar Simulação</em> para
            comparar outro prazo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.navigate({
                to: "/operacional/simulacoes/$id",
                params: { id: simulacaoId },
              })
            }
          >
            <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir simulação detalhada
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onFechar}
            aria-label="Fechar resultado"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <Tabs defaultValue="bancos">
          <div className="overflow-x-auto">
            <TabsList className="w-max">
              <TabsTrigger value="bancos" className="shrink-0">Comparativo</TabsTrigger>
              <TabsTrigger value="dados" className="shrink-0">Dados enviados</TabsTrigger>
              <TabsTrigger value="historico" className="shrink-0">Histórico</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="bancos" className="mt-4">
            {bancos.length === 0 ? (
              <div className="rounded-lg border border-border py-8 text-center text-sm text-muted-foreground">
                Nenhum banco selecionado.
              </div>
            ) : (
              <>
                {/* Tira de KPIs */}
                <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 shadow-sm sm:grid-cols-3 lg:grid-cols-5">
                  <ResumoCelula rotulo="Valor do imóvel" valor={formatBRL(s.valor_imovel)} />
                  <ResumoCelula
                    rotulo="Valor financiado"
                    valor={formatBRL(s.valor_financiamento)}
                  />
                  {rendaBancos && (
                    <ResumoCelula
                      rotulo="Renda estimada"
                      valor={formatBRL(rendaBancos.rendaMinima)}
                      detalhe={rendaBancos.bancoNome ?? "maior retorno bancário"}
                      destaque
                    />
                  )}
                  <ResumoCelula
                    rotulo="Financiar despesas"
                    valor={s.fg_financiar_despesas ? "Sim" : "Não"}
                  />
                  {s.fg_financiar_despesas && (
                    <ResumoCelula
                      rotulo="Total financiado"
                      destaque
                      valor={formatBRL(
                        (Number(s.valor_financiamento) || 0) +
                          (Number(s.valor_despesas_financiadas) || 0),
                      )}
                    />
                  )}
                </div>

                {/* Mobile: cartões */}
                <div className="grid gap-3 lg:hidden">
                  {bancos.map((b: any) => (
                    <div key={b.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start gap-3">
                        <BancoLogo nome={b.nome_banco} size="lg" className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="truncate font-medium"
                              style={{ color: corDoBanco(b.nome_banco) }}
                            >
                              {b.nome_banco}
                            </span>
                            {b.id === melhorId && (
                              <ToneBadge tone="success">Melhor taxa</ToneBadge>
                            )}
                          </div>
                          <div className="mt-1">
                            <BancoStatusBadge status={b.status_banco} />
                          </div>
                        </div>
                      </div>

                      {b.status_banco === "erro" && b.mensagem_banco && (
                        <p className="mt-2 text-xs text-destructive">{b.mensagem_banco}</p>
                      )}

                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <MobileStat rotulo="Parcela" valor={formatBRL(b.valor_parcela)} />
                        <MobileStat
                          rotulo="Taxa a.a."
                          valor={
                            b.taxa_juros_ano != null
                              ? formatPercent(b.taxa_juros_ano / 100)
                              : "—"
                          }
                        />
                        <MobileStat
                          rotulo="Prazo máx"
                          valor={b.prazo_pagamento_max ? `${b.prazo_pagamento_max}m` : "—"}
                        />
                        <MobileStat
                          rotulo="Financ. máx"
                          valor={formatBRL(b.valor_financiamento_max)}
                        />
                        <MobileStat
                          rotulo="Total financiado"
                          valor={formatBRL(totalFinanciado(b))}
                        />
                        <MobileStat rotulo="IOF" valor={formatBRL(b.valor_iof)} />
                        <MobileStat
                          rotulo="Renda estimada"
                          valor={formatBRL(rendaMinimaDoBanco(b))}
                        />
                      </dl>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <DetalheBancoDialog banco={b} simulacao={s} />
                        {b.status_banco === "erro" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={reenviandoBanco !== null}
                            onClick={() => reenviarBanco(b.banco_id)}
                          >
                            <RefreshCw className="mr-1 h-4 w-4" />
                            {reenviandoBanco === b.banco_id ? "Reenviando…" : "Reenviar"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-to-b from-primary to-primary/90 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                            disabled={b.status_banco !== "simulada" || criandoBanco !== null}
                            onClick={() => enviarAprovacao(b.banco_id)}
                          >
                            <Send className="mr-1 h-4 w-4" />
                            {criandoBanco === b.banco_id ? "Enviando…" : "Enviar Aprovação"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: tabela */}
                <div className="hidden overflow-x-auto rounded-xl border border-border/60 shadow-sm lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Banco</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Situação</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parcela</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Taxa a.a.</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prazo máx</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financ. máx</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total financiado</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">IOF</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Renda estimada</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bancos.map((b: any) => (
                        <TableRow
                          key={b.id}
                          className={cn(
                            "border-border/50 transition-colors odd:bg-card even:bg-muted/20 hover:bg-primary/5",
                            b.id === melhorId &&
                              "bg-success/5 even:bg-success/5 hover:bg-success/10 [box-shadow:inset_3px_0_0_var(--success)]",
                          )}
                        >
                          <TableCell className="py-3 text-sm font-semibold">
                            <div className="flex items-center gap-2.5">
                              <BancoLogo nome={b.nome_banco} size="lg" />
                              <span style={{ color: corDoBanco(b.nome_banco) }}>
                                {b.nome_banco}
                              </span>
                              {b.id === melhorId && (
                                <ToneBadge tone="success">Melhor taxa</ToneBadge>
                              )}
                            </div>
                            {b.status_banco === "erro" && b.mensagem_banco && (
                              <p className="mt-1 text-xs text-destructive">{b.mensagem_banco}</p>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <BancoStatusBadge status={b.status_banco} />
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                            {formatBRL(b.valor_parcela)}
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                            {b.taxa_juros_ano != null ? formatPercent(b.taxa_juros_ano / 100) : "—"}
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                            {b.prazo_pagamento_max ? `${b.prazo_pagamento_max}m` : "—"}
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                            {formatBRL(b.valor_financiamento_max)}
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                            {formatBRL(totalFinanciado(b))}
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                            {formatBRL(b.valor_iof)}
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap text-primary">
                            {formatBRL(rendaMinimaDoBanco(b))}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <DetalheBancoDialog banco={b} simulacao={s} />
                              {b.status_banco === "erro" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={reenviandoBanco !== null}
                                  onClick={() => reenviarBanco(b.banco_id)}
                                >
                                  <RefreshCw className="mr-1 h-4 w-4" />
                                  {reenviandoBanco === b.banco_id ? "Reenviando…" : "Reenviar"}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-gradient-to-b from-primary to-primary/90 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                                  disabled={b.status_banco !== "simulada" || criandoBanco !== null}
                                  onClick={() => enviarAprovacao(b.banco_id)}
                                >
                                  <Send className="mr-1 h-4 w-4" />
                                  {criandoBanco === b.banco_id ? "Enviando…" : "Enviar Aprovação"}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {bancos.length > 0 && (
              <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">Importante:</strong> Isto é
                apenas uma simulação. A efetivação do resultado apresentado está condicionada
                à análise de sua proposta de financiamento. A taxa de juros apresentada na
                simulação é apenas para referência.
              </p>
            )}
          </TabsContent>

          <TabsContent value="dados" className="mt-4">
            <div className="grid gap-3 rounded-xl border border-border/60 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo termo="Valor do imóvel" desc={formatBRL(s.valor_imovel)} />
              <Campo termo="Entrada" desc={formatBRL(s.valor_entrada)} />
              <Campo termo="Valor financiado" desc={formatBRL(s.valor_financiamento)} />
              <Campo termo="Prazo" desc={s.prazo ? `${s.prazo} meses` : "—"} />
              <Campo termo="Sistema" desc={s.sistema_amortizacao === "P" ? "PRICE" : "SAC"} />
              <Campo termo="Utiliza FGTS" desc={s.utiliza_fgts === "S" ? "Sim" : "Não"} />
              <Campo termo="UF" desc={s.uf ?? "—"} />
              <Campo termo="Cliente" desc={s.nome_cliente ?? "—"} />
              <Campo
                termo="Financiar despesas"
                desc={s.fg_financiar_despesas ? formatBRL(s.valor_despesas_financiadas) : "Não"}
              />
            </div>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            {(data.historico ?? []).length === 0 ? (
              <p className="rounded-lg border border-border py-8 text-center text-sm text-muted-foreground">
                Nenhum evento registrado ainda.
              </p>
            ) : (
              <ol className="space-y-2 rounded-xl border border-border/60 p-4">
                {data.historico.map((h: any) => {
                  const dt = new Date(h.created_at);
                  return (
                    <li key={h.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{h.descricao}</p>
                        {h.ator_nome && (
                          <p className="text-xs text-muted-foreground">por {h.ator_nome}</p>
                        )}
                      </div>
                      <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {dt.toLocaleDateString("pt-BR")}{" · "}
                        {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </time>
                    </li>
                  );
                })}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}

function ResumoCelula({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative bg-card p-3.5 transition-colors",
        destaque && "bg-primary/5",
      )}
    >
      {destaque && (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />
      )}
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {rotulo}
      </dt>
      <dd
        className={cn(
          "mt-1.5 text-[15px] font-semibold tabular-nums",
          destaque ? "text-primary" : "text-foreground",
        )}
      >
        {valor}
      </dd>
      {detalhe && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function Campo({ termo, desc }: { termo: string; desc: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {termo}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{desc}</dd>
    </div>
  );
}

function MobileStat({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="truncate font-medium tabular-nums">{valor}</dd>
    </div>
  );
}

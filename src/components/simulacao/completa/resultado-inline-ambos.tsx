import { Fragment, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, X, Send, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { rendaMinimaDoBanco } from "@/lib/simulacao/renda";
import { cn } from "@/lib/utils";

interface Props {
  simulacaoIdSac: string | null;
  simulacaoIdPrice: string | null;
  onFechar: () => void;
}

function totalFinanciado(b: any): number | null {
  const d = extrairDetalheBanco(b?.raw_response);
  return d?.financiamentoTotal ?? d?.valorFinanciamento ?? b?.valor_financiamento_max ?? null;
}

function AmortizacaoTag({ sistema }: { sistema: "SAC" | "PRICE" }) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-[5px] border border-primary/25 bg-primary/[0.08] px-1.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-primary"
      title={`Tabela ${sistema}`}
      aria-label={`Tabela ${sistema}`}
    >
      {sistema}
    </span>
  );
}


async function baixarPdfLinha(simulacao: any, banco: any) {
  try {
    const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
    baixarSimulacaoDetalhadaPDF({ simulacao, bancos: [banco] });
  } catch (e) {
    console.error("[baixar PDF linha]", e);
    toast.error("Não foi possível gerar o PDF deste banco.");
  }
}

function useSimQuery(id: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["simulacao", id],
    enabled: !!id,
    queryFn: () => obterSimulacao({ data: { id: id! } }),
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
    if (!id) return;
    const ch = supabase
      .channel(`sim-inline-ambos:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "simulacao_bancos",
          filter: `simulacao_id=eq.${id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["simulacao", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);
  return q;
}

export function ResultadoInlineAmbos({ simulacaoIdSac, simulacaoIdPrice, onFechar }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [reenviandoBanco, setReenviandoBanco] = useState<string | null>(null);
  const [criandoBanco, setCriandoBanco] = useState<string | null>(null);
  const jaBaixou = useRef(false);

  const qSac = useSimQuery(simulacaoIdSac);
  const qPrice = useSimQuery(simulacaoIdPrice);

  const dataSac = qSac.data as any;
  const dataPrice = qPrice.data as any;

  // Auto-download de PDFs individuais quando ambos concluíram
  useEffect(() => {
    if (jaBaixou.current) return;
    const dataSet = [dataSac, dataPrice].filter(Boolean);
    if (dataSet.length === 0) return;
    // Exigimos que as ativas estejam prontas
    const ativas = [
      simulacaoIdSac ? dataSac : null,
      simulacaoIdPrice ? dataPrice : null,
    ].filter(Boolean) as any[];
    if (ativas.length < (simulacaoIdSac ? 1 : 0) + (simulacaoIdPrice ? 1 : 0)) return;

    const todosBancos = ativas.flatMap((d) => (d.bancos as any[]) ?? []);
    if (todosBancos.length === 0) return;
    const proc = todosBancos.some(
      (b) => b.status_banco === "aguardando" || b.status_banco === "enviando",
    );
    if (proc) return;
    const simulados = todosBancos.filter((b) => b.status_banco === "simulada");
    if (simulados.length === 0) return;
    jaBaixou.current = true;
    (async () => {
      let okCount = 0;
      let errCount = 0;
      try {
        const { baixarSimulacoesDetalhadasAgrupadasZipPDF } = await import("@/lib/simulacao/simulacao-pdf");
        okCount = await baixarSimulacoesDetalhadasAgrupadasZipPDF(
          ativas.map((d) => ({
            simulacao: d.simulacao,
            bancos: ((d.bancos as any[]) ?? []).filter((b) => b.status_banco === "simulada"),
          })),
        );
      } catch (err) {
        console.error("[auto-download PDF] falha ao carregar módulo", err);
      }
      if (okCount > 0) {
        toast.success(
          `Simulação realizada. ${okCount} PDF${okCount === 1 ? "" : "s"} liberado${okCount === 1 ? "" : "s"} para download.` +
            (errCount > 0 ? ` (${errCount} com falha — use o botão Baixar PDFs)` : ""),
        );
      } else if (errCount > 0) {
        toast.warning("Alguns PDFs não puderam ser baixados automaticamente. Use o botão Baixar PDFs.");
      }
    })();
  }, [dataSac, dataPrice, simulacaoIdSac, simulacaoIdPrice]);

  async function reenviarBanco(simId: string, bancoId: string) {
    setReenviandoBanco(bancoId);
    try {
      await enviarSimulacaoBanco({ data: { simulacao_id: simId, banco_ids: [bancoId] } });
      toast.success("Banco reenviado.");
      qc.invalidateQueries({ queryKey: ["simulacao", simId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reenviar.");
    } finally {
      setReenviandoBanco(null);
    }
  }

  async function enviarAprovacao(simId: string, bancoId: string) {
    setCriandoBanco(bancoId);
    try {
      const { proposta_id } = await criarProposta({
        data: { simulacao_id: simId, banco_id: bancoId },
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

  const carregando = (simulacaoIdSac && !dataSac) || (simulacaoIdPrice && !dataPrice);
  if (carregando) {
    return (
      <Card className="border-primary/20 bg-primary/[0.02] p-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Consultando bancos…
        </div>
      </Card>
    );
  }

  type Linha = {
    sistema: "SAC" | "PRICE";
    simId: string;
    simulacao: any;
    banco: any;
  };
  const linhas: Linha[] = [];
  if (dataSac) {
    for (const b of (dataSac.bancos as any[]) ?? []) {
      linhas.push({ sistema: "SAC", simId: dataSac.simulacao.id, simulacao: dataSac.simulacao, banco: b });
    }
  }
  if (dataPrice) {
    for (const b of (dataPrice.bancos as any[]) ?? []) {
      linhas.push({ sistema: "PRICE", simId: dataPrice.simulacao.id, simulacao: dataPrice.simulacao, banco: b });
    }
  }

  // Ordena por sistema depois por parcela crescente
  linhas.sort((a, b) => {
    if (a.sistema !== b.sistema) return a.sistema === "SAC" ? -1 : 1;
    return (a.banco.valor_parcela ?? Number.POSITIVE_INFINITY) - (b.banco.valor_parcela ?? Number.POSITIVE_INFINITY);
  });

  const melhorPorSistema: Record<string, string | undefined> = {};
  for (const sis of ["SAC", "PRICE"] as const) {
    const cand = linhas
      .filter((l) => l.sistema === sis && l.banco.status_banco === "simulada" && l.banco.valor_parcela != null)
      .sort((a, b) => (a.banco.valor_parcela ?? 0) - (b.banco.valor_parcela ?? 0));
    if (cand.length > 1) melhorPorSistema[sis] = cand[0].banco.id;
  }

  const ref = dataSac?.simulacao ?? dataPrice?.simulacao;
  const numeros = [dataSac?.simulacao?.numero_simulacao, dataPrice?.simulacao?.numero_simulacao]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="overflow-hidden border-primary/30 shadow-lg ring-1 ring-primary/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-primary/10 via-card to-card px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
              Resultado — {numeros}
            </h2>
            <ToneBadge tone="info">Simulação mista · SAC + PRICE</ToneBadge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Prazo: <span className="font-medium text-foreground">{ref?.prazo} meses</span>
            {" · "}
            Financiamento:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatBRL(ref?.valor_financiamento)}
            </span>
            {" · "}
            Comparativo dos dois sistemas de amortização lado a lado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BaixarPdfsButton dataSac={dataSac} dataPrice={dataPrice} />
          {dataSac && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.navigate({
                  to: "/operacional/simulacoes/$id",
                  params: { id: dataSac.simulacao.id },
                })
              }
            >
              <ExternalLink className="mr-1.5 h-4 w-4" /> SAC detalhada
            </Button>
          )}
          {dataPrice && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.navigate({
                  to: "/operacional/simulacoes/$id",
                  params: { id: dataPrice.simulacao.id },
                })
              }
            >
              <ExternalLink className="mr-1.5 h-4 w-4" /> PRICE detalhada
            </Button>
          )}
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
        {linhas.length === 0 ? (
          <div className="rounded-lg border border-border py-8 text-center text-sm text-muted-foreground">
            Nenhum banco selecionado.
          </div>
        ) : (
          <>
            {/* Mobile: cartões */}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:hidden">
              {linhas.map((l, idx) => {
                const b = l.banco;
                const isMelhor = melhorPorSistema[l.sistema] === b.id;
                const primeiroDoGrupo = idx === 0 || linhas[idx - 1].sistema !== l.sistema;
                return (
                  <div key={`${l.sistema}-${b.id}`}>
                    {primeiroDoGrupo && (
                      <div className="mb-2 flex items-center gap-2">
                        <AmortizacaoTag sistema={l.sistema} />
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <div className="rounded-lg border border-border p-4">
                      <div className="flex items-start gap-3">
                        <BancoLogo nome={b.nome_banco} size="lg" className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <AmortizacaoTag sistema={l.sistema} />

                            <span
                              className="truncate font-medium"
                              style={{ color: corDoBanco(b.nome_banco) }}
                            >
                              {b.nome_banco}
                            </span>
                            {isMelhor && <ToneBadge tone="success">Melhor taxa</ToneBadge>}
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
                          valor={b.taxa_juros_ano != null ? formatPercent(b.taxa_juros_ano / 100) : "—"}
                        />
                        <MobileStat
                          rotulo="Prazo máx"
                          valor={b.prazo_pagamento_max ? `${b.prazo_pagamento_max}m` : "—"}
                        />
                        <MobileStat rotulo="Financ. máx" valor={formatBRL(b.valor_financiamento_max)} />
                        <MobileStat rotulo="Total financiado" valor={formatBRL(totalFinanciado(b))} />
                        <MobileStat rotulo="IOF" valor={formatBRL(b.valor_iof)} />
                        <MobileStat rotulo="Renda estimada" valor={formatBRL(rendaMinimaDoBanco(b))} />
                      </dl>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <DetalheBancoDialog banco={b} simulacao={l.simulacao} />
                        {b.status_banco === "simulada" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => baixarPdfLinha(l.simulacao, b)}
                            title="Baixar PDF deste banco"
                          >
                            <Download className="mr-1 h-4 w-4" /> PDF
                          </Button>
                        )}
                        {b.status_banco === "erro" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={reenviandoBanco !== null}
                            onClick={() => reenviarBanco(l.simId, b.banco_id)}
                          >
                            <RefreshCw className="mr-1 h-4 w-4" />
                            {reenviandoBanco === b.banco_id ? "Reenviando…" : "Reenviar"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-to-b from-primary to-primary/90 shadow-sm"
                            disabled={b.status_banco !== "simulada" || criandoBanco !== null}
                            onClick={() => enviarAprovacao(l.simId, b.banco_id)}
                          >
                            <Send className="mr-1 h-4 w-4" />
                            {criandoBanco === b.banco_id ? "Enviando…" : "Enviar Aprovação"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: tabela unificada */}
            <div className="hidden rounded-xl border border-border/60 shadow-sm lg:block">
              <Table className="w-full table-fixed text-[13px]">
                <TableHeader>
                  <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[22%] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Banco</TableHead>
                    <TableHead className="w-[9%] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Situação</TableHead>
                    <TableHead className="w-[11%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parcela</TableHead>
                    <TableHead className="w-[7%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Taxa</TableHead>
                    <TableHead className="w-[7%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prazo</TableHead>
                    <TableHead className="w-[12%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financiado</TableHead>
                    <TableHead className="w-[9%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">IOF</TableHead>
                    <TableHead className="w-[11%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Renda est.</TableHead>
                    <TableHead className="w-[12%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l, idx) => {
                    const b = l.banco;
                    const isMelhor = melhorPorSistema[l.sistema] === b.id;
                    const primeiroDoGrupo = idx === 0 || linhas[idx - 1].sistema !== l.sistema;
                    return (
                      <Fragment key={`${l.sistema}-${b.id}`}>
                        {primeiroDoGrupo && (
                          <TableRow
                            key={`hdr-${l.sistema}`}
                            className="border-border/60 bg-muted/40 hover:bg-muted/40"
                          >
                            <TableCell colSpan={9} className="py-2">
                              <div className="flex items-center gap-2">
                                <AmortizacaoTag sistema={l.sistema} />
                                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                  {l.sistema === "SAC"
                                    ? "Amortização constante · parcelas decrescentes"
                                    : "Parcelas fixas · juros compostos"}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      <TableRow
                        key={`${l.sistema}-${b.id}`}
                        className={cn(
                          "border-border/50 transition-colors odd:bg-card even:bg-muted/20 hover:bg-primary/5",
                          isMelhor && "bg-success/5 even:bg-success/5 hover:bg-success/10 [box-shadow:inset_3px_0_0_var(--success)]",
                        )}
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <BancoLogo nome={b.nome_banco} size="md" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <AmortizacaoTag sistema={l.sistema} />

                                <span className="truncate text-sm font-semibold" style={{ color: corDoBanco(b.nome_banco) }}>{b.nome_banco}</span>
                              </div>

                              {isMelhor && <ToneBadge tone="success">Melhor taxa</ToneBadge>}
                              {b.status_banco === "erro" && b.mensagem_banco && (
                                <p className="mt-0.5 line-clamp-1 text-[11px] text-destructive">{b.mensagem_banco}</p>
                              )}
                            </div>
                          </div>
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
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <DetalheBancoDialog banco={b} simulacao={l.simulacao} />
                            {b.status_banco === "simulada" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => baixarPdfLinha(l.simulacao, b)}
                                title="Baixar PDF deste banco"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {b.status_banco === "erro" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={reenviandoBanco !== null}
                                onClick={() => reenviarBanco(l.simId, b.banco_id)}
                              >
                                <RefreshCw className="mr-1 h-4 w-4" />
                                {reenviandoBanco === b.banco_id ? "…" : "Reenviar"}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="bg-gradient-to-b from-primary to-primary/90 shadow-sm"
                                disabled={b.status_banco !== "simulada" || criandoBanco !== null}
                                onClick={() => enviarAprovacao(l.simId, b.banco_id)}
                              >
                                <Send className="mr-1 h-4 w-4" />
                                {criandoBanco === b.banco_id ? "…" : "Enviar"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">Importante:</strong> Isto é apenas
              uma simulação. A efetivação está condicionada à análise da proposta pelo banco. As
              taxas são apenas referência.
            </p>
          </>
        )}
      </div>
    </Card>
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

function BaixarPdfsButton({ dataSac, dataPrice }: { dataSac: any; dataPrice: any }) {
  const [baixando, setBaixando] = useState(false);
  const ativos = [dataSac, dataPrice].filter(Boolean) as any[];
  const totalOk = ativos.reduce(
    (acc, d) => acc + ((d.bancos as any[]) ?? []).filter((b) => b.status_banco === "simulada").length,
    0,
  );
  const desabilitado = totalOk === 0 || baixando;

  async function baixar() {
    if (desabilitado) return;
    setBaixando(true);
    let ok = 0;
    let err = 0;
    try {
      const { baixarSimulacoesDetalhadasAgrupadasZipPDF } = await import("@/lib/simulacao/simulacao-pdf");
      ok = await baixarSimulacoesDetalhadasAgrupadasZipPDF(
        ativos.map((d) => ({
          simulacao: d.simulacao,
          bancos: ((d.bancos as any[]) ?? []).filter((b) => b.status_banco === "simulada"),
        })),
      );
      if (ok > 0) toast.success(`${ok} PDF${ok === 1 ? "" : "s"} gerado${ok === 1 ? "" : "s"}.${err > 0 ? ` (${err} falharam)` : ""}`);
      else toast.error("Não foi possível gerar os PDFs.");
    } catch (e) {
      console.error("[baixar PDF] módulo", e);
      const msg = e instanceof Error ? e.message : "";
      toast.error(msg ? `Não foi possível gerar os PDFs: ${msg}` : "Não foi possível gerar os PDFs.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={baixar} disabled={desabilitado}>
      <Download className="mr-1.5 h-4 w-4" />
      {baixando ? "Gerando…" : `Baixar PDFs${totalOk > 0 ? ` (${totalOk})` : ""}`}
    </Button>
  );
}

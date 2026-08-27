import { useEffect, useRef, useState, useCallback, useMemo, Fragment } from "react";
import { temBancoAguardando, useReconciliacaoAutomatica } from "@/lib/simulacao/reconciliar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, X, Download, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useEnviarProposta } from "@/hooks/use-enviar-proposta";
import { Card } from "@/components/ui/card";
import { criarProposta, enviarPropostaHomeFin } from "@/lib/propostas/propostas.functions";
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
import { obterSimulacao, enviarSimulacaoBanco } from "@/lib/simulacao/simulacoes.functions";
// Import já realizado no topo
import { formatBRL, formatPercent, formatTaxa } from "@/lib/simulacao/format";
import { corDoBanco } from "@/lib/bancos/cores";

import { rendaMinimaPelosBancos, rendaMinimaDoBanco } from "@/lib/simulacao/renda";
import { cn } from "@/lib/utils";
import { ErroBancoDetalhe } from "@/components/simulacao/erro-banco-detalhe";
import { totalFinanciadoBanco } from "@/lib/simulacao/origem-dados";
/**
 * Só exibimos o que a IF realmente devolveu. Quando o retorno não traz o
 * campo, mostramos "—" — nunca o valor SOLICITADO na operação
 * (ver src/lib/simulacao/origem-dados.ts).
 */
const totalBancoTexto = (b: any) => {
  const v = totalFinanciadoBanco(b);
  return v == null ? "—" : formatBRL(v);
};

interface Props {
  simulacaoId: string;
  onFechar: () => void;
  isSecundaria?: boolean;
}

export function ResultadoInlineCompleta({ simulacaoId, onFechar, isSecundaria }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [reenviandoBanco, setReenviandoBanco] = useState<string | null>(null);
  const [criandoBanco, setCriandoBanco] = useState<string | null>(null);
  const {
    enviar: handleEnviarHook,
    busy: enviandoBanco,
    busyBancoId,
    iniciarStatus: iniciarStatusEnvio,
  } = useEnviarProposta();

  const enviarPropostaFn = useServerFn(enviarPropostaHomeFin);
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

  // Santander responde depois do POST da integração. Enquanto houver banco
  // aguardando, esta tela pede a reconciliação — sem isso o resultado só
  // apareceria se alguém enviasse outra simulação.
  useReconciliacaoAutomatica(temBancoAguardando(data));

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

  // Remoção do download automático conforme solicitado.
  // O PDF deve ser gerado apenas no clique manual.
  useEffect(() => {
    if (jaBaixou.current || !data) return;
    const bancos = (data.bancos as any[]) ?? [];
    if (bancos.length === 0) return;
    const aindaProcessando = bancos.some(
      (b) => b.status_banco === "aguardando" || b.status_banco === "enviando",
    );
    if (aindaProcessando) return;
    jaBaixou.current = true;
    // Não executa download automático.
  }, [data]);

  async function reenviarBanco(bancoId: string, banco: any) {
    if (banco.status_banco === "simulada") {
      toast.info("Este banco já possui uma simulação concluída.");
      return;
    }

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
    if (criandoBanco) return;

    // 1. Inicia feedback visual imediato no hook (Etapa 1: Criando)
    iniciarStatusEnvio(bancoId);
    setCriandoBanco(bancoId);

    try {
      // 2. Chama o hook que agora sabe gerenciar a criação e status
      const res = await handleEnviarHook({
        bancoId,
        criarPropostaFn: async () => {
          const { proposta_id } = await criarProposta({
            data: {
              simulacao_id: simulacaoId,
              banco_id: bancoId,
            },
          });
          return { proposta_id };
        },
      });

      if (res?.proposta_id) {
        if (!router.state.location.pathname.includes(`/propostas/${res.proposta_id}`)) {
          router.navigate({
            to: "/operacional/propostas/$id",
            params: { id: res.proposta_id },
          });
        }
      }
    } catch (e) {
      // Erros gerenciados pelo hook
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
  const bancos = (data.bancos as any[]) ?? [];
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
            Ajuste o prazo no formulário acima e clique em <em>Gerar Simulação</em> para comparar
            outro prazo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BaixarPdfsButton data={data} />
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
              <TabsTrigger value="bancos" className="shrink-0">
                Comparativo
              </TabsTrigger>
              <TabsTrigger value="dados" className="shrink-0">
                Dados enviados
              </TabsTrigger>
              <TabsTrigger value="historico" className="shrink-0">
                Histórico
              </TabsTrigger>
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
                  {isSecundaria ? (
                    <ResumoCelula
                      rotulo="Comparativo de Taxas"
                      valor="Perfil Secundário"
                      detalhe="Teste de CPF Invertido"
                      destaque
                    />
                  ) : (
                    <ResumoCelula
                      rotulo="Financiar despesas"
                      valor={s.fg_financiar_despesas ? "Sim" : "Não"}
                    />
                  )}
                  {s.fg_financiar_despesas && !isSecundaria && (
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
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:hidden">
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
                            {b.id === melhorId && <ToneBadge tone="success">Melhor taxa</ToneBadge>}
                          </div>
                          <div className="mt-1">
                            <BancoStatusBadge status={b.status_banco} />
                          </div>
                        </div>
                      </div>

                      {b.status_banco === "erro" && b.mensagem_banco && (
                        <div className="mt-2">
                          <ErroBancoDetalhe
                            mensagem={b.mensagem_banco}
                            rendaEstimada={rendaMinimaDoBanco(b)}
                            nomeBanco={b.nome_banco}
                          />
                        </div>
                      )}

                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <MobileStat rotulo="Parcela" valor={formatBRL(b.valor_parcela)} />
                        <MobileStat
                          rotulo="Taxa a.a."
                          valor={b.taxa_juros_ano != null ? formatTaxa(b.taxa_juros_ano) : "—"}
                        />
                        <MobileStat
                          rotulo="Prazo"
                          valor={
                            b.prazo_pagamento_max != null
                              ? `${b.prazo_pagamento_max}m`
                              : b.prazo != null
                                ? `${b.prazo}m`
                                : s.prazo != null
                                  ? `${s.prazo}m`
                                  : "—"
                          }
                        />
                        <MobileStat rotulo="Total fin. (banco)" valor={totalBancoTexto(b)} />
                        <MobileStat
                          rotulo="IOF (banco)"
                          valor={b.valor_iof != null ? formatBRL(b.valor_iof) : "—"}
                        />

                        <MobileStat
                          rotulo="Renda estimada"
                          valor={formatBRL(rendaMinimaDoBanco(b))}
                        />
                      </dl>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <DetalheBancoDialog banco={b} simulacao={s} />
                        {b.status_banco === "simulada" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const { baixarSimulacaoDetalhadaPDF } =
                                  await import("@/lib/simulacao/simulacao-pdf");
                                baixarSimulacaoDetalhadaPDF({ simulacao: s, bancos: [b] });
                              } catch (e) {
                                console.error(e);
                                toast.error("Não foi possível gerar o PDF.");
                              }
                            }}
                            title="Baixar PDF deste banco"
                          >
                            <Download className="mr-1 h-4 w-4" /> PDF
                          </Button>
                        )}
                        {b.status_banco === "erro" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={reenviandoBanco !== null || b.status_banco === "simulada"}

                            onClick={() => reenviarBanco(b.banco_id, b)}

                          >
                            <RefreshCw className="mr-1 h-4 w-4" />
                            {reenviandoBanco === b.banco_id ? "Reenviando…" : "Reenviar"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-to-b from-primary to-primary/90 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                            disabled={
                              b.status_banco !== "simulada" ||
                              criandoBanco !== null ||
                              enviandoBanco
                            }
                            onClick={() => enviarAprovacao(b.banco_id)}
                          >
                            {criandoBanco === b.banco_id ||
                            (enviandoBanco && busyBancoId === b.banco_id) ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="mr-1 h-4 w-4" />
                            )}
                            {criandoBanco === b.banco_id ||
                            (enviandoBanco && busyBancoId === b.banco_id)
                              ? "Enviando…"
                              : "Enviar Aprovação"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: tabela */}
                <div className="hidden overflow-hidden rounded-xl border border-border/60 shadow-sm lg:block">
                  <Table className="w-full table-auto text-xs">
                    <TableHeader>
                      <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
                        <TableHead className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Banco
                        </TableHead>
                        <TableHead className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Situação
                        </TableHead>
                        <TableHead className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Parcela
                        </TableHead>
                        <TableHead className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Taxa a.a.
                        </TableHead>
                        <TableHead className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Prazo
                        </TableHead>
                        <TableHead className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Total fin. (banco)
                        </TableHead>
                        <TableHead className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          IOF (banco)
                        </TableHead>

                        <TableHead className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Renda est.
                        </TableHead>
                        <TableHead className="px-2 py-2"></TableHead>
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
                          <TableCell className="px-2 py-2 text-xs font-semibold">
                            <div className="flex items-center gap-1.5">
                              <BancoLogo nome={b.nome_banco} size="sm" />
                              <span
                                className="truncate"
                                style={{ color: corDoBanco(b.nome_banco) }}
                              >
                                {b.nome_banco}
                              </span>
                              {b.id === melhorId && (
                                <ToneBadge tone="success" className="hidden xl:inline-flex">
                                  Melhor
                                </ToneBadge>
                              )}
                            </div>
                            {b.status_banco === "erro" && b.mensagem_banco && (
                              <div className="mt-1">
                                <ErroBancoDetalhe
                                  mensagem={b.mensagem_banco}
                                  rendaEstimada={rendaMinimaDoBanco(b)}
                                  nomeBanco={b.nome_banco}
                                  linhas={1}
                                  className="text-[10px]"
                                />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <BancoStatusBadge status={b.status_banco} />
                          </TableCell>
                          <TableCell className="px-2 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                            {formatBRL(b.valor_parcela)}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                            {b.taxa_juros_ano != null ? formatTaxa(b.taxa_juros_ano) : "—"}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                            {b.prazo_pagamento_max ?? b.prazo ?? s.prazo ?? "—"}
                            {b.prazo_pagamento_max || b.prazo || s.prazo ? "m" : ""}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                            {totalBancoTexto(b)}
                          </TableCell>

                          <TableCell className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                            {b.valor_iof != null ? formatBRL(b.valor_iof) : "—"}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-right font-semibold tabular-nums whitespace-nowrap text-primary">
                            {formatBRL(rendaMinimaDoBanco(b))}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <DetalheBancoDialog banco={b} simulacao={s} />
                              {b.status_banco === "simulada" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  title="Baixar PDF deste banco"
                                  aria-label="Baixar PDF deste banco"
                                  onClick={async () => {
                                    try {
                                      const { baixarSimulacaoDetalhadaPDF } =
                                        await import("@/lib/simulacao/simulacao-pdf");
                                      baixarSimulacaoDetalhadaPDF({ simulacao: s, bancos: [b] });
                                    } catch (e) {
                                      console.error(e);
                                      toast.error("Não foi possível gerar o PDF.");
                                    }
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              {b.status_banco === "erro" ? (
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="h-8 w-8"
                                  title={
                                    reenviandoBanco === b.banco_id ? "Reenviando…" : "Reenviar"
                                  }
                                  aria-label="Reenviar"
                                  disabled={reenviandoBanco !== null}
                                  onClick={() => reenviarBanco(b.banco_id, b)}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  className="h-8 w-8 bg-gradient-to-b from-primary to-primary/90 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                                  title={
                                    criandoBanco === b.banco_id ? "Enviando…" : "Enviar aprovação"
                                  }
                                  aria-label="Enviar aprovação"
                                  disabled={b.status_banco !== "simulada" || criandoBanco !== null}
                                  onClick={() => enviarAprovacao(b.banco_id)}
                                >
                                  <Send className="h-4 w-4" />
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
                <strong className="font-medium text-foreground">Importante:</strong> Isto é apenas
                uma simulação. A efetivação do resultado apresentado está condicionada à análise de
                sua proposta de financiamento. A taxa de juros apresentada na simulação é apenas
                para referência.
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
                        {dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        {" · "}
                        {dt.toLocaleTimeString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
    <div className={cn("relative bg-card p-3.5 transition-colors", destaque && "bg-primary/5")}>
      {destaque && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
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

function BaixarPdfsButton({ data }: { data: any }) {
  const [baixando, setBaixando] = useState(false);
  const bancosOk = ((data?.bancos as any[]) ?? []).filter((b) => b.status_banco === "simulada");
  const totalOk = bancosOk.length;
  const desabilitado = totalOk === 0 || baixando;

  async function baixar() {
    if (desabilitado) return;
    setBaixando(true);
    try {
      const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
      await baixarSimulacaoDetalhadaPDF({ simulacao: data.simulacao, bancos: bancosOk });
      toast.success(`${totalOk} PDF${totalOk === 1 ? "" : "s"} gerado${totalOk === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Não foi possível gerar os PDFs.");
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

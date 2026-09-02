import { Fragment, useEffect, useState, useRef } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, X, Send, Download, Loader2 } from "lucide-react";
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
import { obterSimulacao, enviarSimulacaoBanco } from "@/lib/simulacao/simulacoes.functions";
import { criarProposta } from "@/lib/propostas/propostas.functions";
import { useEnviarProposta } from "@/hooks/use-enviar-proposta";
import { formatBRL, formatPercent, formatTaxa } from "@/lib/simulacao/format";
import { corDoBanco } from "@/lib/bancos/cores";
import { extrairDetalheBanco } from "@/lib/simulacao/detalhe-banco";
import { rendaMinimaDoBanco } from "@/lib/simulacao/renda";
import { cn } from "@/lib/utils";
import { ErroBancoDetalhe } from "@/components/simulacao/erro-banco-detalhe";
import { totalFinanciadoBanco } from "@/lib/simulacao/origem-dados";
import { pedirReconciliacao, temBancoAguardando } from "@/lib/simulacao/reconciliar";
import { ResumoPerformanceSimulacao } from "./resumo-performance";

/**
 * Só exibimos o que a IF realmente devolveu; sem retorno, mostramos "—"
 * (nunca o valor SOLICITADO — ver src/lib/simulacao/origem-dados.ts).
 */
const totalBancoTexto = (b: any) => {
  const v = totalFinanciadoBanco(b);
  return v == null ? "—" : formatBRL(v);
};

interface Props {
  simulacaoIdSac: string | null;
  simulacaoIdPrice: string | null;
  /**
   * Simulações do teste automático de CPFs. Vêm explicitamente do envio para
   * que o resultado não dependa do agrupador — se o vínculo falhar, as
   * simulações dos outros proponentes ainda aparecem.
   */
  idsExtras?: string[];
  onFechar: () => void;
}

function bancosDaSimulacaoAtual(data: any): any[] {
  const lista = (data?.bancos as any[]) ?? [];
  const simId = data?.simulacao?.id;
  if (!simId || lista.length <= 1) return lista;
  const simIds = new Set(lista.map((b) => b?.simulacao_id).filter(Boolean));
  if (simIds.size <= 1 || !simIds.has(simId)) return lista;
  return lista.filter((b) => b?.simulacao_id === simId);
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

export function ResultadoInlineAmbos({ simulacaoIdSac, simulacaoIdPrice, idsExtras = [], onFechar }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [reenviandoBanco, setReenviandoBanco] = useState<string | null>(null);
  const [reenviandoLote, setReenviandoLote] = useState(false);
  const [criandoBanco, setCriandoBanco] = useState<string | null>(null);
  const {
    enviar: handleEnviarHook,
    busy: enviandoBanco,
    busyBancoId,
    iniciarStatus: iniciarStatusEnvio,
  } = useEnviarProposta();

  const jaBaixou = useRef(false);

  const qSac = useSimQuery(simulacaoIdSac);
  const qPrice = useSimQuery(simulacaoIdPrice);

  const dataSac = qSac.data as any;
  const dataPrice = qPrice.data as any;

  // Bancos assíncronos (Santander) respondem depois do POST. Enquanto algum
  // estiver aguardando, pedimos a reconciliação no mesmo ritmo do polling —
  // sem isso a simulação fica presa em "aguardando" indefinidamente.
  const aguardandoRetorno = temBancoAguardando(dataSac) || temBancoAguardando(dataPrice);
  useEffect(() => {
    if (!aguardandoRetorno) return;
    void pedirReconciliacao();
    const t = setInterval(() => void pedirReconciliacao(), 12000);
    return () => clearInterval(t);
  }, [aguardandoRetorno]);

  // Consulta as simulações dos CPFs testados que ainda não vieram pelo grupo.
  const idsJaCarregados = new Set(
    [
      ...((dataSac?.bancos as any[]) ?? []),
      ...((dataPrice?.bancos as any[]) ?? []),
    ].map((b: any) => b.simulacao_id),
  );
  const idsFaltantes = idsExtras.filter((id) => id && !idsJaCarregados.has(id));
  const consultasExtras = useQueries({
    queries: idsFaltantes.map((id) => ({
      queryKey: ["simulacao", id],
      queryFn: () => obterSimulacao({ data: { id } }),
    })),
  });

  async function reenviarBanco(simId: string, bancoId: string, simulacaoBancoId: string, banco: any) {
    if (banco.status_banco === "simulada") {
      toast.info("Este banco já possui uma simulação concluída.");
      return;
    }
    setReenviandoBanco(simulacaoBancoId);
    try {
      // REGRA DE REENVIO: O reenvio deve ser feito por simulacao_banco_id para não afetar o grupo todo
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
    if (criandoBanco) return;

    // 1. Inicia feedback visual imediato no hook (Etapa 1: Criando)
    iniciarStatusEnvio(bancoId);
    setCriandoBanco(bancoId);

    // A proposta é criada antes da validação do cadastro, então ela existe
    // mesmo quando o envio não vai adiante. Guardamos o id fora do retorno do
    // hook para não deixar a tela parada com uma proposta órfã.
    let propostaCriadaId: string | undefined;

    const irParaProposta = (id: string, complementar: boolean) => {
      if (router.state.location.pathname.includes(`/propostas/${id}`)) return;
      router.navigate({
        to: "/operacional/propostas/$id",
        params: { id },
        ...(complementar ? { search: { complementar: 1 } } : {}),
      });
    };

    try {
      // 2. Chama o hook centralizado
      const res = await handleEnviarHook({
        bancoId,
        criarPropostaFn: async () => {
          const { proposta_id } = await criarProposta({
            data: {
              simulacao_id: simId,
              banco_id: bancoId,
            },
          });
          propostaCriadaId = proposta_id;
          return { proposta_id };
        },
      });

      const propostaId = (res as any)?.proposta_id ?? propostaCriadaId;
      if (!propostaId) return;

      if ((res as any)?.cadastro_incompleto) {
        toast.info("Complete o cadastro do participante para enviar ao banco.");
        irParaProposta(propostaId, true);
        return;
      }

      irParaProposta(propostaId, false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar ao banco.");
      if (propostaCriadaId) irParaProposta(propostaCriadaId, false);
    } finally {
      setCriandoBanco(null);
    }
  }

  // Remoção do download automático para modo Ambos conforme solicitado.
  useEffect(() => {
    if (jaBaixou.current || (!dataSac && !dataPrice)) return;
    const bancosSac = bancosDaSimulacaoAtual(dataSac);
    const bancosPrice = bancosDaSimulacaoAtual(dataPrice);
    const todosBancos = [...bancosSac, ...bancosPrice];
    if (todosBancos.length === 0) return;
    const processando = todosBancos.some(
      (b) => b.status_banco === "aguardando" || b.status_banco === "enviando",
    );
    if (processando) return;
    jaBaixou.current = true;
    // Não executa download automático.
  }, [dataSac, dataPrice]);

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
    prazo: number;
    simId: string;
    simulacao: any;
    banco: any;
    /** Quem figura como titular nesta linha (teste automático de CPFs). */
    titularNome: string;
    titularPrincipal: boolean;
  };
  const todasIrmas = [...(dataSac?.simulacao?._irmas ?? []), ...(dataPrice?.simulacao?._irmas ?? [])];
  const simIdsProcessados = new Set<string>();

  const processarSimulacao = (data: any) => {
    if (!data) return;
    const irmas = (data.simulacao?._irmas || [data.simulacao]);
    
    for (const s of irmas) {
      if (simIdsProcessados.has(s.id)) continue;
      simIdsProcessados.add(s.id);

      const bancosSim = (data.bancos || []).filter((b: any) => b.simulacao_id === s.id);
      for (const b of bancosSim) {
        linhas.push({
          sistema: b._sistema as "SAC" | "PRICE",
          prazo: b._prazo,
          simId: s.id,
          simulacao: s,
          banco: b,
          titularNome: b._titularNome ?? s.nome_cliente ?? "",
          titularPrincipal: b._ehTitularPrincipal !== false,
        });
      }
    }
  };

  const linhas: Linha[] = [];
  processarSimulacao(dataSac);
  processarSimulacao(dataPrice);
  for (const c of consultasExtras) processarSimulacao(c.data as any);

  // Teste de CPF: o titular original vem primeiro, depois cada proponente
  // testado. Dentro de cada um, ordena por prazo, sistema e parcela.
  linhas.sort((a, b) => {
    if (a.titularPrincipal !== b.titularPrincipal) return a.titularPrincipal ? -1 : 1;
    const na = (a.titularNome || "").trim().toLowerCase();
    const nb = (b.titularNome || "").trim().toLowerCase();
    if (na !== nb) return na.localeCompare(nb);
    if (a.prazo !== b.prazo) return b.prazo - a.prazo;
    if (a.sistema !== b.sistema) return a.sistema === "SAC" ? -1 : 1;
    return (
      (a.banco.valor_parcela ?? Number.POSITIVE_INFINITY) -
      (b.banco.valor_parcela ?? Number.POSITIVE_INFINITY)
    );
  });

  /** Identidade da seção de um proponente, imune a caixa e espaços. */
  const chaveTitular = (l: Linha) =>
    `${l.titularPrincipal ? 0 : 1}|${(l.titularNome || "").trim().toLowerCase()}`;

  // Só rotula por proponente quando houve teste de CPF — com um titular só,
  // o cabeçalho seria ruído.
  const variosTitulares =
    new Set(linhas.map((l) => (l.titularNome || "").trim().toLowerCase())).size > 1;

  /** Bancos sem retorno, agrupados por simulação — base do reenvio em lote. */
  const pendentesPorSim = new Map<string, { bancoIds: string[]; linhaIds: string[] }>();
  for (const l of linhas) {
    if (l.banco.status_banco === "simulada") continue;
    const atual = pendentesPorSim.get(l.simId) ?? { bancoIds: [], linhaIds: [] };
    if (!atual.bancoIds.includes(l.banco.banco_id)) atual.bancoIds.push(l.banco.banco_id);
    atual.linhaIds.push(l.banco.id);
    pendentesPorSim.set(l.simId, atual);
  }
  const totalPendentes = [...pendentesPorSim.values()].reduce(
    (n, x) => n + x.linhaIds.length,
    0,
  );

  async function reenviarPendentes() {
    if (totalPendentes === 0 || reenviandoLote) return;
    setReenviandoLote(true);
    let falhas = 0;
    try {
      // Um envio por simulação, levando só os bancos daquela simulação que
      // ficaram sem retorno — os já simulados não são tocados.
      for (const [simId, { bancoIds }] of pendentesPorSim) {
        try {
          await enviarSimulacaoBanco({ data: { simulacao_id: simId, banco_ids: bancoIds } });
        } catch (e) {
          falhas += 1;
          console.error("[reenviar lote]", simId, e);
        }
        qc.invalidateQueries({ queryKey: ["simulacao", simId] });
      }
      if (falhas === 0) {
        toast.success(
          totalPendentes === 1
            ? "Banco reenviado. O retorno aparece aqui mesmo."
            : `${totalPendentes} bancos reenviados. Os retornos aparecem aqui mesmo.`,
        );
      } else {
        toast.error("Parte dos reenvios falhou. Tente novamente pelos botões da linha.");
      }
    } finally {
      setReenviandoLote(false);
    }
  }

  const melhorPorGrupo: Record<string, { menorParcela?: string; menorCET?: string }> = {};
  const gruposSet = new Set(linhas.map(l => `${l.prazo}-${l.sistema}`));
  const grupos = Array.from(gruposSet);
  
  for (const grp of grupos) {
    const [pStr, sStr] = grp.split('-');
    const p = parseInt(pStr);
    const s = sStr as "SAC" | "PRICE";
    
    const cand = linhas
      .filter(
        (l) =>
          l.prazo === p && 
          l.sistema === s && 
          l.banco.status_banco === "simulada" && 
          l.banco.valor_parcela != null,
      );

    if (cand.length > 0) {
      const sortedParcela = [...cand].sort((a, b) => (a.banco.valor_parcela ?? 0) - (b.banco.valor_parcela ?? 0));
      const sortedCET = [...cand].sort((a, b) => (a.banco.taxa_cet_ano ?? a.banco.taxa_juros_ano ?? 0) - (b.banco.taxa_cet_ano ?? b.banco.taxa_juros_ano ?? 0));
      
      melhorPorGrupo[grp] = {
        menorParcela: sortedParcela[0].banco.id,
        menorCET: sortedCET[0].banco.id
      };
    }
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
            <ToneBadge tone="info">
              {dataSac?.simulacao?.prazo !== dataPrice?.simulacao?.prazo
                ? "Comparativo de Prazos"
                : "OverPrice · SAC + PRICE"}
            </ToneBadge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Prazo:{" "}
            <span className="font-medium text-foreground">
              {dataSac?.simulacao?.prazo === dataPrice?.simulacao?.prazo && !dataSac?.simulacao?._multi_prazo
                ? `${dataSac?.simulacao?.prazo} meses`
                : "Múltiplos prazos"}
            </span>
            {" · "}
            Financiamento:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatBRL(ref?.valor_financiamento)}
            </span>
            {" · "}
            Comparativo dos dois sistemas de amortização lado a lado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <ResumoPerformanceSimulacao 
            linhas={linhas} 
            className="hidden sm:flex"
          />
          <div className="flex flex-wrap items-center gap-2">
            {/* Reenvia só quem não retornou, na mesma simulação — quem já
                respondeu não é consultado de novo. */}
            {totalPendentes > 0 && (
              <Button
                variant="secondary"
                size="sm"
                disabled={reenviandoLote}
                onClick={reenviarPendentes}
                title="Reenvia apenas os bancos sem retorno, mantendo os resultados já obtidos"
              >
                <RefreshCw
                  className={cn("mr-1.5 h-4 w-4", reenviandoLote && "animate-spin")}
                />
                {reenviandoLote
                  ? "Reenviando…"
                  : totalPendentes === 1
                    ? "Reenviar 1 sem retorno"
                    : `Reenviar ${totalPendentes} sem retorno`}
              </Button>
            )}
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
      </div>

      {/* Mobile-only performance summary */}
      <div className="flex w-full border-b border-border/40 px-5 pb-3 pt-1 sm:hidden">
        <ResumoPerformanceSimulacao 
          linhas={linhas} 
          className="w-full justify-between"
        />
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
                const grpKey = `${l.prazo}-${l.sistema}`;
                const isMelhorParcela = melhorPorGrupo[grpKey]?.menorParcela === b.id;
                const isMelhorCET = melhorPorGrupo[grpKey]?.menorCET === b.id;
                const primeiroDoGrupo = idx === 0 || 
                                       linhas[idx - 1].prazo !== l.prazo || 
                                       linhas[idx - 1].sistema !== l.sistema;
                return (
                  <div key={`${l.prazo}-${l.sistema}-${b.id}`}>
                    {primeiroDoGrupo && (
                      <div className="mb-2 flex items-center gap-2">
                        <AmortizacaoTag sistema={l.sistema} />
                        <span className="text-[10px] font-bold text-primary/70">{l.prazo} meses</span>
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
                            {isMelhorParcela && <ToneBadge tone="success">Menor parcela</ToneBadge>}
                            {isMelhorCET && <ToneBadge tone="info">Menor CET</ToneBadge>}
                          </div>

                          <div className="mt-1">
                            <BancoStatusBadge status={b.status_banco} />
                          </div>
                        </div>
                      </div>

                      {b.status_banco === "erro" && b.mensagem_banco && (
                        <div className="mt-2">
                          <ErroBancoDetalhe mensagem={b.mensagem_banco} nomeBanco={b.nome_banco} />
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
                              : l.prazo != null
                                ? `${l.prazo}m`
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
                        {b.status_banco !== "simulada" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={reenviandoBanco === b.id}
                            onClick={() => reenviarBanco(l.simId, b.banco_id, b.id, b)}
                            title="Reenvia somente este banco, na mesma simulação"
                          >
                            <RefreshCw
                              className={cn(
                                "mr-1 h-4 w-4",
                                reenviandoBanco === b.id && "animate-spin",
                              )}
                            />
                            {reenviandoBanco === b.id ? "Reenviando…" : "Reenviar"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-to-b from-primary to-primary/90 shadow-sm"
                            disabled={
                              b.status_banco !== "simulada" ||
                              criandoBanco !== null ||
                              enviandoBanco
                            }
                            onClick={() => enviarAprovacao(l.simId, b.banco_id)}
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
                  </div>
                );
              })}
            </div>

            {/* Desktop: tabela unificada */}
            <div className="hidden rounded-xl border border-border/60 shadow-sm lg:block">
              <Table className="w-full table-fixed text-[13px]">
                <TableHeader>
                  <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[22%] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Banco
                    </TableHead>
                    <TableHead className="w-[9%] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Situação
                    </TableHead>
                    <TableHead className="w-[11%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Parcela
                    </TableHead>
                    <TableHead className="w-[7%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Taxa
                    </TableHead>
                    <TableHead className="w-[7%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Prazo
                    </TableHead>
                    <TableHead className="w-[16%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Total fin. (banco)
                    </TableHead>
                    <TableHead className="w-[11%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      IOF (banco)
                    </TableHead>
                    <TableHead className="w-[11%] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Renda est.
                    </TableHead>

                    <TableHead className="w-[12%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l, idx) => {
                    const b = l.banco;
                    const grpKey = `${l.prazo}-${l.sistema}`;
                    const isMelhorParcela = melhorPorGrupo[grpKey]?.menorParcela === b.id;
                    const isMelhorCET = melhorPorGrupo[grpKey]?.menorCET === b.id;
                    // Comparações normalizadas: nome com espaços/caixa
                    // diferentes ou prazo como texto reabriam a seção e
                    // repetiam o cabeçalho do prazo.
                    const ant = idx === 0 ? null : linhas[idx - 1];
                    const novoTitular = !ant || chaveTitular(ant) !== chaveTitular(l);
                    const novoPrazo = novoTitular || Number(ant!.prazo) !== Number(l.prazo);
                    const primeiroDoGrupo = novoPrazo || ant!.sistema !== l.sistema;
                    return (
                      <Fragment key={`${l.titularNome}-${l.prazo}-${l.sistema}-${b.id}`}>
                        {novoTitular && variosTitulares && (
                          <TableRow className="border-border/60 bg-primary/[0.06] hover:bg-primary/[0.06]">
                            <TableCell colSpan={9} className="py-3">
                              <div className="flex items-center gap-2 px-1">
                                <span className="text-[13px] font-bold text-primary">
                                  {l.titularNome}
                                </span>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                  {l.titularPrincipal ? "Titular" : "CPF testado"}
                                </span>
                                <div className="h-px flex-1 bg-primary/20" />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {novoPrazo && (
                           <TableRow className="border-border/60 bg-primary/[0.03] hover:bg-primary/[0.03]">
                             <TableCell colSpan={9} className="py-2.5">
                               <div className="flex items-center gap-2 px-1">
                                 <span className="text-xs font-bold uppercase tracking-widest text-primary">
                                   Prazo: {l.prazo} meses
                                 </span>
                                 <div className="h-px flex-1 bg-primary/20" />
                               </div>
                             </TableCell>
                           </TableRow>
                        )}
                        {primeiroDoGrupo && (
                          <TableRow
                            key={`hdr-${l.prazo}-${l.sistema}`}
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
                          key={`${l.prazo}-${l.sistema}-${b.id}`}
                          className={cn(
                            "border-border/50 transition-colors odd:bg-card even:bg-muted/20 hover:bg-primary/5",
                            isMelhorParcela &&
                              "bg-success/5 even:bg-success/5 hover:bg-success/10 [box-shadow:inset_3px_0_0_var(--success)]",
                          )}
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <BancoLogo nome={b.nome_banco} size="md" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <AmortizacaoTag sistema={l.sistema} />

                                  <span
                                    className="truncate text-sm font-semibold"
                                    style={{ color: corDoBanco(b.nome_banco) }}
                                  >
                                    {b.nome_banco}
                                  </span>
                                </div>

                                {isMelhorParcela && <ToneBadge tone="success">Menor parcela</ToneBadge>}
                                {isMelhorCET && <ToneBadge tone="info">Menor CET</ToneBadge>}
                                {b.status_banco === "erro" && b.mensagem_banco && (
                                  <div className="mt-0.5">
                                    <ErroBancoDetalhe
                                      mensagem={b.mensagem_banco}
                                      nomeBanco={b.nome_banco}
                                      linhas={1}
                                      className="text-[11px]"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <BancoStatusBadge status={b.status_banco} />
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm font-bold tabular-nums whitespace-nowrap text-foreground">
                            {formatBRL(b.valor_parcela)}
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                            {b.taxa_juros_ano != null ? formatTaxa(b.taxa_juros_ano) : "—"}
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm font-bold tabular-nums whitespace-nowrap text-foreground">
                            {b._prazo}m
                          </TableCell>

                          <TableCell className="py-3 text-right text-sm font-medium tabular-nums whitespace-nowrap">
                            {totalBancoTexto(b)}
                          </TableCell>

                          <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap text-muted-foreground">
                            {b.valor_iof != null ? formatBRL(b.valor_iof) : "—"}
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
                              {b.status_banco !== "simulada" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={reenviandoBanco === b.id}
                             onClick={() => reenviarBanco(l.simId, b.banco_id, b.id, b)}

                                >
                                  <RefreshCw className="mr-1 h-4 w-4" />
                                  {reenviandoBanco === b.id ? "…" : "Reenviar"}
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
              <strong className="font-medium text-foreground">Importante:</strong> Isto é apenas uma
              simulação. A efetivação está condicionada à análise da proposta pelo banco. As taxas
              são apenas referência.
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
  
  // No modo Ambos, consolidamos todos os bancos de todas as simulações irmãs.
  const ref = dataSac?.simulacao ?? dataPrice?.simulacao;
  const bancosConsolidados = [
    ...bancosDaSimulacaoAtual(dataSac),
    ...bancosDaSimulacaoAtual(dataPrice)
  ].filter((b, idx, self) => 
    b.status_banco === "simulada" && 
    self.findIndex(t => t.id === b.id) === idx
  );

  const totalOk = bancosConsolidados.length;
  const desabilitado = totalOk === 0 || baixando;

  async function baixar() {
    if (desabilitado || !ref) return;
    setBaixando(true);
    try {
      const { baixarSimulacaoPDF } = await import("@/lib/simulacao/simulacao-pdf");
      
      // Chama a função de PDF consolidado (Comparativo) que agora suporta múltiplos prazos.
      baixarSimulacaoPDF({ 
        simulacao: ref, 
        bancos: bancosConsolidados 
      });
      
      toast.success("PDF comparativo gerado com sucesso.");
    } catch (e) {
      console.error("[baixar PDF] consolidado", e);
      toast.error("Não foi possível gerar o PDF comparativo.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={baixar} disabled={desabilitado}>
      <Download className="mr-1.5 h-4 w-4" />
      {baixando ? "Gerando…" : `Baixar PDF Comparativo`}
    </Button>
  );
}

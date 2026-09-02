import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Send,
  Home,
  User,
  Users,
  Landmark,
  ShieldCheck,
  X,
  AlertTriangle,
  UserPlus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SecaoCabecalho } from "@/components/simulacao/secao-cabecalho";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConsultandoOverlay } from "@/components/simulacao/consultando-overlay";
import { SecaoOperacaoImovel } from "@/components/simulacao/completa/secao-operacao-imovel";
import { SecaoTitular } from "@/components/simulacao/completa/secao-titular";
import { SecaoConjuge } from "@/components/simulacao/completa/secao-conjuge";
import { SecaoBancos } from "@/components/simulacao/completa/secao-bancos";
import { SecaoConsentimentos } from "@/components/simulacao/completa/secao-consentimentos";
import { EnviarPropostaDialog } from "@/components/simulacao/enviar-proposta-dialog";
import { SecaoComposicaoRenda } from "@/components/simulacao/completa/secao-composicao-renda";
import { ComparativoCpfsDialog } from "@/components/simulacao/completa/comparativo-cpfs-dialog";

import { ResultadoInlineCompleta } from "@/components/simulacao/completa/resultado-inline";
import { ResultadoInlineAmbos } from "@/components/simulacao/completa/resultado-inline-ambos";
import { TabelaComparativaCPFs } from "@/components/simulacao/completa/tabela-comparativa-cpfs";

import { formatBRL, formatPercent, formatTaxa } from "@/lib/simulacao/format";
import { useSimulacaoCompleta } from "@/lib/simulacao/use-simulacao-completa";
import { obterSimulacao } from "@/lib/simulacao/simulacoes.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/simulacoes_/completa")({
  head: () => ({ meta: [{ title: "Simulação completa — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  validateSearch: (
    search: Record<string, unknown>,
  ): { duplicar?: string; origem?: "proposta" } => ({
    duplicar: typeof search.duplicar === "string" ? search.duplicar : undefined,
    origem: search.origem === "proposta" ? "proposta" : undefined,
  }),
  component: Pagina,
});

function Pagina() {
  const { duplicar, origem: origemFluxo } = Route.useSearch();
  const ctx = useSimulacaoCompleta({ duplicar, modoProposta: origemFluxo === "proposta" });
  const {
    router,
    modoProposta,
    f,
    erros,
    enviando,
    concluidos,
    listaSimulacoes,
    mostraConjuge,
    confirmRenda,
    setConfirmRenda,
    enviar,
    executarEnvio,
    simulacaoResultadoId,
    simulacaoResultadoIdPrice,
    simulacaoResultadoIdSecundario,
    fecharResultadoInline,
    fecharResultadoInlinePrice,
    fecharResultadoInlineSecundario,
    enviarOriginal,
    formInvalido,
    carregandoOrigem,
  } = ctx;
  const resultadoRef = useRef<HTMLDivElement>(null);

  const [popupAberto, setPopupAberto] = useState(false);
  const jaMostrouPopup = useRef(false);
  const checkStatusInterval = useRef<NodeJS.Timeout | null>(null);

  // Monitorar retornos para mostrar o popup de comparação
  useEffect(() => {
    // Se resetou a tela (sem IDs de resultado), permitimos mostrar o popup novamente na próxima vez
    if (!simulacaoResultadoId && !simulacaoResultadoIdSecundario) {
      jaMostrouPopup.current = false;
      setPopupAberto(false);
      if (checkStatusInterval.current) {
        clearInterval(checkStatusInterval.current);
        checkStatusInterval.current = null;
      }
      return;
    }

    // Se já mostramos ou não temos ambos os IDs necessários para comparar, não inicia monitoramento
    if (jaMostrouPopup.current || !simulacaoResultadoId || !simulacaoResultadoIdSecundario) {
      return;
    }

    const checkStatus = async () => {
      // Evita checagem se o popup já foi exibido ou se fechou no meio do caminho
      if (jaMostrouPopup.current) {
        if (checkStatusInterval.current) {
          clearInterval(checkStatusInterval.current);
          checkStatusInterval.current = null;
        }
        return;
      }

      const { data: sims } = await supabase
        .from("simulacoes")
        .select("id, status")
        .in("id", [simulacaoResultadoId, simulacaoResultadoIdSecundario]);

      if (sims && sims?.length === 2) {
        const prontos = sims.every((s: any) => s.status !== "enviando" && s.status !== "rascunho");
        if (prontos) {
          jaMostrouPopup.current = true;
          setPopupAberto(true);
          if (checkStatusInterval.current) {
            clearInterval(checkStatusInterval.current);
            checkStatusInterval.current = null;
          }
        }
      }
    };

    if (!checkStatusInterval.current) {
      checkStatusInterval.current = setInterval(checkStatus, 5000);
      // Roda a primeira vez imediatamente
      void checkStatus();
    }

    return () => {
      if (checkStatusInterval.current) {
        clearInterval(checkStatusInterval.current);
        checkStatusInterval.current = null;
      }
    };
  }, [simulacaoResultadoId, simulacaoResultadoIdSecundario]);

  const totalBancosResumo =
    f.sistema_amortizacao === "B"
      ? (f.bancos_sac_ids?.length ?? 0) + (f.bancos_price_ids?.length ?? 0)
      : (f.bancos_ids?.length ?? 0);

  const resumoEtapas = [
    { label: "Titular", ok: !!f.nome_cliente },
    { label: "Operação e imóvel", ok: (Number(f.valor_financiamento) || 0) > 0 },
    { label: "Bancos", ok: totalBancosResumo > 0 },
  ];

  return (
    <div className="mx-auto w-full max-w-none space-y-3 p-2 sm:p-4 md:p-6 lg:p-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        onClick={() =>
          router.history.canGoBack()
            ? router.history.back()
            : router.navigate({ to: "/operacional/simulacoes" })
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <FileText className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {modoProposta ? "Nova Proposta" : "Solicitar Simulação Completa"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {modoProposta
              ? "Preencha a simulação completa e envie direto ao banco — a proposta é criada automaticamente."
              : "Preencha os dados para enviar aos bancos parceiros."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Coluna principal — formulário */}
        <div className={cn("min-w-0 space-y-4 transition-opacity", carregandoOrigem && "opacity-50 pointer-events-none")}>
          <Card className="overflow-hidden">
            <SecaoCabecalho
              icone={<User className="h-4 w-4" />}
              titulo="Titular"
              descricao="Dados do proponente principal"
            />
            <div className="p-4 sm:p-5 md:p-6">
              <SecaoTitular ctx={ctx} />
            </div>
          </Card>

          {/* Fluxo PJ suspenso: tudo abaixo do Titular fica travado. O aviso
              aparece dentro da seção Titular, junto do seletor de modalidade. */}
          <fieldset
            disabled={ctx.pjBloqueada}
            className={cn(
              "m-0 min-w-0 space-y-4 border-0 p-0",
              ctx.pjBloqueada && "pointer-events-none opacity-50",
            )}
          >
          {mostraConjuge && !ctx.isPJ && (
            <Card className="overflow-hidden">
              <SecaoCabecalho
                icone={<Users className="h-4 w-4" />}
                titulo="Cônjuge / coobrigado"
                descricao="Composição de renda"
              />
              <div className="p-4 sm:p-5 md:p-6">
                <SecaoConjuge ctx={ctx} />
              </div>
            </Card>
          )}

          {!ctx.isPJ && (
            <Card className="overflow-hidden">
              <SecaoCabecalho
                icone={<UserPlus className="h-4 w-4" />}
                titulo="Composição de Renda (Terceiros)"
                descricao="Pessoas adicionais para compor renda"
              />
              <div className="p-4 sm:p-5 md:p-6">
                <SecaoComposicaoRenda ctx={ctx} />
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <SecaoCabecalho
              icone={<Home className="h-4 w-4" />}
              titulo="Operação e imóvel"
              descricao="Produto, características e valores"
            />
            <div className="p-4 sm:p-5 md:p-6">
              <SecaoOperacaoImovel ctx={ctx} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SecaoCabecalho
              icone={<Landmark className="h-4 w-4" />}
              titulo="Bancos"
              descricao="Selecione as instituições para consultar"
            />
            <div className="p-4 sm:p-5 md:p-6">
              <SecaoBancos ctx={ctx} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SecaoCabecalho
              icone={<ShieldCheck className="h-4 w-4" />}
              titulo="Consentimentos"
              descricao="Autorizações necessárias"
            />
            <div className="p-4 sm:p-5 md:p-6">
              <SecaoConsentimentos ctx={ctx} />
            </div>
          </Card>

          </fieldset>

          {/* Ação sempre disponível no final do formulário */}
          <div className="flex justify-end pt-1">
            <Button
              className="h-11 w-full gap-2 sm:w-auto sm:px-8"
              onClick={() => {
                console.log("Clique manual no botão Gerar Simulação");
                enviarOriginal();
              }}
              disabled={enviando || ctx.pjBloqueada}
            >
              <Send className="h-4 w-4" />{" "}
              {modoProposta ? "Gerar Proposta e Enviar ao Banco" : "Gerar Simulação"}
            </Button>
          </div>
        </div>

        {/* Coluna lateral — resumo fixo (apenas em telas grandes) */}
        <aside className="hidden lg:block">
          <Card className="sticky top-6 overflow-hidden">
            <div className="border-b border-border/60 bg-muted/30 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-foreground">Resumo</h2>
              <p className="text-xs text-muted-foreground">Acompanhe o preenchimento</p>
            </div>
            <div className="space-y-4 p-5">
              <ul className="space-y-2.5">
                {resumoEtapas.map((e) => (
                  <li key={e.label} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={
                        e.ok
                          ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                          : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                      }
                    >
                      <ShieldCheck className="h-3 w-3" />
                    </span>
                    <span className={e.ok ? "text-foreground" : "text-muted-foreground"}>
                      {e.label}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Financiamento</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatBRL(Number(f.valor_financiamento) || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prazo</span>
                  <span className="font-medium tabular-nums text-foreground">{f.prazo} meses</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Bancos</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {totalBancosResumo}
                  </span>
                </div>
              </div>

              <Button className="h-11 w-full gap-2" onClick={() => {
                console.log("Clique manual no botão Resumo (Aside)");
                enviarOriginal();
              }} disabled={enviando || ctx.pjBloqueada}>
                <Send className="h-4 w-4" /> {modoProposta ? "Gerar Proposta" : "Gerar Simulação"}
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {(simulacaoResultadoId || simulacaoResultadoIdPrice || simulacaoResultadoIdSecundario) &&
        !modoProposta && (
          <div ref={resultadoRef} className="scroll-mt-4 space-y-4">
            <div className="flex flex-col gap-6">
              {/* Bloco do Titular Principal */}
              {simulacaoResultadoId && simulacaoResultadoIdPrice ? (
                <ResultadoInlineAmbos
                  simulacaoIdSac={simulacaoResultadoId}
                  simulacaoIdPrice={simulacaoResultadoIdPrice}
                  idsExtras={ctx.comparativoCpfs.flatMap((p: any) => p.ids)}
                  onFechar={() => {
                    fecharResultadoInline();
                    fecharResultadoInlinePrice();
                  }}
                />
              ) : simulacaoResultadoId ? (
                <ResultadoInlineCompleta
                  simulacaoId={simulacaoResultadoId}
                  onFechar={fecharResultadoInline}
                />
              ) : simulacaoResultadoIdPrice ? (
                <ResultadoInlineCompleta
                  simulacaoId={simulacaoResultadoIdPrice}
                  onFechar={fecharResultadoInlinePrice}
                />
              ) : null}

              {/* Tabela Comparativa (Problema 4) */}
              {simulacaoResultadoId && simulacaoResultadoIdSecundario && (
                <TabelaComparativaCPFs
                  simulacaoIdA={simulacaoResultadoId}
                  simulacaoIdB={simulacaoResultadoIdSecundario}
                />
              )}

              {/* Bloco da Simulação Secundária (Exibe apenas se não houver o titular principal, caso contrário a tabela acima cobre) */}
              {simulacaoResultadoIdSecundario && !simulacaoResultadoId && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                    <Landmark className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">
                      Simulação Secundária (Cônjuge como titular)
                    </h3>
                  </div>
                  <ResultadoInlineCompleta
                    simulacaoId={simulacaoResultadoIdSecundario}
                    onFechar={fecharResultadoInlineSecundario}
                    isSecundaria
                  />
                </div>
              )}
            </div>
          </div>
        )}

      <ConsultandoOverlay
        aberto={enviando}
        total={totalBancosResumo}
        concluidos={concluidos}
        listaSimulacoes={listaSimulacoes}
        onReenviar={() => { void enviar(); }}
      />


      <EnviarPropostaDialog
        envio={ctx.envioEstado}
        onClose={ctx.fecharDialogEnvio}
        carregando={false}
        statusPorBanco={ctx.statusPorBanco}
        onEnviarBanco={ctx.enviarBancoIndividual}
        onEnviarTodos={ctx.enviarTodosBancos}
      />

      {/* O bloqueio preventivo foi removido. A renda mínima agora é apenas informativa no painel de resultados. */}

      {/* Teste automático de CPFs entre os proponentes */}
      <ComparativoCpfsDialog
        aberto={ctx.comparativoCpfs.length > 1}
        onClose={ctx.limparComparativoCpfs}
        proponentes={ctx.comparativoCpfs}
      />

      {/* Popup de Comparação de Taxas (Dual CPF) */}
      <ComparativoTaxasDialog
        aberto={popupAberto}
        onClose={() => setPopupAberto(false)}
        idTitular={simulacaoResultadoId}
        idSecundario={simulacaoResultadoIdSecundario}
      />
    </div>
  );
}

function ComparativoTaxasDialog({
  aberto,
  onClose,
  idTitular,
  idSecundario,
}: {
  aberto: boolean;
  onClose: () => void;
  idTitular: string | null;
  idSecundario: string | null;
}) {
  const { data: titular } = useQuery({
    queryKey: ["simulacao", idTitular],
    queryFn: () => obterSimulacao({ data: { id: idTitular! } }),
    enabled: aberto && !!idTitular,
  });

  const { data: secundario } = useQuery({
    queryKey: ["simulacao", idSecundario],
    queryFn: () => obterSimulacao({ data: { id: idSecundario! } }),
    enabled: aberto && !!idSecundario,
  });

  const getMelhorTaxa = (sim: any) => {
    const bancos = (sim?.bancos as any[]) ?? [];
    const taxas = bancos
      .filter((b) => b.status_banco === "simulada" && b.taxa_juros_ano)
      .map((b) => b.taxa_juros_ano);
    return taxas.length > 0 ? Math.min(...taxas) : null;
  };

  const taxaTitular = getMelhorTaxa(titular);
  const taxaConjuge = getMelhorTaxa(secundario);

  const nomeTitular = titular?.simulacao?.nome_cliente?.split(" ")[0] ?? "Titular";
  const nomeConjuge = secundario?.simulacao?.nome_cliente?.split(" ")[0] ?? "Cônjuge";

  return (
    <AlertDialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-xl border border-border bg-card p-0 shadow-2xl">
        <div className="relative overflow-hidden p-8">
          <div className="relative">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Landmark className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    Análise Comparativa de Taxas
                  </h3>
                  <p className="text-sm font-medium text-muted-foreground">
                    Teste Automático de CPF (Titular vs Cônjuge)
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={onClose}
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <TaxaCard
                nome={nomeTitular}
                taxa={taxaTitular}
                isWinner={taxaTitular != null && taxaConjuge != null && taxaTitular <= taxaConjuge}
              />
              <TaxaCard
                nome={nomeConjuge}
                taxa={taxaConjuge}
                isWinner={taxaTitular != null && taxaConjuge != null && taxaConjuge < taxaTitular}
              />
            </div>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="rounded-xl border border-border bg-muted/30 px-6 py-4 text-center">
                <p className="text-sm font-semibold text-foreground">
                  {taxaTitular && taxaConjuge
                    ? taxaTitular <= taxaConjuge
                      ? taxaTitular === taxaConjuge
                        ? `Ambos perfis apresentaram taxas iguais (${formatTaxa(taxaTitular)} a.a.).`
                        : `O perfil de ${nomeTitular} apresentou as condições mais vantajosas para o financiamento.`
                      : `O perfil de ${nomeConjuge} apresentou as condições mais vantajosas para o financiamento.`
                    : "Aguardando processamento final dos retornos bancários..."}
                </p>
              </div>

              <Button
                onClick={onClose}
                className="h-12 w-full rounded-xl bg-primary px-8 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 sm:w-auto"
              >
                Fechar Comparativo
              </Button>
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TaxaCard({
  nome,
  taxa,
  isWinner,
}: {
  nome: string;
  taxa: number | null;
  isWinner: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-6 transition-all duration-300",
        isWinner ? "border-primary/50 bg-primary/5 shadow-md" : "border-border bg-card shadow-sm",
      )}
    >
      {isWinner && (
        <div className="absolute right-4 top-4">
          <div className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            Melhor Taxa
          </div>
        </div>
      )}

      <div className="space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          PERFIL {nome}
        </span>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-4xl font-black tabular-nums tracking-tighter",
              isWinner ? "text-primary" : "text-foreground",
            )}
          >
            {taxa ? formatTaxa(taxa) : "—"}
          </span>
          {taxa && <span className="text-sm font-bold text-muted-foreground">a.a.</span>}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className={cn("h-1.5 flex-1 rounded-full", isWinner ? "bg-primary/20" : "bg-muted")}>
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              isWinner ? "w-full bg-primary" : "w-1/2 bg-muted-foreground/30",
            )}
          />
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ArrowLeft, FileText, Send, Home, User, Users, Landmark, ShieldCheck } from "lucide-react";
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
import { ResultadoInlineCompleta } from "@/components/simulacao/completa/resultado-inline";
import { ResultadoInlineAmbos } from "@/components/simulacao/completa/resultado-inline-ambos";
import { PainelRendaNecessaria } from "@/components/simulacao/completa/painel-renda-necessaria";
import { formatBRL } from "@/lib/simulacao/format";
import { useSimulacaoCompleta } from "@/lib/simulacao/use-simulacao-completa";

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
  const { router, modoProposta, f, enviando, concluidos, mostraConjuge, confirmRenda, setConfirmRenda, enviar, executarEnvio, simulacaoResultadoId, simulacaoResultadoIdPrice, fecharResultadoInline, fecharResultadoInlinePrice } = ctx;
  const resultadoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((simulacaoResultadoId || simulacaoResultadoIdPrice) && resultadoRef.current) {
      resultadoRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [simulacaoResultadoId, simulacaoResultadoIdPrice]);

  const totalBancosResumo =
    f.sistema_amortizacao === "B"
      ? (f.bancos_sac_ids?.length ?? 0) + (f.bancos_price_ids?.length ?? 0)
      : f.bancos_ids.length;

  const resumoEtapas = [
    { label: "Titular", ok: !!f.nome_cliente },
    { label: "Operação e imóvel", ok: (Number(f.valor_financiamento) || 0) > 0 },
    { label: "Bancos", ok: totalBancosResumo > 0 },
  ];

  return (
    <div className="mx-auto w-full max-w-none space-y-4 p-4 md:p-8">
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
        <div className="min-w-0 space-y-4">
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

          {mostraConjuge && (
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

          {/* Ação sempre disponível no final do formulário */}
          <div className="flex justify-end pt-1">
            <Button className="h-11 w-full gap-2 sm:w-auto sm:px-8" onClick={enviar} disabled={enviando}>
              <Send className="h-4 w-4" /> {modoProposta ? "Gerar Proposta e Enviar ao Banco" : "Gerar Simulação"}
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

              <Button className="h-11 w-full gap-2" onClick={enviar} disabled={enviando}>
                <Send className="h-4 w-4" /> {modoProposta ? "Gerar Proposta" : "Gerar Simulação"}
              </Button>

            </div>
          </Card>
        </aside>
      </div>

      {(simulacaoResultadoId || simulacaoResultadoIdPrice) && !modoProposta && (
        <div ref={resultadoRef} className="scroll-mt-4 space-y-4">
          {simulacaoResultadoId && simulacaoResultadoIdPrice ? (
            <ResultadoInlineAmbos
              simulacaoIdSac={simulacaoResultadoId}
              simulacaoIdPrice={simulacaoResultadoIdPrice}
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
          <PainelRendaNecessaria ctx={ctx} />
        </div>
      )}

      <ConsultandoOverlay aberto={enviando} total={totalBancosResumo} concluidos={concluidos} />




      <AlertDialog open={!!confirmRenda} onOpenChange={(o) => !o && setConfirmRenda(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renda abaixo do sugerido</AlertDialogTitle>
            <AlertDialogDescription>
              A renda informada de{" "}
              <span className="font-semibold text-foreground">
                {formatBRL(confirmRenda?.rendaInformada ?? 0)}
              </span>{" "}
              é inferior à renda familiar mínima estimada de{" "}
              <span className="font-semibold text-foreground">
                {formatBRL(confirmRenda?.rendaMinima ?? 0)}
              </span>{" "}
              para este financiamento. O banco poderá reprovar a operação. Deseja enviar mesmo
              assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar dados</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRenda(null);
                void executarEnvio();
              }}
            >
              Enviar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

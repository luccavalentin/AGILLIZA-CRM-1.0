import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listarBancosAtivos, taxasReferenciaBancos } from "@/lib/simulacao/simulacoes.functions";
import { compararBancosRapido, taxaAnoDeBanco } from "@/lib/simulacao/simulacao-rapida";

import { useWizardSimulacao, PRAZO_MIN } from "@/components/simulacao/nova/use-wizard-simulacao";
import { FormularioSimulacao } from "@/components/simulacao/nova/formulario-simulacao";
import { ResultadoRapido } from "@/components/simulacao/nova/resultado-rapido";

export const Route = createFileRoute("/_authenticated/operacional/simulacoes_/nova")({
  head: () => ({ meta: [{ title: "Nova simulação — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  validateSearch: (search: Record<string, unknown>): { modo?: "rapida" } => ({
    modo: search.modo === "rapida" ? "rapida" : undefined,
  }),
  component: Pagina,
});

function Pagina() {
  const router = useRouter();
  const [mostrarRapida, setMostrarRapida] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const resultadoRef = useRef<HTMLDivElement>(null);
  const jaBaixou = useRef(false);

  const { data: bancos } = useQuery({
    queryKey: ["bancos-ativos"],
    queryFn: () => listarBancosAtivos(),
  });

  const { data: taxasReais } = useQuery({
    queryKey: ["taxas-referencia-bancos"],
    queryFn: () => taxasReferenciaBancos(),
    staleTime: 1000 * 60 * 30,
  });

  const melhorTaxaAno = useMemo(() => {
    if (!bancos || bancos.length === 0) return 0.1299;
    return Math.min(...bancos.map((b) => taxaAnoDeBanco(b.codigo_banco, taxasReais)));
  }, [bancos, taxasReais]);

  const {
    w,
    set,
    valido,
    ltvMax,
    maxPrazoIdade,
    entradaSugerida,
    aplicarEntradaSugerida,
    aplicarValorImovel,
    aplicarPorEntrada,
    aplicarPorFinanciamento,
    aplicarPorParcela,
    definirPrazo,
  } = useWizardSimulacao(melhorTaxaAno);

  const comparativo = useMemo(() => {
    if (!bancos || !mostrarRapida) return [];
    return compararBancosRapido(
      bancos.map((b) => ({
        banco_id: b.id,
        codigo_banco: b.codigo_banco,
        nome_banco: b.nome_banco,
        taxa_ano: taxaAnoDeBanco(b.codigo_banco, taxasReais),
      })),
      {
        valor_financiamento: w.valor_financiamento,
        prazo_meses: w.prazo_meses,
        sistema: w.sistema_amortizacao,
      },
    );
  }, [
    bancos,
    taxasReais,
    mostrarRapida,
    w.valor_financiamento,
    w.prazo_meses,
    w.sistema_amortizacao,
  ]);

  function irParaCompleta() {
    sessionStorage.setItem(
      "simulacao_wizard",
      JSON.stringify({ ...w, prazo: w.prazo_meses }),
    );
    router.navigate({ to: "/operacional/simulacoes/completa" });
  }

  async function baixarSimulacao() {
    if (comparativo.length === 0) return;
    setBaixando(true);
    try {
      const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
      baixarSimulacaoDetalhadaPDF({
        simulacao: {
          numero_simulacao: null,
          nome_cliente: null,
          produto: w.produto,
          valor_imovel: w.valor_imovel,
          valor_financiamento: w.valor_financiamento,
          valor_entrada: w.valor_entrada,
          prazo: w.prazo_meses,
          sistema_amortizacao: w.sistema_amortizacao,
          created_at: new Date().toISOString(),
        },
        bancos: comparativo.map((c) => {
          const sistemaCode = w.sistema_amortizacao === "P" ? "P" : "S";
          return {
            nome_banco: c.nome_banco,
            status_banco: "simulada",
            valor_parcela: c.resultado.primeira_parcela,
            taxa_juros_ano: c.taxa_ano * 100,
            prazo_pagamento_max: w.prazo_meses,
            valor_financiamento_max: w.valor_financiamento,
            _sistema: sistemaCode === "P" ? "PRICE" : "SAC",
            // raw_response sintético para o extrator gerar parcelas, CET,
            // taxa mensal, tipo/plano — mesmos campos que o Bradesco devolve.
            raw_response: {
              simulacao: {
                codigoSistemaAmortizacaoSimulacao: sistemaCode,
                codigoSistemaAmortizacaoBanco: sistemaCode,
                prazoPagamentoBanco: w.prazo_meses,
                prazoPagamentoSimulacao: w.prazo_meses,
                valorFinanciamentoBanco: w.valor_financiamento,
                valorFinanciamentoSimulacao: w.valor_financiamento,
                valorTotalFinanciamento: w.valor_financiamento,
                valorImovel: w.valor_imovel,
                valorEntrada: w.valor_entrada,
                taxaJurosAnoBanco: c.taxa_ano * 100,
                taxaJurosAnoSimulacao: c.taxa_ano * 100,
                valorParcelaBanco: c.resultado.primeira_parcela,
              },
            },
          };
        }),
      });
    } catch {
      toast.error("Não foi possível gerar o PDF da simulação.");
    } finally {
      setBaixando(false);
    }
  }

  function simularRapida() {
    jaBaixou.current = false;
    setMostrarRapida(true);
  }

  useEffect(() => {
    if (!mostrarRapida || comparativo.length === 0 || jaBaixou.current) return;
    jaBaixou.current = true;
    const t = setTimeout(() => {
      resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      void baixarSimulacao();
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarRapida, comparativo.length]);

  void PRAZO_MIN;

  return (
    <div className="mx-auto w-full max-w-none space-y-4 p-4 md:p-6 lg:p-8">
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

      <div
        className={cn(
          "grid gap-4 lg:gap-6",
          mostrarRapida
            ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start"
            : "grid-cols-1",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <FormularioSimulacao
            w={w}
            set={set}
            ltvMax={ltvMax}
            entradaSugerida={entradaSugerida}
            aplicarEntradaSugerida={aplicarEntradaSugerida}
            aplicarValorImovel={aplicarValorImovel}
            aplicarPorEntrada={aplicarPorEntrada}
            aplicarPorFinanciamento={aplicarPorFinanciamento}
            aplicarPorParcela={aplicarPorParcela}
            definirPrazo={definirPrazo}
            maxPrazoIdade={maxPrazoIdade}
            melhorTaxaAno={melhorTaxaAno}
          />

          <div className="pt-1">
            <Button
              variant="default"
              className="h-12 w-full gap-2 text-sm font-semibold"
              disabled={!valido}
              onClick={simularRapida}
            >
              Simular
            </Button>
          </div>
        </div>

        {mostrarRapida && (
          <div className="min-w-0 lg:sticky lg:top-4">
            <ResultadoRapido
              ref={resultadoRef}
              comparativo={comparativo}
              valorFinanciamento={w.valor_financiamento}
              prazoMeses={w.prazo_meses}
              sistema={w.sistema_amortizacao === "P" ? "PRICE" : "SAC"}
              baixando={baixando}
              onBaixar={baixarSimulacao}
              onEnviar={irParaCompleta}
            />
          </div>
        )}
      </div>
    </div>
  );
}

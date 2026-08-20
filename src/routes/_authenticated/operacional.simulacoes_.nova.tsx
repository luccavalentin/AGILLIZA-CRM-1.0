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
import { ClienteCRMPicker } from "@/components/simulacao/cliente-crm-picker";
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
    aplicarPorFinanciamentoTotal,
    alternarFinanciarDespesas,
    financiamentoTotalExibido,
    aplicarPorParcela,
    definirPrazo,
    selecionarClienteCRM,
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
        valor_financiamento: financiamentoTotalExibido,
        prazo_meses: w.prazo_meses,
        sistema: w.sistema_amortizacao,
      },
    );
  }, [
    bancos,
    taxasReais,
    mostrarRapida,
    financiamentoTotalExibido,
    w.prazo_meses,
    w.sistema_amortizacao,
  ]);

  function irParaCompleta() {
    sessionStorage.setItem("simulacao_wizard", JSON.stringify({ ...w, prazo: w.prazo_meses }));
    router.navigate({ to: "/operacional/simulacoes/completa" });
  }

  async function baixarSimulacao(bancoId?: string) {
    if (comparativo.length === 0) return;
    setBaixando(true);
    try {
      const { baixarSimulacaoDetalhadaPDF, baixarSimulacaoPDF } =
        await import("@/lib/simulacao/simulacao-pdf");

      const simulacaoData = {
        numero_simulacao: null,
        nome_cliente: "SIMULAÇÃO RÁPIDA",
        produto: w.produto,
        valor_imovel: w.valor_imovel,
        valor_financiamento: financiamentoTotalExibido,
        valor_entrada: w.valor_entrada,
        prazo: w.prazo_meses,
        sistema_amortizacao:
          w.sistema_amortizacao === "AMBOS" ? "B" : w.sistema_amortizacao === "P" ? "P" : "S",
        created_at: new Date().toISOString(),
      };

      const bancosParaPDF = comparativo.map((c) => ({
        nome_banco: c.nome_banco,
        status_banco: "simulada",
        valor_parcela: c.resultado.primeira_parcela,
        taxa_juros_ano: c.taxa_ano * 100,
        prazo_pagamento_max: w.prazo_meses,
        valor_financiamento_max: financiamentoTotalExibido,
        _sistema: c.resultado.primeira_parcela === c.resultado.ultima_parcela ? "PRICE" : "SAC",
        renda_minima: c.resultado.renda_minima,
        cet: c.resultado.cet_ano * 100,
      }));

      // Se clicou em um banco específico, baixa somente o individual dele
      if (bancoId) {
        const c = comparativo.find((item) => item.banco_id === bancoId);
        if (c) {
          const sistemaCode =
            c.resultado.primeira_parcela === c.resultado.ultima_parcela ? "P" : "S";
          baixarSimulacaoDetalhadaPDF({
            simulacao: { ...simulacaoData, sistema_amortizacao: sistemaCode },
            bancos: [
              {
                ...bancosParaPDF.find((b) => b.nome_banco === c.nome_banco),
                raw_response: {
                  simulacao: {
                    codigoSistemaAmortizacaoSimulacao: sistemaCode,
                    codigoSistemaAmortizacaoBanco: sistemaCode,
                    prazoPagamentoBanco: w.prazo_meses,
                    valorFinanciamentoBanco: financiamentoTotalExibido,
                    valorImovel: w.valor_imovel,
                    valorEntrada: w.valor_entrada,
                    taxaJurosAnoBanco: c.taxa_ano * 100,
                    valorParcelaBanco: c.resultado.primeira_parcela,
                  },
                },
              },
            ],
          });
        }
      } else {
        // Baixa somente o comparativo consolidado (chamado pelo botão principal)
        baixarSimulacaoPDF({
          simulacao: simulacaoData,
          bancos: bancosParaPDF,
        });
      }
    } catch (err) {
      console.error(err);
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
    <div className="mx-auto w-full max-w-none space-y-4 p-3 sm:p-4 md:p-6 lg:p-8">
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
          <div className="max-w-md">
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Vincular Cliente do CRM
            </label>
            <ClienteCRMPicker
              selecionado={w.nome_cliente || null}
              onSelect={selecionarClienteCRM}
            />
          </div>

          <FormularioSimulacao
            w={w}
            set={set}
            ltvMax={ltvMax}
            entradaSugerida={entradaSugerida}
            aplicarEntradaSugerida={aplicarEntradaSugerida}
            aplicarValorImovel={aplicarValorImovel}
            aplicarPorEntrada={aplicarPorEntrada}
            aplicarPorFinanciamento={aplicarPorFinanciamento}
            aplicarPorFinanciamentoTotal={aplicarPorFinanciamentoTotal}
            alternarFinanciarDespesas={alternarFinanciarDespesas}
            financiamentoTotalExibido={financiamentoTotalExibido}
            aplicarPorParcela={aplicarPorParcela}
            definirPrazo={definirPrazo}
            maxPrazoIdade={maxPrazoIdade}
            melhorTaxaAno={melhorTaxaAno}
          />

          <div className="mt-2 flex justify-center">
            <Button
              variant="default"
              className="h-12 w-full max-w-xs gap-2 rounded-2xl bg-primary text-sm font-bold shadow-lg ring-1 ring-primary/20 transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] md:w-64"
              disabled={!valido}
              onClick={simularRapida}
            >
              Simular
            </Button>
          </div>
        </div>

        {mostrarRapida && (
          <div className="min-w-0 lg:sticky lg:top-8">
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

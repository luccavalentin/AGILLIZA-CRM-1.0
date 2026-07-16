import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText } from "lucide-react";
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
  const {
    w,
    set,
    valido,
    maxPrazoIdade,
    entradaSugerida,
    aplicarEntradaSugerida,
    definirPrazo,
  } = useWizardSimulacao();

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

  const comparativo = useMemo(() => {
    if (!bancos || !mostrarRapida) return [];
    return compararBancosRapido(
      bancos.map((b) => ({
        banco_id: b.id,
        codigo_banco: b.codigo_banco,
        nome_banco: b.nome_banco,
        taxa_ano: taxaAnoDeBanco(b.codigo_banco, taxasReais),
      })),
      { valor_financiamento: w.valor_financiamento, prazo_meses: w.prazo_meses, sistema: "S" },
    );
  }, [bancos, taxasReais, mostrarRapida, w.valor_financiamento, w.prazo_meses]);

  const melhorTaxaAno = useMemo(() => {
    if (!bancos || bancos.length === 0) return 0.1299;
    return Math.min(...bancos.map((b) => taxaAnoDeBanco(b.codigo_banco, taxasReais)));
  }, [bancos, taxasReais]);

  function irParaCompleta() {
    sessionStorage.setItem("simulacao_wizard", JSON.stringify({ ...w, prazo: w.prazo_meses }));
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
          sistema_amortizacao: "S",
          created_at: new Date().toISOString(),
        },
        bancos: comparativo.map((c) => ({
          nome_banco: c.nome_banco,
          status_banco: "simulada",
          valor_parcela: c.resultado.primeira_parcela,
          taxa_juros_ano: c.taxa_ano * 100,
          prazo_pagamento_max: w.prazo_meses,
          valor_financiamento_max: w.valor_financiamento,
        })),
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
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-4 w-fit text-muted-foreground"
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
            : "mx-auto max-w-3xl",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <FormularioSimulacao
            w={w}
            set={set}
            entradaSugerida={entradaSugerida}
            aplicarEntradaSugerida={aplicarEntradaSugerida}
            definirPrazo={definirPrazo}
            maxPrazoIdade={maxPrazoIdade}
            melhorTaxaAno={melhorTaxaAno}
          />

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <Button
              variant="default"
              className="h-12 gap-2 text-sm font-semibold"
              disabled={!valido}
              onClick={simularRapida}
            >
              Simulação rápida
            </Button>
            <Button
              variant="secondary"
              className="h-12 gap-2 text-sm font-semibold"
              disabled={!valido}
              onClick={() => irParaCompleta()}
            >
              <FileText className="h-4 w-4" /> Simulação completa
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

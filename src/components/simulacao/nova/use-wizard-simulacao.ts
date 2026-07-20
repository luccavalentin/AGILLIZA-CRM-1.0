import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ajustarPrazoPorIdade, prazoMaximoPorIdade } from "@/lib/simulacao/prazo";
import {
  calcularEntradaSugerida,
  calcularPorEntrada,
  calcularPorFinanciamento,
  calcularPorParcela,
} from "@/lib/simulacao/use-simulacao-completa/calculos";

export const PRAZO_MIN = 60;
export const PRAZO_MAX = 420;

export interface WizardState {
  produto: "financiamento_imobiliario" | "home_equity";
  valor_imovel: number;
  valor_entrada: number;
  valor_financiamento: number;
  data_nascimento: string;
  prazo_meses: number;
  renda_familiar: number;
  sistema_amortizacao: "S" | "P";
  parcela_alvo: number;
}

/**
 * Wizard da simulação rápida. Espelha as regras da simulação completa
 * (LTV por produto, cálculos cruzados imóvel/entrada/financiamento e
 * simulação inversa pela parcela), sem sair do formulário reduzido.
 */
export function useWizardSimulacao(melhorTaxaAno = 0.1199) {
  const [w, setW] = useState<WizardState>({
    produto: "financiamento_imobiliario",
    valor_imovel: 0,
    valor_entrada: 0,
    valor_financiamento: 0,
    data_nascimento: "",
    prazo_meses: 360,
    renda_familiar: 0,
    sistema_amortizacao: "S",
    parcela_alvo: 0,
  });

  // LTV por produto — mesma regra da simulação completa.
  const ltvMax = w.produto === "home_equity" ? 0.6 : 0.8;
  // Entrada sugerida por produto: HE = 30% do imóvel (LTV máx permanece 60%).
  const pctEntradaSugerida = w.produto === "home_equity" ? 0.3 : 1 - ltvMax;

  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    setW((prev) => ({ ...prev, [k]: v }));
  }

  // Reajusta entrada/financiamento ao mudar de produto (LTV muda) e aplica
  // o prazo máximo operacional do produto (Home Equity = 240 meses).
  useEffect(() => {
    const imovel = Number(w.valor_imovel) || 0;
    const finMax = Math.floor(imovel * ltvMax);
    const prazoMaxProduto = w.produto === "home_equity" ? 240 : PRAZO_MAX;
    setW((prev) => {
      const precisaClampFin = imovel > 0 && (Number(prev.valor_financiamento) || 0) > finMax;
      const precisaClampPrazo = prev.prazo_meses > prazoMaxProduto;
      if (!precisaClampFin && !precisaClampPrazo) return prev;
      return {
        ...prev,
        ...(precisaClampFin
          ? { valor_financiamento: finMax, valor_entrada: Math.max(0, imovel - finMax) }
          : {}),
        ...(precisaClampPrazo ? { prazo_meses: prazoMaxProduto } : {}),
      };
    });
    if (w.produto === "home_equity" && w.prazo_meses > 240) {
      toast.info("Home Equity: prazo máximo de 240 meses.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.produto]);

  function aplicarValorImovel(valor: number) {
    setW((prev) => {
      const imovel = Math.max(0, Number(valor) || 0);
      const entrada = Math.round(imovel * pctEntradaSugerida);
      return {
        ...prev,
        valor_imovel: imovel,
        valor_entrada: entrada,
        valor_financiamento: Math.max(0, imovel - entrada),
      };
    });
  }

  function aplicarEntradaSugerida() {
    setW((prev) => ({
      ...prev,
      ...(calcularEntradaSugerida(prev.valor_imovel || 0, ltvMax, pctEntradaSugerida) as Partial<WizardState>),
    }));
  }

  function aplicarPorEntrada(valorEntrada: number) {
    const patch = calcularPorEntrada(valorEntrada, ltvMax);
    setW((prev) => ({ ...prev, ...(patch as Partial<WizardState>) }));
  }

  function aplicarPorFinanciamento(valor: number) {
    const patch = calcularPorFinanciamento(valor, ltvMax);
    setW((prev) => ({ ...prev, ...(patch as Partial<WizardState>) }));
  }

  function aplicarPorParcela(valor: number) {
    const patch = calcularPorParcela(valor, {
      ltvMax,
      melhorTaxaAno,
      prazo: w.prazo_meses || 360,
      sistemaAmortizacao: w.sistema_amortizacao,
    });
    setW((prev) => ({ ...prev, ...(patch as Partial<WizardState>) }));
  }

  const entradaSugerida = Math.round((w.valor_imovel || 0) * pctEntradaSugerida);

  const maxPrazoIdade = useMemo(() => prazoMaximoPorIdade(w.data_nascimento), [w.data_nascimento]);

  const prazoMaxProduto = w.produto === "home_equity" ? 240 : PRAZO_MAX;
  const prazoMaxEfetivo = Math.min(maxPrazoIdade ?? PRAZO_MAX, prazoMaxProduto);

  const valido =
    w.valor_imovel > 0 &&
    w.valor_financiamento > 0 &&
    w.data_nascimento !== "" &&
    w.prazo_meses >= PRAZO_MIN &&
    w.prazo_meses <= prazoMaxEfetivo;

  function definirPrazo(valor: number) {
    if (!Number.isFinite(valor) || valor <= 0) {
      set("prazo_meses", 0);
      return;
    }
    const { prazo, ajustado, mensagem } = ajustarPrazoPorIdade(valor, w.data_nascimento);
    let final = prazo;
    if (w.produto === "home_equity" && final > 240) {
      final = 240;
      toast.warning("Home Equity: prazo máximo de 240 meses.");
    } else if (ajustado && mensagem) {
      toast.warning(mensagem);
    }
    set("prazo_meses", final);
  }

  useEffect(() => {
    if (maxPrazoIdade != null && w.prazo_meses > maxPrazoIdade) {
      const { mensagem } = ajustarPrazoPorIdade(w.prazo_meses, w.data_nascimento);
      if (mensagem) toast.warning(mensagem);
      set("prazo_meses", maxPrazoIdade);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPrazoIdade]);

  return {
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
  };
}

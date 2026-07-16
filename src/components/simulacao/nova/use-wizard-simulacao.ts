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

  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    setW((prev) => ({ ...prev, [k]: v }));
  }

  // Reajusta entrada/financiamento ao mudar de produto (LTV muda).
  useEffect(() => {
    const imovel = Number(w.valor_imovel) || 0;
    if (imovel <= 0) return;
    const finMax = Math.floor(imovel * ltvMax);
    if ((Number(w.valor_financiamento) || 0) <= finMax) return;
    setW((prev) => ({
      ...prev,
      valor_financiamento: finMax,
      valor_entrada: Math.max(0, imovel - finMax),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ltvMax]);

  function aplicarValorImovel(valor: number) {
    setW((prev) => {
      const imovel = Math.max(0, Number(valor) || 0);
      const entrada = Math.round(imovel * (1 - ltvMax));
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
      ...(calcularEntradaSugerida(prev.valor_imovel || 0, ltvMax) as Partial<WizardState>),
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

  const entradaSugerida = Math.round((w.valor_imovel || 0) * (1 - ltvMax));

  const maxPrazoIdade = useMemo(() => prazoMaximoPorIdade(w.data_nascimento), [w.data_nascimento]);

  const valido =
    w.valor_imovel > 0 &&
    w.valor_financiamento > 0 &&
    w.data_nascimento !== "" &&
    w.prazo_meses >= PRAZO_MIN &&
    w.prazo_meses <= (maxPrazoIdade ?? PRAZO_MAX);

  function definirPrazo(valor: number) {
    if (!Number.isFinite(valor) || valor <= 0) {
      set("prazo_meses", 0);
      return;
    }
    const { prazo, ajustado, mensagem } = ajustarPrazoPorIdade(valor, w.data_nascimento);
    if (ajustado && mensagem) toast.warning(mensagem);
    set("prazo_meses", prazo);
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

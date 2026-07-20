import { TAXA_MIP_MES, TAXA_DFI_MES, TAXA_ADMIN_MES } from "@/lib/simulacao/renda";
import type { Form } from "./state";

/**
 * Funções puras de "cálculo cruzado" da simulação. Cada função recebe o
 * input do usuário + parâmetros derivados e devolve um patch parcial de
 * `Form` para ser aplicado via `setF`. Não fazem side-effects (toast,
 * navegação, `setState`) — isso continua a cargo do hook.
 *
 * Preserva as fórmulas originais bit-a-bit (mesmos arredondamentos, mesmos
 * pisos/tetos) para não alterar nada visível ao usuário.
 */

/**
 * Sugere uma entrada compatível com o LTV vigente, mantendo o valor de
 * imóvel corrente. Retorna o patch a aplicar sobre o form atual.
 */
export function calcularEntradaSugerida(
  valorImovel: number,
  ltvMax: number,
  pctEntrada?: number,
): Partial<Form> {
  const pct = pctEntrada ?? 1 - ltvMax;
  const entrada = Math.round((valorImovel || 0) * pct);
  return {
    valor_entrada: entrada,
    valor_financiamento: Math.max(0, (valorImovel || 0) - entrada),
  };
}

/**
 * Preenche imóvel + financiamento a partir do valor de entrada.
 * Regra: entrada = (1 - LTV) do imóvel  ⇒  imóvel = entrada / (1 - LTV).
 */
export function calcularPorEntrada(valorEntrada: number, ltvMax: number): Partial<Form> {
  const entrada = Math.max(0, Number(valorEntrada) || 0);
  if (entrada <= 0) return { valor_entrada: 0 };
  const pctEntrada = 1 - ltvMax;
  const imovel = Math.round(entrada / pctEntrada);
  const fin = Math.max(0, imovel - entrada);
  return {
    valor_imovel: imovel,
    valor_entrada: entrada,
    valor_financiamento: fin,
  };
}

/**
 * Preenche imóvel + entrada a partir do valor a financiar (lógica inversa).
 * valorImóvel = financiamento / LTV; entrada = imóvel - financiamento.
 */
export function calcularPorFinanciamento(valorFinanciamento: number, ltvMax: number): Partial<Form> {
  const fin = Math.max(0, Number(valorFinanciamento) || 0);
  if (fin <= 0) return { valor_financiamento: 0 };
  // Arredonda o imóvel para o milhar mais próximo (para cima) e garante que
  // financiamento derivado respeite o LTV.
  const imovel = Math.ceil(fin / ltvMax / 1000) * 1000;
  const entrada = Math.max(0, imovel - fin);
  return {
    valor_imovel: imovel,
    valor_entrada: entrada,
    valor_financiamento: fin,
  };
}

interface ParametrosPorParcela {
  ltvMax: number;
  melhorTaxaAno: number;
  prazo: number;
  sistemaAmortizacao: string;
}

/**
 * Lógica inversa por parcela: dado o valor de parcela alvo, encontra o PV
 * (valor financiado) máximo, e daí deriva imóvel = PV / LTV e entrada.
 *
 * Fórmula: PMT_alvo = fator_amortização · PV + encargos(PV)
 *   PRICE  fator = i(1+i)^n / ((1+i)^n - 1)
 *   SAC    fator = 1/n + i   (primeira e maior parcela)
 *   encargos ≈ (MIP_mes + DFI_mes/LTV)·PV + Taxa_admin  (linear em PV)
 * ⇒ PV = (PMT_alvo - Taxa_admin) / (fator + k)
 * Usa a MAIOR taxa entre os bancos selecionados (conservador: menor PV).
 */
export function calcularPorParcela(
  parcelaAlvo: number,
  { ltvMax, melhorTaxaAno, prazo, sistemaAmortizacao }: ParametrosPorParcela,
): Partial<Form> {
  const pmt = Math.max(0, Number(parcelaAlvo) || 0);
  // Sempre persistir o valor digitado — nunca bloquear a digitação.
  if (pmt <= 0) {
    return {
      parcela_alvo: 0,
      valor_financiamento: 0,
      valor_imovel: 0,
      valor_entrada: 0,
    };
  }
  const taxaAno = melhorTaxaAno || 0.1199;
  const i = Math.pow(1 + taxaAno, 1 / 12) - 1;
  const n = Math.max(1, Math.round(Number(prazo) || 360));
  const fator =
    sistemaAmortizacao === "P"
      ? (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
      : 1 / n + i;
  const k = TAXA_MIP_MES + TAXA_DFI_MES / ltvMax;
  const pmtLiq = pmt - TAXA_ADMIN_MES;
  const pv = pmtLiq > 0 ? pmtLiq / (fator + k) : 0;
  // Se a parcela ainda é insuficiente (usuário digitando), só guardamos o valor sem toast.
  if (pv <= 0) {
    return { parcela_alvo: pmt };
  }
  // Arredonda o imóvel para o milhar mais próximo (para baixo) para evitar
  // centavos e garantir que o financiamento derivado (floor(imovel*LTV))
  // nunca ultrapasse o teto do banco.
  const imovel = Math.max(1000, Math.floor(pv / ltvMax / 1000) * 1000);
  const financiamento = Math.floor(imovel * ltvMax);
  const entrada = imovel - financiamento;
  return {
    parcela_alvo: pmt,
    valor_financiamento: financiamento,
    valor_imovel: imovel,
    valor_entrada: entrada,
  };
}

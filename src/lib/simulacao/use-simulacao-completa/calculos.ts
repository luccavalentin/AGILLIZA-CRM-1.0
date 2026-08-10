import { TAXA_MIP_MES, TAXA_DFI_MES, TAXA_ADMIN_MES, limitesLtv } from "@/lib/simulacao/renda";
import type { Form } from "./state";

/**
 * Funções puras de "cálculo cruzado" da simulação. Cada função recebe o
 * input do usuário + parâmetros derivados e devolve um patch parcial de
 * `Form` para ser aplicado via `setF`. Não fazem side-effects (toast,
 * navegação, `setState`) — isso continua a cargo do hook.
 */

/**
 * Sugere uma entrada compatível com o LTV vigente, mantendo o valor de
 * imóvel corrente. Retorna o patch a aplicar sobre o form atual.
 */
export function calcularEntradaSugerida(
  valorImovel: number,
  ltvMax: number,
): Partial<Form> {
  const { entradaMinima } = limitesLtv(valorImovel, ltvMax);
  return {
    valor_entrada: entradaMinima,
    valor_financiamento: Math.max(0, (Number(valorImovel) || 0) - entradaMinima),
  };
}

/**
 * Recalcula apenas os campos "à direita" da entrada.
 * Mantém o valor do imóvel intacto (só o usuário pode alterá-lo manualmente)
 * e ajusta o financiamento como o resto: financiamento = imóvel - entrada.
 * Se o imóvel ainda não foi informado, apenas guarda a entrada digitada.
 */
export function calcularPorEntrada(
  valorEntrada: number,
  _ltvMax: number,
  valorImovelAtual = 0,
): Partial<Form> {
  const entrada = Math.max(0, Number(valorEntrada) || 0);
  const imovel = Math.max(0, Number(valorImovelAtual) || 0);
  if (imovel <= 0) {
    return { valor_entrada: entrada };
  }
  const fin = Math.max(0, imovel - entrada);
  return {
    valor_entrada: entrada,
    valor_financiamento: fin,
  };
}

/**
 * Ao alterar o financiamento manualmente, preserva o valor do imóvel
 * (nada à esquerda é mexido) e recalcula a entrada para manter a
 * identidade contábil: entrada = imóvel - financiamento.
 * Se o imóvel ainda não foi informado, apenas persiste o valor digitado.
 */
export function calcularPorFinanciamento(
  valorFinanciamento: number,
  _ltvMax: number,
  valorImovelAtual = 0,
): Partial<Form> {
  const fin = Math.max(0, Number(valorFinanciamento) || 0);
  const imovel = Math.max(0, Number(valorImovelAtual) || 0);
  if (imovel <= 0) {
    return { valor_financiamento: fin };
  }
  const finLimitado = Math.min(fin, imovel);
  return {
    valor_financiamento: finLimitado,
    valor_entrada: Math.max(0, imovel - finLimitado),
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
  const { financiamentoMaximo, entradaMinima } = limitesLtv(imovel, ltvMax);
  return {
    parcela_alvo: pmt,
    valor_financiamento: financiamentoMaximo,
    valor_imovel: imovel,
    valor_entrada: entradaMinima,
  };
}

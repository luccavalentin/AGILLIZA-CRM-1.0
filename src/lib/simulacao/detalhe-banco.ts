import { parseBRL } from "@/lib/simulacao/format";

/**
 * Tarifa de avaliação de garantia padrão (R$ 1.950), aplicada quando o banco
 * não informa o valor. É um custo à vista — não entra no valor financiado.
 */
export const TARIFA_AVALIACAO_GARANTIA_PADRAO = 1950;

/** Uma parcela do plano de pagamento (valores já convertidos em número). */
export interface ParcelaDetalhe {
  numero: number;
  data: string | null;
  amortizacao: number;
  juros: number;
  parcela: number;
  saldoDevedor: number;
}

/** Resumo detalhado de uma simulação bancária extraído do retorno bruto. */
export interface DetalheBanco {
  taxaJurosAno: number | null;
  taxaJurosMes: number | null;
  cet: number | null;
  valorImovel: number | null;
  valorFinanciamento: number | null;
  financiamentoTotal: number | null;
  valorEntrada: number | null;
  despesasFinanciadas: number | null;
  tarifaAvaliacao: number | null;
  iof: number | null;
  fgts: number | null;
  prazoMeses: number | null;
  sistemaAmortizacao: string | null;
  indexador: string | null;
  tipoParcela: string | null;
  primeiraParcela: number | null;
  ultimaParcela: number | null;
  somatorioParcelas: number | null;
  /** true quando o plano de parcelas foi calculado localmente pelo sistema de amortização. */
  parcelasEstimadas: boolean;
  parcelas: ParcelaDetalhe[];
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseBRL(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza o sistema de amortização retornado pelo banco para os termos conhecidos
 * (SAC / PRICE), removendo rótulos como "ATUALIZÁVEL TR/SAC".
 */
export function normalizarSistemaAmortizacao(
  apiValor: string | null | undefined,
  requisitado?: string | null,
): string {
  const up = (apiValor ?? "").toUpperCase();
  if (up.includes("PRICE")) return "PRICE";
  if (up.includes("SAC")) return "SAC";
  if (up === "S") return "SAC";
  if (up === "P") return "PRICE";
  if (requisitado === "P") return "PRICE";
  if (requisitado === "S") return "SAC";
  return "—";
}

/** Converte uma taxa anual (%) na taxa mensal equivalente (%) em juros compostos. */
function taxaMensalEquivalente(taxaAnoPct: number | null): number | null {
  if (taxaAnoPct == null || !(taxaAnoPct > 0)) return null;
  const mensal = (Math.pow(1 + taxaAnoPct / 100, 1 / 12) - 1) * 100;
  return Number.isFinite(mensal) ? mensal : null;
}

/**
 * Calcula o CET (Custo Efetivo Total) anual conforme Resolução Bacen 3.517.
 *
 * O CET é a taxa interna de retorno (mensal) que iguala o **valor líquido
 * efetivamente liberado ao tomador** (= valor financiado − IOF − tarifa de
 * avaliação − outros custos pagos à vista com recursos do financiamento) ao
 * valor presente de todas as parcelas (que já devem incluir juros, amortização,
 * seguros MIP/DFI e tarifa de administração mensal).
 *
 * Retorna a taxa anual em % ou null quando não há dados suficientes.
 */
export function calcularCET(
  valorLiberado: number | null | undefined,
  parcelas: { parcela: number }[] | null | undefined,
  custosAVista?: number | null,
): number | null {
  const bruto = valorLiberado ?? null;
  const fluxo = (parcelas ?? []).map((p) => p.parcela).filter((v) => v > 0);
  if (bruto == null || bruto <= 0 || fluxo.length === 0) return null;
  const descontos = Math.max(0, custosAVista ?? 0);
  const principal = bruto - descontos;
  if (!(principal > 0)) return null;

  const vpl = (i: number) =>
    fluxo.reduce((acc, parc, idx) => acc + parc / Math.pow(1 + i, idx + 1), -principal);

  let lo = 1e-9;
  let hi = 1;
  if (vpl(lo) < 0 || vpl(hi) > 0) return null;

  let mensal = 0;
  for (let k = 0; k < 200; k++) {
    mensal = (lo + hi) / 2;
    const v = vpl(mensal);
    if (Math.abs(v) < 1e-6) break;
    if (v > 0) lo = mensal;
    else hi = mensal;
  }

  const anual = (Math.pow(1 + mensal, 12) - 1) * 100;
  return Number.isFinite(anual) ? anual : null;
}

/** Primeiro vencimento padrão (mesmo dia do mês seguinte) quando o banco não informa a data. */
function primeiroVencimentoPadrao(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/** Soma `n` meses a uma data ISO (YYYY-MM-DD), devolvendo ISO. */
function addMeses(dataIso: string | null, n: number): string | null {
  if (!dataIso) return null;
  const base = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  base.setMonth(base.getMonth() + n);
  return base.toISOString().slice(0, 10);
}

/** Converte uma parcela crua do banco (campos em inglês) em ParcelaDetalhe. */
function mapParcela(p: Record<string, any>): ParcelaDetalhe {
  const amort = num(p.amortization ?? p.amortizationValue) ?? 0;
  const juros = num(p.interest ?? p.interestAmount) ?? 0;
  return {
    numero: Number(p.number ?? p.numberInstallment ?? 0),
    data: p.dueDate ?? p.amortizationDate ?? null,
    amortizacao: amort,
    juros,
    // Parcela pura do sistema de amortização (amortização + juros), sem seguros/tarifas.
    parcela: amort + juros,
    saldoDevedor: num(p.endingBalance ?? p.debitBalanceAmount) ?? 0,
  };
}

/**
 * Calcula o plano de pagamento completo e exato a partir do sistema de amortização
 * (SAC ou PRICE), do valor financiado, do prazo e da taxa mensal. Cada parcela é
 * composta apenas por amortização + juros (sem seguros ou tarifas).
 */
function calcularPlano(
  principal: number,
  n: number,
  taxaMesPct: number,
  sistema: string,
  dataInicial: string | null,
): ParcelaDetalhe[] {
  if (!(principal > 0) || !(n > 0) || !(taxaMesPct > 0)) return [];
  const i = taxaMesPct / 100;
  const price = sistema === "PRICE";
  const parcelaFixa = price ? (principal * i) / (1 - Math.pow(1 + i, -n)) : 0;
  const amortSac = principal / n;

  const parcelas: ParcelaDetalhe[] = [];
  let saldo = principal;
  for (let k = 1; k <= n; k++) {
    const juros = saldo * i;
    let amort = price ? parcelaFixa - juros : amortSac;
    // Ajuste da última parcela para zerar o saldo devedor exatamente.
    if (k === n) amort = saldo;
    const total = amort + juros;
    saldo = Math.max(0, saldo - amort);
    parcelas.push({
      numero: k,
      data: addMeses(dataInicial, k - 1),
      amortizacao: amort,
      juros,
      parcela: total,
      saldoDevedor: saldo,
    });
  }
  return parcelas;
}

/** Extrai o detalhamento (parcelas, CET, taxas...) do raw_response de um banco. */
export function extrairDetalheBanco(raw: unknown): DetalheBanco | null {
  if (!raw || typeof raw !== "object") return null;
  const base = raw as Record<string, any>;
  const r = (base.simulacao ?? base.data ?? base.resultado ?? base) as Record<string, any>;
  const desc = (r.descricaoRespostaBanco ?? {}) as Record<string, any>;
  if ((!desc || typeof desc !== "object") && typeof r !== "object") return null;

  const sistema = normalizarSistemaAmortizacao(
    desc.amortizationType ?? r.codigoSistemaAmortizacaoBanco ?? r.codigoSistemaAmortizacaoSimulacao,
    r.codigoSistemaAmortizacaoSimulacao,
  );

  const taxaAno = num(desc.annualRate) ?? num(r.taxaJurosAnoBanco) ?? num(r.taxaJurosAnoSimulacao);
  const taxaMes = num(desc.monthlyRate) ?? taxaMensalEquivalente(taxaAno);
  const prazo =
    num(desc.period) ?? num(r.prazoPagamentoBanco) ?? num(r.prazoPagamentoSimulacao);
  const valorFin =
    num(desc.loanAmount) ??
    num(r.valorTotalFinanciamento) ??
    num(r.valorFinanciamentoBanco) ??
    num(r.valorFinanciamentoSimulacao);

  const brutas: any[] = Array.isArray(desc.installments) ? desc.installments : [];
  let parcelas: ParcelaDetalhe[] = brutas.map(mapParcela).filter((p) => p.parcela > 0);
  let estimadas = false;

  // Se o banco não devolveu o plano completo, calculamos localmente pelo sistema de amortização.
  if (parcelas.length <= 2 && valorFin && prazo && taxaMes) {
    const dataInicial =
      (desc.firstInstallment?.dueDate as string) ??
      (brutas[0]?.dueDate as string) ??
      primeiroVencimentoPadrao();
    parcelas = calcularPlano(valorFin, prazo, taxaMes, sistema, dataInicial);
    estimadas = parcelas.length > 0;

    // A parcela calculada (amortização + juros) não inclui seguros (MIP/DFI) e
    // taxa de administração, por isso fica menor que a parcela real do banco.
    // Ajustamos cada parcela adicionando esses encargos (diferença entre a
    // parcela real informada pelo banco e a 1ª parcela calculada) para que o
    // plano bata exatamente com o valor da parcela do banco.
    const parcelaBanco = num(r.valorParcelaBanco) ?? num(desc.installmentValue);
    if (estimadas && parcelaBanco != null && parcelaBanco > 0) {
      const encargos = Math.round((parcelaBanco - parcelas[0].parcela) * 100) / 100;
      if (encargos > 0) {
        parcelas = parcelas.map((p) => ({
          ...p,
          parcela: Math.round((p.parcela + encargos) * 100) / 100,
        }));
      }
    }
  }

  // IOF e tarifa de avaliação são custos à vista (deduzidos do valor liberado
  // no cálculo do CET conforme Bacen).
  const iofValor = num(desc.iof?.totalValue ?? desc.iof?.value) ?? num(r.valorIofBanco) ?? 0;
  const tarifaAvaliacaoValor =
    num(desc.propertyEvaluation) ??
    num(desc.appraisalFee) ??
    num(desc.evaluationFee) ??
    num(desc.guaranteeEvaluationFee) ??
    num(r.valorTarifaAvaliacaoBanco) ??
    num(r.valorTarifaAvaliacaoGarantiaBanco) ??
    num(r.tarifaAvaliacaoGarantia) ??
    TARIFA_AVALIACAO_GARANTIA_PADRAO;
  const custosAVista = (iofValor || 0) + (tarifaAvaliacaoValor || 0);

  const somatorio = parcelas.length ? parcelas.reduce((s, p) => s + p.parcela, 0) : null;
  const cet =
    num(desc.cetAnnual) ??
    num(desc.cet) ??
    num(r.taxaCetAnoBanco) ??
    num(r.taxaCETAnoBanco) ??
    calcularCET(valorFin, parcelas, custosAVista);

  // Despesas financiadas = valor incorporado ao financiamento além do valor-base
  // (custos como ITBI, registro e tarifas embutidos na operação). O cálculo
  // correto é: financiamento TOTAL − financiamento BASE. Só quando nenhum desses
  // valores está disponível recorremos ao valor explícito da API.
  const financiamentoBase =
    num(desc.valorFinanciamento) ??
    num(desc.loanAmount) ??
    num(r.valorFinanciamentoBanco) ??
    num(r.valorFinanciamentoSimulacao);
  const financiamentoTotalRaw =
    num(desc.valorTotalFinanciamento) ??
    num(r.valorTotalFinanciamento) ??
    valorFin;
  const despesasApi =
    num(r.valorDespesasFinanciadas) ??
    num(desc.valorDespesasFinanciadas) ??
    num(desc.expensesFinancedValue);
  const despesasDerivada =
    financiamentoTotalRaw != null && financiamentoBase != null
      ? Math.max(0, Math.round((financiamentoTotalRaw - financiamentoBase) * 100) / 100)
      : null;
  // Prioriza o valor explícito devolvido pelo banco (valorDespesasFinanciadas);
  // só recorre à derivação (total − base) quando a API não trouxe o campo.
  const despesasFinanciadas =
    despesasApi != null && despesasApi > 0
      ? despesasApi
      : (despesasDerivada ?? despesasApi);


  return {
    taxaJurosAno: taxaAno,
    taxaJurosMes: taxaMes,
    cet,
    valorImovel: num(desc.propertyPrice) ?? num(r.valorImovel),
    valorFinanciamento: valorFin,
    financiamentoTotal: num(r.valorTotalFinanciamento) ?? valorFin,
    valorEntrada: num(desc.downPayment) ?? num(r.valorEntrada),
    despesasFinanciadas,
    tarifaAvaliacao:
      num(desc.propertyEvaluation) ??
      num(desc.appraisalFee) ??
      num(desc.evaluationFee) ??
      num(desc.guaranteeEvaluationFee) ??
      num(r.valorTarifaAvaliacaoBanco) ??
      num(r.valorTarifaAvaliacaoGarantiaBanco) ??
      num(r.tarifaAvaliacaoGarantia) ??
      TARIFA_AVALIACAO_GARANTIA_PADRAO,
    iof: num(desc.iof?.totalValue ?? desc.iof?.value) ?? num(r.valorIofBanco),
    fgts: num(desc.fgtsAmount) ?? num(r.valorFgts),
    prazoMeses: prazo,
    sistemaAmortizacao:
      desc.amortizationType ?? r.codigoSistemaAmortizacaoBanco ?? r.codigoSistemaAmortizacaoSimulacao ?? null,
    indexador: r.codigoIndexadorBanco ?? desc.indexer ?? null,
    tipoParcela:
      r.codigoIndexadorBanco || desc.indexer
        ? `Atualizável ${(r.codigoIndexadorBanco ?? desc.indexer).toString().toUpperCase()}`
        : null,
    primeiraParcela: parcelas.length ? parcelas[0].parcela : num(r.valorParcelaBanco),
    ultimaParcela: parcelas.length ? parcelas[parcelas.length - 1].parcela : null,
    somatorioParcelas: somatorio,
    parcelasEstimadas: estimadas,
    parcelas,
  };
}

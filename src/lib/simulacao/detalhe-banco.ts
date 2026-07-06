import { parseBRL } from "@/lib/simulacao/format";

/** Uma parcela do plano de pagamento (valores já convertidos em número). */
export interface ParcelaDetalhe {
  numero: number;
  data: string | null;
  amortizacao: number;
  juros: number;
  seguroMip: number;
  seguroDfi: number;
  tarifa: number;
  parcela: number;
  saldoDevedor: number;
}

/** Resumo detalhado de uma simulação bancária extraído do retorno bruto. */
export interface DetalheBanco {
  taxaJurosAno: number | null;
  taxaJurosMes: number | null;
  cet: number | null;
  cesh: number | null;
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
  seguradora: string | null;
  primeiraParcela: number | null;
  ultimaParcela: number | null;
  somatorioParcelas: number | null;
  /** true quando o plano de parcelas foi projetado (o banco só devolveu 1ª/última). */
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

/**
 * Calcula o CET (Custo Efetivo Total) anual a partir do fluxo real de parcelas.
 * O CET é a taxa interna de retorno (mensal) que iguala o valor líquido liberado
 * ao valor presente de todas as parcelas (que já incluem juros, seguros e tarifas).
 * Retorna a taxa anual em % ou null quando não há dados suficientes.
 */
export function calcularCET(
  valorLiberado: number | null | undefined,
  parcelas: { parcela: number }[] | null | undefined,
): number | null {
  const principal = valorLiberado ?? null;
  const fluxo = (parcelas ?? []).map((p) => p.parcela).filter((v) => v > 0);
  if (principal == null || principal <= 0 || fluxo.length === 0) return null;

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
  return {
    numero: Number(p.number ?? p.numberInstallment ?? 0),
    data: p.dueDate ?? p.amortizationDate ?? null,
    amortizacao: num(p.amortization ?? p.amortizationValue) ?? 0,
    juros: num(p.interest ?? p.interestAmount) ?? 0,
    seguroMip: num(p.insurerMip ?? p.insuranceValueMip) ?? 0,
    seguroDfi: num(p.insurerDfi ?? p.insuranceValueDfi) ?? 0,
    tarifa: num(p.tac ?? p.tariffValue) ?? 0,
    parcela: num(p.totalValue ?? p.installmentValue) ?? 0,
    saldoDevedor: num(p.endingBalance ?? p.debitBalanceAmount) ?? 0,
  };
}

/**
 * Projeta o plano de pagamento quando o banco só devolve a 1ª e a última parcela.
 * Amortização, juros e saldo são calculados de forma exata a partir da taxa e do
 * sistema (SAC/PRICE); os seguros são interpolados linearmente entre os valores
 * âncora fornecidos pelo banco (1ª e última parcela).
 */
function projetarPlano(
  principal: number,
  n: number,
  taxaMesPct: number,
  sistema: string,
  first: Record<string, any> | null,
  last: Record<string, any> | null,
): ParcelaDetalhe[] {
  if (!(principal > 0) || !(n > 0) || !(taxaMesPct > 0)) return [];
  const i = taxaMesPct / 100;
  const price = sistema === "PRICE";
  const parcelaFixa = price ? (principal * i) / (1 - Math.pow(1 + i, -n)) : 0;
  const amortSac = principal / n;

  const mip0 = num(first?.insurerMip) ?? 0;
  const mipN = num(last?.insurerMip) ?? 0;
  const dfi0 = num(first?.insurerDfi) ?? 0;
  const dfiN = num(last?.insurerDfi) ?? 0;
  const tac = num(first?.tac) ?? 0;
  const dataInicial = (first?.dueDate as string) ?? null;

  const parcelas: ParcelaDetalhe[] = [];
  let saldo = principal;
  for (let k = 1; k <= n; k++) {
    const frac = n > 1 ? (k - 1) / (n - 1) : 0;
    const juros = saldo * i;
    const amort = price ? parcelaFixa - juros : amortSac;
    const mip = mip0 + (mipN - mip0) * frac;
    const dfi = dfi0 + (dfiN - dfi0) * frac;
    const total = amort + juros + mip + dfi + tac;
    saldo = Math.max(0, saldo - amort);
    parcelas.push({
      numero: k,
      data: addMeses(dataInicial, k - 1),
      amortizacao: amort,
      juros,
      seguroMip: mip,
      seguroDfi: dfi,
      tarifa: tac,
      parcela: total,
      saldoDevedor: saldo,
    });
  }
  return parcelas;
}

/** Extrai o detalhamento (parcelas, CET, CESH...) do raw_response de um banco. */
export function extrairDetalheBanco(raw: unknown): DetalheBanco | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  const desc = (r.descricaoRespostaBanco ?? {}) as Record<string, any>;
  if ((!desc || typeof desc !== "object") && typeof r !== "object") return null;

  const sistema = normalizarSistemaAmortizacao(
    desc.amortizationType ?? r.codigoSistemaAmortizacaoBanco,
    null,
  );

  const taxaAno = num(desc.annualRate) ?? num(r.taxaJurosAnoBanco);
  const taxaMes = num(desc.monthlyRate);
  const prazo =
    num(desc.period) ?? num(r.prazoPagamentoBanco) ?? num(r.prazoPagamentoSimulacao);
  const valorFin =
    num(desc.loanAmount) ??
    num(r.valorTotalFinanciamento) ??
    num(r.valorFinanciamentoBanco) ??
    num(r.valorFinanciamentoSimulacao);

  const brutas: any[] = Array.isArray(desc.installments) ? desc.installments : [];
  let parcelas: ParcelaDetalhe[] = brutas.map(mapParcela);
  let estimadas = false;

  if (parcelas.length === 0 && valorFin && prazo && taxaMes) {
    parcelas = projetarPlano(
      valorFin,
      prazo,
      taxaMes,
      sistema,
      desc.firstInstallment ?? null,
      desc.lastInstallment ?? null,
    );
    estimadas = parcelas.length > 0;
  }

  const somatorio =
    num(desc.installmentsTotalValue) ??
    (parcelas.length ? parcelas.reduce((s, p) => s + p.parcela, 0) : null);

  return {
    taxaJurosAno: taxaAno,
    taxaJurosMes: taxaMes,
    cet: num(desc.cetAnnual) ?? num(r.taxaCetAnoBanco),
    cesh: num(desc.ceshAnnual) ?? num(r.taxaCeshAnoBanco),
    valorImovel: num(desc.propertyPrice) ?? num(r.valorImovel),
    valorFinanciamento: valorFin,
    financiamentoTotal: num(r.valorTotalFinanciamento) ?? valorFin,
    valorEntrada: num(desc.downPayment),
    despesasFinanciadas: num(r.valorDespesasFinanciadas) ?? num(desc.expensesFinancedValue),
    tarifaAvaliacao: num(desc.propertyEvaluation),
    iof: num(desc.iof?.totalValue ?? desc.iof?.value) ?? num(r.valorIofBanco),
    fgts: num(desc.fgtsAmount) ?? num(r.valorFgts),
    prazoMeses: prazo,
    sistemaAmortizacao: desc.amortizationType ?? r.codigoSistemaAmortizacaoBanco ?? null,
    indexador: r.codigoIndexadorBanco ?? desc.indexer ?? null,
    tipoParcela:
      r.codigoIndexadorBanco || desc.indexer
        ? `Atualizável ${(r.codigoIndexadorBanco ?? desc.indexer).toString().toUpperCase()}`
        : null,
    seguradora: desc.insuranceType ?? desc.insurer ?? null,
    primeiraParcela: num(desc.firstInstallment?.totalValue) ?? num(r.valorParcelaBanco),
    ultimaParcela: num(desc.lastInstallment?.totalValue),
    somatorioParcelas: somatorio,
    parcelasEstimadas: estimadas,
    parcelas,
  };
}

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
  valorEntrada: number | null;
  despesasFinanciadas: number | null;
  iof: number | null;
  fgts: number | null;
  prazoMeses: number | null;
  sistemaAmortizacao: string | null;
  indexador: string | null;
  seguradora: string | null;
  primeiraParcela: number | null;
  ultimaParcela: number | null;
  somatorioParcelas: number | null;
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
  if (requisitado === "P") return "PRICE";
  if (requisitado === "S") return "SAC";
  return "—";
}

/** Extrai o detalhamento (parcelas, CET, CESH...) do raw_response de um banco. */
export function extrairDetalheBanco(raw: unknown): DetalheBanco | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  const desc = (r.descricaoRespostaBanco ?? r) as Record<string, any>;
  if (!desc || typeof desc !== "object") return null;

  const flow =
    desc.relatedFlow && Array.isArray(desc.relatedFlow.paymentPlan)
      ? desc.relatedFlow
      : desc.unrelatedFlow && Array.isArray(desc.unrelatedFlow.paymentPlan)
        ? desc.unrelatedFlow
        : Array.isArray(desc.paymentPlan)
          ? desc
          : (desc.unrelatedFlow ?? desc.relatedFlow ?? {});

  const plano: any[] = Array.isArray(flow.paymentPlan) ? flow.paymentPlan : [];

  const parcelas: ParcelaDetalhe[] = plano.map((p) => ({
    numero: Number(p.numberInstallment ?? 0),
    data: p.amortizationDate ?? null,
    amortizacao: num(p.amortizationValue) ?? 0,
    juros: num(p.interestAmount) ?? 0,
    seguroMip: num(p.insuranceValueMip) ?? 0,
    seguroDfi: num(p.insuranceValueDfi) ?? 0,
    tarifa: num(p.tariffValue) ?? 0,
    parcela: num(p.installmentValue) ?? 0,
    saldoDevedor: num(p.debitBalanceAmount) ?? 0,
  }));

  const somatorio = parcelas.length ? parcelas.reduce((s, p) => s + p.parcela, 0) : null;

  return {
    taxaJurosAno: num(flow.annualInterestRate),
    taxaJurosMes: num(flow.monthlyInterestRate),
    cet: num(flow.cetRate),
    cesh: num(flow.ceshRate),
    valorImovel: num(desc.propertyValue),
    valorFinanciamento: num(desc.financingValue ?? desc.totalFinancingValueWithExpenses),
    valorEntrada: num(desc.downPaymentAmount),
    despesasFinanciadas: num(desc.expensesFinancedValue),
    iof: num(desc.iofValue),
    fgts: num(desc.fgtsAmount),
    prazoMeses: num(desc.financingDeadlineInMonths ?? desc.maximumFinancingDeadlineInMonths),
    sistemaAmortizacao: desc.amortizationType ?? desc.paymentType ?? null,
    indexador: desc.trIndexer ?? null,
    seguradora: desc.insurer ?? null,
    primeiraParcela: num(flow.firstPaymentAmount),
    ultimaParcela: num(flow.lastPaymentAmount),
    somatorioParcelas: somatorio,
    parcelas,
  };
}

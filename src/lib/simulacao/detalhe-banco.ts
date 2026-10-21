import { parseBRL } from "@/lib/simulacao/format";
import { hojeISO, somarMesesISO } from "@/lib/financeiro/format";

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
  taxaNominalAno: number | null;
  cet: number | null;
  valorImovel: number | null;
  valorFinanciamento: number | null;
  valorTotalFinanciamento: number | null;
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
  /** 1ª parcela sem seguros/TAC, como o banco informou (Bradesco). */
  primeiraParcelaSemSeguro: number | null;
  ultimaParcela: number | null;
  somatorioParcelas: number | null;
  /** Seguro habitacional mensal informado pelo banco (MIP/DFI juntos). */
  seguroMensal: number | null;
  /** Taxa de administração mensal informada pelo banco. */
  taxaAdminMensal: number | null;
  /** Renda mínima exigida devolvida diretamente pelo banco (quando informada). */
  rendaMinimaExigida: number | null;
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
  // Prioridade: o sistema requisitado na simulação. O retorno da API é
  // usado apenas quando não há requisitado. Motivo: Santander (e alguns
  // outros) devolvem descrições padrão contendo "SAC" mesmo em simulações
  // executadas em PRICE.
  const req = (requisitado ?? "").toUpperCase();
  if (req === "P" || req.includes("PRICE")) return "PRICE";
  if (req === "S" || req.includes("SAC")) return "SAC";
  const up = (apiValor ?? "").toUpperCase();
  if (up.includes("PRICE")) return "PRICE";
  if (up.includes("SAC")) return "SAC";
  if (up === "S") return "SAC";
  if (up === "P") return "PRICE";
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
  // "Hoje" no fuso de Brasília: em UTC, depois das 21h, já seria o dia seguinte.
  return somarMesesISO(hojeISO(), 1);
}

/**
 * Soma `n` meses a uma data ISO (YYYY-MM-DD), devolvendo ISO. Mantém o dia ou
 * usa o último dia do mês (31/01 + 1 = 28/02); `setMonth` pulava para março.
 */
function addMeses(dataIso: string | null, n: number): string | null {
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}/.test(dataIso)) return null;
  return somarMesesISO(dataIso, n);
}

/** Aceita "dd/mm/aaaa" (Santander) ou ISO e devolve ISO (YYYY-MM-DD). */
function dataIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : s;
}

/** Converte uma parcela crua do banco (campos em inglês) em ParcelaDetalhe. */
function mapParcela(p: Record<string, any>): ParcelaDetalhe {
  const amort = num(p.amortization ?? p.amortizationValue) ?? 0;
  const juros = num(p.interest ?? p.interestAmount) ?? 0;
  // Quando o banco informa a prestação (Santander: installmentValue), ela já
  // traz seguros MIP/DFI e tarifa calculados mês a mês — usamos como está.
  const prestacao = num(p.installmentValue);
  return {
    numero: Number(p.number ?? p.numberInstallment ?? 0),
    data: dataIso(p.dueDate ?? p.amortizationDate),
    amortizacao: amort,
    juros,
    parcela: prestacao != null && prestacao > 0 ? prestacao : amort + juros,
    saldoDevedor: num(p.endingBalance ?? p.debitBalanceAmount) ?? 0,
  };
}

/** Trunca em centavos sem cair em erro de ponto flutuante (ex.: 0,29999...). */
function truncCentavos(v: number): number {
  return Math.floor(Math.round(v * 1e6) / 1e4) / 100;
}

/**
 * Calcula o plano de pagamento completo e exato a partir do sistema de amortização
 * (SAC ou PRICE), do valor financiado, do prazo e da taxa mensal. Cada parcela é
 * composta apenas por amortização + juros (sem seguros ou tarifas).
 *
 * `truncarCentavos`: regra do Itaú — no SAC a amortização é saldo ÷ meses
 * restantes e os juros saldo × taxa, ambos truncados no centavo (conferido
 * contra simulações reais do Itaú: 1ª e última parcela iguais às do banco).
 */
export function calcularPlano(
  principal: number,
  n: number,
  taxaMesPct: number,
  sistema: string,
  dataInicial: string | null,
  opts?: { truncarCentavos?: boolean },
): ParcelaDetalhe[] {
  if (!(principal > 0) || !(n > 0) || !(taxaMesPct > 0)) return [];
  const i = taxaMesPct / 100;
  const price = sistema === "PRICE";
  const trunc = opts?.truncarCentavos === true;
  const parcelaFixa = price ? (principal * i) / (1 - Math.pow(1 + i, -n)) : 0;
  const amortSac = principal / n;

  const parcelas: ParcelaDetalhe[] = [];
  let saldo = principal;
  for (let k = 1; k <= n; k++) {
    const juros = trunc ? truncCentavos(saldo * i) : saldo * i;
    let amort = price ? parcelaFixa - juros : trunc ? truncCentavos(saldo / (n - k + 1)) : amortSac;
    // Ajuste da última parcela para zerar o saldo devedor exatamente.
    if (k === n) amort = saldo;
    const total = amort + juros;
    saldo = Math.max(0, trunc ? Math.round((saldo - amort) * 100) / 100 : saldo - amort);
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

  // Prioriza o código do sistema efetivamente processado pelo banco
  // (codigoSistemaAmortizacaoBanco = "S" ou "P"). O texto descritivo
  // (amortizationType) fica só como fallback, porque bancos como o Santander
  // devolvem "ATUALIZAVEL TR/SAC" mesmo em simulações PRICE — se ele vencesse,
  // o cálculo local geraria parcelas SAC no PDF de uma simulação PRICE.
  const sistema = normalizarSistemaAmortizacao(
    desc.amortizationType,
    r.codigoSistemaAmortizacaoBanco ?? r.codigoSistemaAmortizacaoSimulacao,
  );

  // Bradesco devolve campos em português dentro de descricaoRespostaBanco:
  //   valorTaxaJurosEfetivoAno, valorTaxaNominal, valorCetAno, prazoFinanciamento,
  //   valorFinanciamento, valorTotalFinanciamento, valorPrimeiraPrestacaoComSeguroTac,
  //   valorUltimaPrestacao, valorSeguro, valorTaxaAdministracaoMensal,
  //   valorRendaLiquidaMinimaExigida.
  const taxaAno =
    num(desc.annualRate) ??
    num(desc.valorTaxaJurosEfetivoAno) ??
    num(r.taxaJurosAnoBanco) ??
    num(r.taxaJurosAnoSimulacao);
  const taxaNominalAno = num(desc.valorTaxaNominal);
  // Santander devolve o plano completo em unrelatedFlow/relationShipFlow.paymentPlan,
  // com MIP (proporcional ao saldo) e DFI separados por parcela.
  const fluxo = (desc.unrelatedFlow ?? desc.relationShipFlow) as Record<string, any> | undefined;
  const itau = desc.firstInstallment != null && desc.monthlyRate != null;
  // Taxa mensal exibida: a que o banco informa (Itaú monthlyRate, Santander
  // monthlyInterestRate). O Bradesco não manda taxa mensal; usa a equivalente
  // composta da efetiva anual (não a nominal/12, que dava parcela errada).
  const taxaMes =
    num(desc.monthlyRate) ??
    num(fluxo?.monthlyInterestRate) ??
    taxaMensalEquivalente(taxaAno) ??
    (taxaNominalAno != null ? taxaNominalAno / 12 : null);
  // Taxa usada no cálculo do plano, com a precisão que cada banco usa.
  // Conferido contra simulações reais: Bradesco = equivalente exata da efetiva
  // anual (3.000/3.000 parcelas iguais); Itaú = equivalente arredondada em
  // 8 casas decimais (2.000/2.000), que o banco exibe como 1,0868.
  const taxaEquivExata = taxaMensalEquivalente(taxaAno);
  const taxaCalculo =
    taxaEquivExata != null
      ? itau
        ? Math.round(taxaEquivExata * 1e6) / 1e6
        : taxaEquivExata
      : taxaMes;
  const prazo =
    num(desc.period) ??
    num(desc.prazoFinanciamento) ??
    // Santander: o prazo aceito pelo banco pode diferir do pedido.
    num(desc.financingDeadlineInMonths) ??
    num(r.prazoPagamentoBanco) ??
    num(r.prazoPagamentoSimulacao);
  const valorFin =
    // Itaú: saldo inicial da 1ª parcela = valor efetivamente financiado.
    num(desc.firstInstallment?.beginningBalance) ??
    num(desc.loanAmount) ??
    num(desc.valorTotalFinanciamento) ??
    num(desc.valorFinanciamento) ??
    num(r.valorTotalFinanciamento) ??
    num(r.valorFinanciamentoBanco) ??
    num(r.valorFinanciamentoSimulacao);

  // Valores reais devolvidos pelo banco (quando existirem) — usados como
  // âncora para primeira/última parcela e para não sobrescrever com estimativa.
  const primeiraParcelaApi =
    num(desc.valorPrimeiraPrestacaoComSeguroTac) ??
    num(desc.valorPrimeiraPrestacaoSemSeguroTac) ??
    num(desc.firstInstallment?.totalValue) ??
    num(fluxo?.firstPaymentAmount) ??
    num(r.valorParcelaBanco);
  // Bradesco: valorUltimaPrestacao; Itaú: lastInstallment.totalValue;
  // Santander: lastPaymentAmount.
  const ultimaParcelaApi =
    num(desc.valorUltimaPrestacao) ??
    num(desc.lastInstallment?.totalValue) ??
    num(fluxo?.lastPaymentAmount);
  // Seguros da 1ª parcela: Bradesco manda o total; Itaú manda MIP e DFI.
  const fi = desc.firstInstallment as Record<string, any> | undefined;
  const seguroItau =
    num(fi?.insurerMip) != null || num(fi?.insurerDfi) != null
      ? (num(fi?.insurerMip) ?? 0) + (num(fi?.insurerDfi) ?? 0)
      : null;
  const seguroMensalApi = num(desc.valorSeguro) ?? seguroItau;
  const fiAmort = num(fi?.amortization);
  const fiJuros = num(fi?.interest);
  const primeiraSemSeguroApi =
    num(desc.valorPrimeiraPrestacaoSemSeguroTac) ??
    (fiAmort != null && fiJuros != null ? Math.round((fiAmort + fiJuros) * 100) / 100 : null);
  const taxaAdminMensal = num(desc.valorTaxaAdministracaoMensal);
  const rendaMinimaExigida = num(desc.valorRendaLiquidaMinimaExigida);

  const brutas: any[] = Array.isArray(desc.installments)
    ? desc.installments
    : Array.isArray(fluxo?.paymentPlan)
      ? fluxo.paymentPlan
      : [];
  // A parcela 0 do Santander é só seguro cobrado na assinatura — não é prestação.
  let parcelas: ParcelaDetalhe[] = brutas
    .map(mapParcela)
    .filter((p) => p.amortizacao + p.juros > 0);
  let estimadas = false;

  // Se o banco não devolveu o plano completo, calculamos localmente pelo sistema de amortização.
  if (parcelas.length <= 2 && valorFin && prazo && taxaCalculo) {
    const dataInicial =
      (desc.firstInstallment?.dueDate as string) ??
      (brutas[0]?.dueDate as string) ??
      primeiroVencimentoPadrao();
    parcelas = calcularPlano(valorFin, prazo, taxaCalculo, sistema, dataInicial, {
      truncarCentavos: itau,
    });
    estimadas = parcelas.length > 0;

    // Bradesco e Itaú não devolvem o seguro (MIP/DFI) mês a mês — só o da 1ª
    // parcela. Não estimamos seguro: as parcelas projetadas são apenas
    // amortização + juros, e a 1ª/última parcela reais (com seguro) vêm nos
    // campos primeiraParcela/ultimaParcela, exatamente como o banco informou.
  }

  // Santander: seguros e parcela sem seguros vêm da 1ª linha do plano do banco.
  const linha1 = brutas.find((p) => num(p?.numberInstallment ?? p?.number) === 1) as
    Record<string, any> | undefined;
  const l1Mip = num(linha1?.insuranceValueMip);
  const l1Dfi = num(linha1?.insuranceValueDfi);
  const l1Amort = num(linha1?.amortizationValue);
  const l1Juros = num(linha1?.interestAmount);
  const seguroSantander = l1Mip != null || l1Dfi != null ? (l1Mip ?? 0) + (l1Dfi ?? 0) : null;
  const semSeguroSantander =
    l1Amort != null && l1Juros != null ? Math.round((l1Amort + l1Juros) * 100) / 100 : null;
  const seguroMensal = seguroMensalApi ?? seguroSantander;
  const primeiraParcelaSemSeguro = primeiraSemSeguroApi ?? semSeguroSantander;

  // IOF e tarifa de avaliação são custos à vista, só quando o banco informa.
  const iofValor =
    num(desc.iof?.totalValue ?? desc.iof?.value) ??
    num(desc.valorIof) ??
    num(desc.iofValue) ??
    num(r.valorIofBanco) ??
    0;
  const tarifaAvaliacaoValor =
    // Bradesco: valorTag = Tarifa de Avaliação de Garantia real do banco.
    num(desc.valorTag) ??
    num(desc.propertyEvaluation) ??
    num(desc.appraisalFee) ??
    num(desc.evaluationFee) ??
    num(desc.guaranteeEvaluationFee) ??
    // Santander: valuationFeeAmount.
    num(desc.valuationFeeAmount) ??
    num(r.valorTarifaAvaliacaoBanco) ??
    num(r.valorTarifaAvaliacaoGarantiaBanco) ??
    num(r.tarifaAvaliacaoGarantia);

  // Somatório: o total real do banco quando informado (Itaú). Em plano projetado
  // sem total do banco, a soma não teria os seguros — então não mostramos.
  const somatorio =
    num(desc.installmentsTotalValue) ??
    (parcelas.length && !estimadas ? parcelas.reduce((s, p) => s + p.parcela, 0) : null);
  const cet =
    num(desc.cetAnnual) ??
    num(desc.cet) ??
    num(r.taxaCetAnoBanco) ??
    num(r.taxaCETAnoBanco) ??
    // Bradesco: valorCetAno. Sem CET do banco fica vazio — a projeção não tem
    // seguros, então um CET calculado aqui sairia menor que o real.
    num(desc.valorCetAno);

  // Despesas financiadas = valor incorporado ao financiamento além do valor-base
  // (custos como ITBI, registro e tarifas embutidos na operação). O cálculo
  // correto é: financiamento TOTAL − financiamento BASE. Só quando nenhum desses
  // valores está disponível recorremos ao valor explícito da API.
  const financiamentoBase =
    num(desc.valorFinanciamento) ??
    num(desc.loanAmount) ??
    num(desc.financingValue) ??
    num(r.valorFinanciamentoBanco) ??
    num(r.valorFinanciamentoSimulacao);
  const financiamentoTotalRaw =
    num(desc.valorTotalFinanciamento) ??
    num(desc.totalFinancingValueWithExpenses) ??
    num(r.valorTotalFinanciamento) ??
    valorFin;
  const despesasApi =
    num(desc.valorTotalDespesasFinanceiras) ??
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
    despesasApi != null && despesasApi > 0 ? despesasApi : (despesasDerivada ?? despesasApi);

  const valorImovel =
    num(desc.propertyPrice) ??
    num(desc.valorImovel) ??
    num(desc.propertyValue) ??
    num(r.valorImovel);
  // Entrada = valor do imóvel − financiamento base (quando o banco não devolve).
  const entradaApi = num(desc.downPayment) ?? num(desc.downPaymentAmount) ?? num(r.valorEntrada);
  const entradaDerivada =
    valorImovel != null && financiamentoBase != null
      ? Math.max(0, Math.round((valorImovel - financiamentoBase) * 100) / 100)
      : null;
  const valorEntrada =
    entradaApi != null && entradaApi > 0 ? entradaApi : (entradaDerivada ?? entradaApi);

  return {
    taxaJurosAno: taxaAno,
    taxaJurosMes: taxaMes,
    taxaNominalAno,
    cet,
    valorImovel,
    valorFinanciamento: financiamentoBase ?? valorFin,
    valorTotalFinanciamento: financiamentoTotalRaw,
    financiamentoTotal: num(r.valorTotalFinanciamento) ?? valorFin,
    valorEntrada,
    despesasFinanciadas,
    tarifaAvaliacao: tarifaAvaliacaoValor,
    iof: iofValor || null,
    fgts: num(desc.fgtsAmount) ?? num(r.valorFgts),
    prazoMeses: prazo,
    sistemaAmortizacao:
      desc.amortizationType ??
      r.codigoSistemaAmortizacaoBanco ??
      r.codigoSistemaAmortizacaoSimulacao ??
      null,
    indexador: r.codigoIndexadorBanco ?? desc.indexer ?? null,
    tipoParcela:
      r.codigoIndexadorBanco || desc.indexer
        ? `Atualizável ${(r.codigoIndexadorBanco ?? desc.indexer).toString().toUpperCase()}`
        : null,
    // Preferir a parcela real informada pelo banco (Bradesco devolve
    // valorPrimeiraPrestacaoComSeguroTac / valorUltimaPrestacao) sobre a
    // estimativa local.
    primeiraParcela:
      primeiraParcelaApi ?? (parcelas.length ? parcelas[0].parcela : num(r.valorParcelaBanco)),
    primeiraParcelaSemSeguro,
    ultimaParcela:
      ultimaParcelaApi ?? (parcelas.length ? parcelas[parcelas.length - 1].parcela : null),
    somatorioParcelas: somatorio,
    seguroMensal,
    taxaAdminMensal,
    rendaMinimaExigida,
    parcelasEstimadas: estimadas,
    parcelas,
  };
}

/**
 * Divisão financiamento / despesas / entrada a exibir para um banco.
 *
 * Quando as despesas vão embutidas no financiamento (Santander sempre;
 * Bradesco e Itaú quando o pedido não é 5% — ver despesas-por-banco), o banco
 * devolve despesas 0 e o total como valor financiado. O total continua sendo o
 * do banco; a divisão e a entrada são as do pedido, que o banco aceitou
 * integralmente (total devolvido = financiamento + despesas pedidos).
 */
export function divisaoFinanciamento(
  d: DetalheBanco | null,
  s:
    | {
        fg_financiar_despesas?: boolean | null;
        valor_despesas_financiadas?: number | string | null;
        valor_financiamento?: number | string | null;
        valor_imovel?: number | string | null;
      }
    | null
    | undefined,
): {
  embutidas: boolean;
  valorSolicitado: number | null;
  despesas: number | null;
  entrada: number | null;
} {
  const despPedidas = s?.fg_financiar_despesas ? Number(s.valor_despesas_financiadas) || 0 : 0;
  const finPedido = Number(s?.valor_financiamento) || 0;
  const embutidas =
    despPedidas > 0 &&
    !(Number(d?.despesasFinanciadas) > 0) &&
    d?.valorTotalFinanciamento != null &&
    Math.abs(d.valorTotalFinanciamento - finPedido - despPedidas) < 0.005;
  if (!embutidas) {
    return {
      embutidas: false,
      valorSolicitado: d?.valorFinanciamento ?? null,
      despesas: d?.despesasFinanciadas ?? null,
      entrada: d?.valorEntrada ?? null,
    };
  }
  const imovel = d?.valorImovel ?? (Number(s?.valor_imovel) || null);
  return {
    embutidas: true,
    valorSolicitado: finPedido,
    despesas: despPedidas,
    entrada: imovel != null ? Math.round((imovel - finPedido) * 100) / 100 : null,
  };
}

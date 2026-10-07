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

/**
 * Calcula o plano de pagamento completo e exato a partir do sistema de amortização
 * (SAC ou PRICE), do valor financiado, do prazo e da taxa mensal. Cada parcela é
 * composta apenas por amortização + juros (sem seguros ou tarifas).
 */
export function calcularPlano(
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
  // Se o banco informa taxa nominal a.a., a taxa mensal é nominal/12 (regime
  // usado pelos bancos para calcular a parcela SAC/PRICE). Caso contrário,
  // deriva pela equivalência composta da taxa efetiva anual.
  const taxaMes =
    num(desc.monthlyRate) ??
    (taxaNominalAno != null ? taxaNominalAno / 12 : null) ??
    taxaMensalEquivalente(taxaAno);
  const prazo =
    num(desc.period) ??
    num(desc.prazoFinanciamento) ??
    num(r.prazoPagamentoBanco) ??
    num(r.prazoPagamentoSimulacao);
  const valorFin =
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
    num(r.valorParcelaBanco);
  // Bradesco: valorUltimaPrestacao; Itaú: lastInstallment.totalValue.
  const ultimaParcelaApi =
    num(desc.valorUltimaPrestacao) ?? num(desc.lastInstallment?.totalValue);
  const seguroMensal = num(desc.valorSeguro);
  const taxaAdminMensal = num(desc.valorTaxaAdministracaoMensal);
  const rendaMinimaExigida = num(desc.valorRendaLiquidaMinimaExigida);

  // Santander devolve o plano completo em unrelatedFlow/relationShipFlow.paymentPlan,
  // com MIP (proporcional ao saldo) e DFI separados por parcela.
  const fluxo = (desc.unrelatedFlow ?? desc.relationShipFlow) as Record<string, any> | undefined;
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
  if (parcelas.length <= 2 && valorFin && prazo && taxaMes) {
    const dataInicial =
      (desc.firstInstallment?.dueDate as string) ??
      (brutas[0]?.dueDate as string) ??
      primeiroVencimentoPadrao();
    parcelas = calcularPlano(valorFin, prazo, taxaMes, sistema, dataInicial);
    estimadas = parcelas.length > 0;

    // A parcela calculada (amortização + juros) não inclui seguros (MIP/DFI) e
    // taxa de administração. Esses encargos NÃO são fixos: o MIP é cobrado
    // sobre o saldo devedor e cai mês a mês até ~zero na última parcela
    // (Bradesco, Itaú e Santander). Somar o encargo da 1ª parcela em todas as
    // 420 inflava o total em dezenas de milhares de reais.
    // Modelo: encargo_k = fixo + variável × (saldo antes da parcela k / principal),
    // calibrado pela 1ª parcela real e por um segundo ponto do banco:
    //  - Itaú: somatório real das parcelas (installmentsTotalValue) — o MIP do
    //    Itaú sobe com a idade, então o encargo médio é maior que o da 1ª;
    //  - Bradesco: CET informado pelo banco (valorCetAno), que já embute o
    //    seguro de todas as parcelas; o MIP do Bradesco também sobe com a idade;
    //  - senão, última parcela real; sem nada, encargo proporcional ao saldo.
    // 1ª e última parcelas usam sempre o valor exato informado pelo banco.
    const parcelaBanco =
      num(r.valorParcelaBanco) ?? num(desc.installmentValue) ?? primeiraParcelaApi;
    if (estimadas && parcelaBanco != null && parcelaBanco > 0) {
      const n = parcelas.length;
      const e1 = parcelaBanco - parcelas[0].parcela;
      if (e1 > 0) {
        const ultimaReal =
          ultimaParcelaApi != null && ultimaParcelaApi > 0 ? ultimaParcelaApi : null;
        const ratio = parcelas.map((p) => (p.saldoDevedor + p.amortizacao) / valorFin);
        const totalBanco = num(desc.installmentsTotalValue);
        const cetBradesco = num(desc.valorCetAno);
        const base = parcelas;
        const montar = (variavel: number) =>
          base.map((p, k) => {
            const encargo = Math.max(0, e1 - variavel + variavel * ratio[k]);
            const exata = k === 0 ? parcelaBanco : k === n - 1 ? ultimaReal : null;
            return { ...p, parcela: Math.round((exata ?? p.parcela + encargo) * 100) / 100 };
          });

        let variavel = e1;
        let calibrado = false;
        if (totalBanco != null && totalBanco > 0 && n > 2) {
          // Encargos das parcelas 1..n-1 precisam fechar o total do banco
          // (a última entra pelo valor exato).
          const somaCalc = parcelas.slice(0, n - 1).reduce((s, p) => s + p.parcela, 0);
          const alvo = totalBanco - (ultimaReal ?? parcelas[n - 1].parcela) - somaCalc;
          const somaRatio = ratio.slice(0, n - 1).reduce((s, v) => s + v, 0);
          // alvo = (n-1)·fixo + variável·somaRatio, com fixo = e1 − variável
          const den = somaRatio - (n - 1);
          if (alvo > 0 && den !== 0) {
            variavel = (alvo - (n - 1) * e1) / den;
            calibrado = true;
          }
        } else if (cetBradesco != null && cetBradesco > 0) {
          // Custos à vista do CET do Bradesco: tarifa de avaliação (valorTag) + IOF.
          const custos =
            (num(desc.valorTag) ?? TARIFA_AVALIACAO_GARANTIA_PADRAO) + (num(desc.valorIof) ?? 0);
          const cetCom = (v: number) => calcularCET(valorFin, montar(v), custos);
          // CET cai conforme "variável" sobe (menos seguro nas parcelas finais).
          let lo = -20 * e1;
          let hi = e1;
          const cLo = cetCom(lo);
          const cHi = cetCom(hi);
          if (cLo != null && cHi != null && cLo >= cetBradesco && cHi <= cetBradesco) {
            for (let it = 0; it < 60; it++) {
              const mid = (lo + hi) / 2;
              const c = cetCom(mid);
              if (c == null) break;
              if (c > cetBradesco) lo = mid;
              else hi = mid;
            }
            variavel = (lo + hi) / 2;
            calibrado = true;
          }
        }
        if (!calibrado && ultimaReal != null) {
          const eN = Math.max(0, ultimaReal - parcelas[n - 1].parcela);
          const rN = ratio[n - 1];
          if (rN < 1) variavel = (e1 - eN) / (1 - rN);
        }
        if (!Number.isFinite(variavel)) variavel = e1;

        parcelas = montar(variavel);
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
    num(desc.valorTotalFinanciamento) ?? num(r.valorTotalFinanciamento) ?? valorFin;
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
    despesasApi != null && despesasApi > 0 ? despesasApi : (despesasDerivada ?? despesasApi);

  const valorImovel = num(desc.propertyPrice) ?? num(r.valorImovel);
  // Entrada = valor do imóvel − financiamento base (quando o banco não devolve).
  const entradaApi = num(desc.downPayment) ?? num(r.valorEntrada);
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

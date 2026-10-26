/**
 * Ferramentas determinísticas do Consultor IA (C18): as contas saem daqui, calculadas,
 * nunca "chutadas" pelo modelo. Parcela SAC e PRICE, comprometimento de renda,
 * financiamento máximo pela renda e custos de aquisição (ITBI e cartório) com os
 * parâmetros da conta (tabela `consultor_ia_parametros` — nada fixo no código).
 *
 * Taxa: o banco anuncia a taxa EFETIVA ao ano (ou a nominal); a mensal equivalente é
 * (1 + a)^(1/12) − 1 para a efetiva e a / 12 para a nominal.
 *
 * Client-safe (a calculadora da tela usa as mesmas funções).
 */

export type SistemaAmortizacao = "SAC" | "PRICE";

export interface ParametrosCalculo {
  itbi_percentual: number;
  /** Alíquotas por município: [{ municipio, uf, percentual }]. */
  itbi_municipios: Array<{ municipio: string; uf: string; percentual: number }>;
  cartorio_percentual: number;
  avaliacao_banco: number;
  certidoes_valor: number;
  comprometimento_max_percentual: number;
  /** Taxa efetiva ao ano usada só quando a pergunta não traz taxa (null = perguntar). */
  taxa_referencia_anual: number | null;
}

const arred = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas;

export function taxaMensal(taxaAnualPct: number, tipo: "efetiva" | "nominal" = "efetiva"): number {
  const a = taxaAnualPct / 100;
  return tipo === "nominal" ? a / 12 : Math.pow(1 + a, 1 / 12) - 1;
}

export interface Simulacao {
  sistema: SistemaAmortizacao;
  valor_financiado: number;
  taxa_anual: number;
  taxa_mensal: number;
  meses: number;
  primeira_parcela: number;
  ultima_parcela: number;
  total_juros: number;
  total_pago: number;
  /** Parcelas de amostra: 1ª, 2ª, 3ª, 12ª, 60ª, 120ª… e a última (as que existirem). */
  amostra: Array<{
    mes: number;
    parcela: number;
    juros: number;
    amortizacao: number;
    saldo: number;
  }>;
}

function validar(valor: number, taxaAnual: number, meses: number) {
  if (!Number.isFinite(valor) || valor <= 0)
    throw new Error("Valor financiado precisa ser maior que zero.");
  if (!Number.isFinite(taxaAnual) || taxaAnual < 0 || taxaAnual > 60)
    throw new Error("Taxa anual fora da faixa (0% a 60%).");
  if (!Number.isInteger(meses) || meses < 1 || meses > 600)
    throw new Error("Prazo fora da faixa (1 a 600 meses).");
}

const MESES_AMOSTRA = new Set([1, 2, 3, 12, 24, 60, 120, 180, 240, 300, 360, 420]);

export function simular(
  sistema: SistemaAmortizacao,
  valor: number,
  taxaAnual: number,
  meses: number,
  tipoTaxa: "efetiva" | "nominal" = "efetiva",
): Simulacao {
  validar(valor, taxaAnual, meses);
  const i = taxaMensal(taxaAnual, tipoTaxa);
  let saldo = valor;
  let totalJuros = 0;
  let totalPago = 0;
  let primeira = 0;
  let ultima = 0;
  const amostra: Simulacao["amostra"] = [];
  const pricePmt = i === 0 ? valor / meses : (valor * i) / (1 - Math.pow(1 + i, -meses));
  const amortSac = valor / meses;
  for (let m = 1; m <= meses; m++) {
    const juros = saldo * i;
    let amort = sistema === "SAC" ? amortSac : pricePmt - juros;
    if (m === meses) amort = saldo; // fecha o saldo (arredondamento)
    const parcela = amort + juros;
    saldo = Math.max(0, saldo - amort);
    totalJuros += juros;
    totalPago += parcela;
    if (m === 1) primeira = parcela;
    if (m === meses) ultima = parcela;
    if (MESES_AMOSTRA.has(m) || m === meses) {
      amostra.push({
        mes: m,
        parcela: arred(parcela),
        juros: arred(juros),
        amortizacao: arred(amort),
        saldo: arred(saldo),
      });
    }
  }
  return {
    sistema,
    valor_financiado: arred(valor),
    taxa_anual: taxaAnual,
    taxa_mensal: arred(i * 100, 4),
    meses,
    primeira_parcela: arred(primeira),
    ultima_parcela: arred(ultima),
    total_juros: arred(totalJuros),
    total_pago: arred(totalPago),
    amostra,
  };
}

export function comprometimento(parcela: number, renda: number): number {
  if (!(renda > 0)) throw new Error("Renda precisa ser maior que zero.");
  return arred((parcela / renda) * 100);
}

/** Maior valor financiável cuja (1ª) parcela cabe no limite de comprometimento da renda. */
export function financiamentoMaximo(
  renda: number,
  taxaAnual: number,
  meses: number,
  sistema: SistemaAmortizacao,
  limitePct: number,
  tipoTaxa: "efetiva" | "nominal" = "efetiva",
): { parcela_maxima: number; valor_maximo: number } {
  if (!(renda > 0)) throw new Error("Renda precisa ser maior que zero.");
  validar(1, taxaAnual, meses);
  const parcelaMax = (renda * limitePct) / 100;
  const i = taxaMensal(taxaAnual, tipoTaxa);
  // PRICE: PV = PMT × (1 − (1+i)^−n) / i. SAC: 1ª parcela = PV/n + PV×i → PV = PMT / (1/n + i).
  const pv =
    sistema === "PRICE"
      ? i === 0
        ? parcelaMax * meses
        : (parcelaMax * (1 - Math.pow(1 + i, -meses))) / i
      : parcelaMax / (1 / meses + i);
  return { parcela_maxima: arred(parcelaMax), valor_maximo: arred(pv) };
}

export interface Custos {
  valor_imovel: number;
  itbi_percentual: number;
  itbi_origem: string;
  itbi: number;
  cartorio_percentual: number;
  cartorio: number;
  avaliacao_banco: number;
  certidoes: number;
  total: number;
}

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Custos de aquisição com os parâmetros da conta (ITBI por município quando cadastrado). */
export function custosAquisicao(
  valorImovel: number,
  p: ParametrosCalculo,
  municipio?: string | null,
): Custos {
  if (!(valorImovel > 0)) throw new Error("Valor do imóvel precisa ser maior que zero.");
  const mun = municipio
    ? p.itbi_municipios.find((m) => semAcento(m.municipio) === semAcento(municipio))
    : undefined;
  const itbiPct = mun ? mun.percentual : p.itbi_percentual;
  const itbi = (valorImovel * itbiPct) / 100;
  const cartorio = (valorImovel * p.cartorio_percentual) / 100;
  const total = itbi + cartorio + p.avaliacao_banco + p.certidoes_valor;
  return {
    valor_imovel: arred(valorImovel),
    itbi_percentual: itbiPct,
    itbi_origem: mun ? `${mun.municipio}/${mun.uf}` : "alíquota padrão da conta",
    itbi: arred(itbi),
    cartorio_percentual: p.cartorio_percentual,
    cartorio: arred(cartorio),
    avaliacao_banco: arred(p.avaliacao_banco),
    certidoes: arred(p.certidoes_valor),
    total: arred(total),
  };
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
export const pct = (n: number, casas = 2) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;

/** Tabela markdown da simulação (vai para o modelo e para a tela). */
export function simulacaoEmMarkdown(s: Simulacao): string {
  const linhas = s.amostra
    .map(
      (a) =>
        `| ${a.mes} | ${brl(a.parcela)} | ${brl(a.juros)} | ${brl(a.amortizacao)} | ${brl(a.saldo)} |`,
    )
    .join("\n");
  return (
    `**${s.sistema}** · ${brl(s.valor_financiado)} · ${pct(s.taxa_anual)} a.a. (${pct(s.taxa_mensal, 4)} a.m.) · ${s.meses} meses\n\n` +
    `| Mês | Parcela | Juros | Amortização | Saldo |\n|--:|--:|--:|--:|--:|\n${linhas}\n\n` +
    `Primeira parcela: **${brl(s.primeira_parcela)}** · última: **${brl(s.ultima_parcela)}** · ` +
    `juros totais: **${brl(s.total_juros)}** · total pago: **${brl(s.total_pago)}**`
  );
}

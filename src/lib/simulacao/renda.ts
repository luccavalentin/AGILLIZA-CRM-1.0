/**
 * Regra de renda mínima do financiamento habitacional (vigente em 2026).
 *
 * Bancos e a regra do SFH limitam o comprometimento de renda: a PRESTAÇÃO
 * mensal não pode ultrapassar ~30% da renda familiar bruta. A prestação usada
 * na análise é a primeira (maior) parcela do financiamento MAIS os encargos
 * obrigatórios (seguro MIP, seguro DFI e taxa de administração):
 *
 *   prestacao_total = primeira_parcela + MIP + DFI + taxa_admin
 *   renda_minima    = prestacao_total / 0,30
 *
 * A parcela incide sobre o VALOR FINANCIADO (preço − entrada − FGTS), nunca
 * sobre o valor cheio do imóvel. As APIs dos bancos aplicam o mesmo teto.
 *
 * SISTEMA PRICE — QUALIFICAÇÃO CONSERVADORA (regra Bradesco):
 * As parcelas do PRICE crescem ao longo do contrato (indexação TR + juros sobre
 * saldo). Para refletir a projeção interna do Bradesco, aplicamos comprometimento
 * máximo de 15% sobre a parcela inicial PRICE (equivalente a ~30% sobre o pico
 * projetado da parcela). Regra calibrada a partir de simulações oficiais do banco.
 */



import { extrairDetalheBanco } from "./detalhe-banco";
import { calcularSimulacao, type SistemaAmortizacao } from "./simulacao-rapida";

/** Percentual máximo da renda que pode ser comprometido com a parcela. */
export const COMPROMETIMENTO_MAX = 0.3;
/** Comprometimento máx no PRICE (Bradesco projeta pico da parcela → ~15% da inicial). */
export const COMPROMETIMENTO_MAX_PRICE = 0.15;

/**
 * Encargos mensais obrigatórios que os bancos SOMAM à parcela ao verificar o
 * comprometimento de renda (estimativas de mercado):
 *  - Seguro MIP (morte/invalidez): incide sobre o saldo devedor.
 *  - Seguro DFI (danos ao imóvel): incide sobre o valor do imóvel.
 *  - Taxa de administração mensal fixa.
 * A parcela "seca" (amortização + juros) subestima a renda exigida; os bancos
 * qualificam a renda contra a PRESTAÇÃO TOTAL, com estes encargos incluídos.
 */
export const TAXA_MIP_MES = 0.00028; // ~0,028% do saldo devedor/mês
export const TAXA_DFI_MES = 0.0001; // ~0,010% do valor do imóvel/mês
export const TAXA_ADMIN_MES = 25; // R$/mês


export interface AvaliacaoRenda {
  /** Primeira (maior) parcela estimada. */
  primeiraParcela: number;
  /** Renda familiar mensal mínima exigida para o valor informado. */
  rendaMinima: number;
  /** Percentual da renda informada comprometido com a parcela (0-1) ou null. */
  comprometimento: number | null;
  /** true = renda suficiente, false = insuficiente, null = renda não informada. */
  suficiente: boolean | null;
  /** Banco usado quando o cálculo vem do retorno real da integração bancária. */
  bancoNome?: string | null;
  /** Origem do cálculo exibido. */
  fonte?: "api_banco" | "estimativa_local";
}

export interface BancoRendaApi {
  nome_banco?: string | null;
  status_banco?: string | null;
  valor_parcela?: number | null;
  raw_response?: unknown;
}

function numeroPositivo(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function unwrapApiResponse(raw: unknown): Record<string, any> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  return (r.simulacao ?? r.data ?? r.resultado ?? r) as Record<string, any>;
}

/** Parcela que a integração retornou para o banco, já com os encargos do banco. */
export function parcelaExigidaPeloBanco(banco: BancoRendaApi): number | null {
  const raw = unwrapApiResponse(banco.raw_response);
  const detalhe = extrairDetalheBanco(raw ?? banco.raw_response);
  return (
    numeroPositivo(detalhe?.primeiraParcela) ??
    numeroPositivo(banco.valor_parcela) ??
    numeroPositivo(raw?.valorParcelaBanco) ??
    numeroPositivo(raw?.valorParcelaSimulacao) ??
    numeroPositivo(raw?.descricaoRespostaBanco?.installmentValue)
  );
}

/**
 * Renda exigida a partir dos retornos reais dos bancos.
 * Quando houver divergência entre instituições, usa a maior renda exigida.
 */
export function rendaMinimaPelosBancos(
  bancos: BancoRendaApi[] | null | undefined,
  rendaInformada?: number | null,
): AvaliacaoRenda | null {
  const candidatos = (bancos ?? [])
    .filter((b) => !b.status_banco || b.status_banco === "simulada")
    .map((b) => {
      const parcela = parcelaExigidaPeloBanco(b);
      if (!parcela) return null;
      // Se o banco devolveu a renda mínima diretamente (ex.: Bradesco em
      // valorRendaLiquidaMinimaExigida), usamos o valor exato da API.
      const raw = unwrapApiResponse(b.raw_response);
      const detalhe = extrairDetalheBanco(raw ?? b.raw_response);
      const rendaMinima =
        numeroPositivo(detalhe?.rendaMinimaExigida) ?? rendaMinimaParaParcela(parcela);
      return {
        bancoNome: b.nome_banco ?? null,
        primeiraParcela: parcela,
        rendaMinima,
      };
    })
    .filter((v): v is { bancoNome: string | null; primeiraParcela: number; rendaMinima: number } =>
      Boolean(v),
    )
    .sort((a, b) => b.rendaMinima - a.rendaMinima);

  const maior = candidatos[0];
  if (!maior) return null;
  const renda = rendaInformada && rendaInformada > 0 ? rendaInformada : null;
  return {
    ...maior,
    comprometimento: renda ? maior.primeiraParcela / renda : null,
    suficiente: renda == null ? null : renda >= maior.rendaMinima,
    fonte: "api_banco",
  };
}

/** Renda mínima a partir de uma parcela conhecida. */
export function rendaMinimaParaParcela(
  primeiraParcela: number,
  comprometimentoMax: number = COMPROMETIMENTO_MAX,
): number {
  if (!Number.isFinite(primeiraParcela) || primeiraParcela <= 0) return 0;
  return primeiraParcela / comprometimentoMax;
}

/**
 * Avalia a renda mínima necessária para financiar o imóvel informado.
 *
 * A parcela — e, portanto, a renda mínima — incide SOBRE O VALOR FINANCIADO
 * (preço do imóvel menos entrada + FGTS), nunca sobre o valor cheio do imóvel.
 * Usar o valor do imóvel como base superestima a parcela e a renda exigida.
 *
 * O valor do imóvel é usado apenas como fallback quando o valor financiado
 * não foi informado, pois não há como calcular a parcela sem uma base de crédito.
 */
export function avaliarRendaMinima(params: {
  valor_financiamento: number;
  prazo_meses: number;
  taxa_ano: number;
  sistema: SistemaAmortizacao;
  renda_informada?: number | null;
  /** Valor do imóvel — usado apenas como fallback se não houver valor financiado. */
  valor_imovel?: number | null;
}): AvaliacaoRenda | null {
  const { valor_financiamento, prazo_meses, taxa_ano, sistema, renda_informada, valor_imovel } =
    params;

  // Base do cálculo: valor financiado (correto). Cai para o valor do imóvel
  // apenas quando o financiado não foi informado.
  const base =
    Number.isFinite(valor_financiamento) && valor_financiamento > 0
      ? valor_financiamento
      : Number.isFinite(valor_imovel) && (valor_imovel ?? 0) > 0
        ? (valor_imovel as number)
        : 0;

  if (
    !Number.isFinite(base) ||
    base <= 0 ||
    !Number.isFinite(prazo_meses) ||
    prazo_meses <= 0
  ) {
    return null;
  }

  // Parcela usada para QUALIFICAÇÃO da renda:
  // - SAC: primeira parcela do próprio sistema (já é a maior) com teto 30%.
  // - PRICE: primeira parcela PRICE com teto 15% (equivale à projeção do pico
  //   pelo Bradesco: ~2,27x a inicial × 30% ≈ 15% da inicial).
  const { primeira_parcela: parcelaSistema } = calcularSimulacao({
    valor_financiamento: base,
    prazo_meses,
    taxa_ano,
    sistema,
  });

  // Encargos obrigatórios inclusos pelos bancos no comprometimento de renda.
  const valorImovelBase =
    Number.isFinite(valor_imovel) && (valor_imovel ?? 0) > 0 ? (valor_imovel as number) : base;
  const seguroMIP = base * TAXA_MIP_MES; // sobre o saldo devedor inicial (= valor financiado)
  const seguroDFI = valorImovelBase * TAXA_DFI_MES;
  const prestacaoTotal = parcelaSistema + seguroMIP + seguroDFI + TAXA_ADMIN_MES;

  const tetoComprometimento = sistema === "P" ? COMPROMETIMENTO_MAX_PRICE : COMPROMETIMENTO_MAX;
  const rendaMinima = rendaMinimaParaParcela(prestacaoTotal, tetoComprometimento);
  const renda = renda_informada && renda_informada > 0 ? renda_informada : null;

  return {
    primeiraParcela: parcelaSistema + seguroMIP + seguroDFI + TAXA_ADMIN_MES,
    rendaMinima,
    comprometimento: renda ? prestacaoTotal / renda : null,
    suficiente: renda == null ? null : renda >= rendaMinima,
    fonte: "estimativa_local",
  };
}


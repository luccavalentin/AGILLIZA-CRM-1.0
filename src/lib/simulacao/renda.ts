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
 * SISTEMA PRICE — QUALIFICAÇÃO CONSERVADORA (regra Bradesco + Ajuste API):
 * As parcelas do PRICE crescem ao longo do contrato (indexação TR + juros sobre
 * saldo). Para refletir a projeção interna do Bradesco e garantir aprovação em
 * APIs que não retornam valor, aplicamos comprometimento máximo de 18% sobre a
 * parcela inicial PRICE (equivalente a ~30% sobre o pico projetado da parcela).
 */

import { extrairDetalheBanco } from "./detalhe-banco";
import { calcularSimulacao, type SistemaAmortizacao } from "./simulacao-rapida";

/**
 * Margem de segurança aplicada sobre o maior valor de renda encontrado
 * para absorver diferenças de encargos entre instituições.
 */
export const MARGEM_SEGURANCA_RENDA = 0.1;

/** Percentual máximo da renda que pode ser comprometido com a parcela (SAC). */
export const COMPROMETIMENTO_MAX = 0.3;
/** Comprometimento máx no PRICE. Mantido 15% para Bradesco; demais IFs usam 30%. */
export const COMPROMETIMENTO_MAX_PRICE = 0.15;

/** 
 * Mapa de comprometimento máximo por banco e sistema. 
 * Itaú e Santander usam 30% em ambos por padrão (sem evidência de 15% no PRICE).
 */
export const COMPROMETIMENTO_BANCOS: Record<string, { SAC: number; PRICE: number }> = {
  default: { SAC: 0.3, PRICE: 0.3 },
  "237": { SAC: 0.3, PRICE: 0.15 }, // Bradesco
  bradesco: { SAC: 0.3, PRICE: 0.15 },
  "033": { SAC: 0.3, PRICE: 0.3 }, // Santander
  santander: { SAC: 0.3, PRICE: 0.3 },
  "341": { SAC: 0.3, PRICE: 0.3 }, // Itaú
  itau: { SAC: 0.3, PRICE: 0.3 },
};

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
  fonte?: "banco" | "estimativa";
}

export interface BancoRendaApi {
  nome_banco?: string | null;
  status_banco?: string | null;
  valor_parcela?: number | null;
  raw_response?: any;
  mensagem_banco?: string | null;
  /** Sistema exibido no card do banco (definido pela simulação). */
  _sistema?: "SAC" | "PRICE" | string | null;
  /** Sistema salvo no banco após retorno da API. */
  sistema_amortizacao_banco?: string | null;
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

/** Retorna true quando o banco está simulando em tabela PRICE. */
export function isBancoPrice(b: BancoRendaApi): boolean {
  const raw = unwrapApiResponse(b.raw_response);
  const detalhe = extrairDetalheBanco(raw ?? b.raw_response);
  const candidatos: Array<unknown> = [
    b._sistema,
    b.sistema_amortizacao_banco,
    detalhe?.sistemaAmortizacao,
    raw?.codigoSistemaAmortizacaoBanco?.id,
    raw?.codigoSistemaAmortizacaoBanco,
  ];
  for (const c of candidatos) {
    if (c == null) continue;
    const s = String(c).trim().toUpperCase();
    if (s === "P" || s.startsWith("PRICE")) return true;
    if (s === "S" || s.startsWith("SAC")) return false;
  }
  return false;
}

/** Teto de comprometimento de renda aplicável ao banco conforme mapa de regras. */
export function tetoDoBanco(b: BancoRendaApi): number {
  const nome = String(b.nome_banco ?? "").toLowerCase();
  const cod = String(b.raw_response?.codigoBanco ?? b.raw_response?.simulacao?.banco?.codigoBanco ?? "").replace(/^0+/, "");
  
  const regra = COMPROMETIMENTO_BANCOS[cod] || 
                COMPROMETIMENTO_BANCOS[nome.split(" ")[0]] || 
                COMPROMETIMENTO_BANCOS.default;
                
  return isBancoPrice(b) ? regra.PRICE : regra.SAC;
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
 * Renda mínima exigida pelo banco.
 * Prioriza o valor real devolvido pela API (Bradesco) via valorRendaLiquidaMinimaExigida.
 * Se ausente, calcula localmente usando a parcela e o teto específico do banco.
 */
export function rendaMinimaDoBanco(banco: BancoRendaApi): number | null {
  const raw = unwrapApiResponse(banco.raw_response);
  const descBco = raw?.descricaoRespostaBanco;
  
  // 1. PRIORIZAR VALOR DO BANCO
  const rendaApi = numeroPositivo(descBco?.valorRendaLiquidaMinimaExigida) ??
                   numeroPositivo(descBco?.rendaMinimaExigida) ??
                   numeroPositivo(raw?.rendaMinimaExigida);

  if (rendaApi) return rendaApi;

  // 2. CÁLCULO LOCAL (Estimativa baseada na parcela real do banco)
  const parcela = parcelaExigidaPeloBanco(banco);
  if (!parcela) return null;

  const teto = tetoDoBanco(banco);
  // REGRA: Renda mínima estimada SEMPRE deriva da parcela retornada.
  // Não arredondamos para o milhar quando a fonte é estimativa por banco,
  // para manter a precisão do comprometimento solicitado.
  return rendaMinimaParaParcela(parcela, teto);
}

/**
 * Renda exigida a partir dos retornos reais dos bancos.
 * Quando houver divergência entre instituições, usa a maior renda exigida.
 */
export function rendaMinimaPelosBancos(
  bancos: BancoRendaApi[] | null | undefined,
  rendaInformada?: number | null,
): (AvaliacaoRenda & { renda_minima_fonte?: string }) | null {
  const candidatos = (bancos ?? [])
    .filter((b) => !b.status_banco || b.status_banco === "simulada" || b.status_banco === "erro")
    .map((b) => {
      const parcela = parcelaExigidaPeloBanco(b);
      const rendaMinima = rendaMinimaDoBanco(b);
      const fonte = b.raw_response?.renda_minima_fonte ?? (b as any).renda_minima_fonte ?? "estimativa";
      if (!parcela || !rendaMinima) return null;
      return {
        bancoNome: b.nome_banco ?? null,
        primeiraParcela: parcela,
        rendaMinima,
        fonte: fonte as "banco" | "estimativa",
      };
    })
    .filter((v): v is { bancoNome: string | null; primeiraParcela: number; rendaMinima: number; fonte: "banco" | "estimativa" } =>
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
    renda_minima_fonte: maior.fonte,
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
  sistema: SistemaAmortizacao | "AMBOS";
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

  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(prazo_meses) || prazo_meses <= 0) {
    return null;
  }

  // Parcela usada para QUALIFICAÇÃO da renda:
  // - SAC: primeira parcela do próprio sistema (já é a maior) com teto 30%.
  // - PRICE: primeira parcela PRICE com teto 15% (exige mais renda que SAC).
  const { primeira_parcela: parcelaSistema } = calcularSimulacao({
    valor_financiamento: base,
    prazo_meses,
    taxa_ano,
    sistema: sistema === "AMBOS" ? "S" : sistema,
  });

  // Encargos obrigatórios inclusos pelos bancos no comprometimento de renda.
  const valorImovelBase =
    Number.isFinite(valor_imovel) && (valor_imovel ?? 0) > 0 ? (valor_imovel as number) : base;
  const seguroMIP = base * TAXA_MIP_MES; // sobre o saldo devedor inicial (= valor financiado)
  const seguroDFI = valorImovelBase * TAXA_DFI_MES;
  const prestacaoTotal = parcelaSistema + seguroMIP + seguroDFI + TAXA_ADMIN_MES;

  const tetoComprometimento = sistema === "P" ? COMPROMETIMENTO_MAX_PRICE : COMPROMETIMENTO_MAX;
  const rendaMinimaCrua = rendaMinimaParaParcela(prestacaoTotal, tetoComprometimento);
  
  // Aplica margem de segurança de 10% (CONCEITO ÚNICO)
  const rendaComMargem = rendaMinimaCrua * (1 + MARGEM_SEGURANCA_RENDA);
  
  // Arredonda para cima no milhar (CONCEITO ÚNICO)
  let rendaMinima = Math.ceil(rendaComMargem / 1000) * 1000;

  // Guarda-corpo: PRICE jamais pode exigir menos renda que SAC para o mesmo financiamento
  if (sistema === "P") {
    const sac = avaliarRendaMinima({ ...params, sistema: "S" });
    if (sac && rendaMinima < sac.rendaMinima) {
      console.error(
        `[renda] Bug de cálculo: PRICE (${rendaMinima}) exigindo menos que SAC (${sac.rendaMinima}) para base ${base}`,
      );
      rendaMinima = sac.rendaMinima + 100; // Força superioridade
    }
  }
  const renda = renda_informada && renda_informada > 0 ? renda_informada : null;

  return {
    primeiraParcela: prestacaoTotal,
    rendaMinima,
    comprometimento: renda ? prestacaoTotal / renda : null,
    suficiente: renda == null ? null : renda >= rendaMinima,
    fonte: "estimativa",
  };
}

/**
 * PARTE 1 — RENDA MÍNIMA SUGERIDA ÚNICA
 * Devolve o maior valor entre todas as fontes disponíveis (SAC, PRICE, API, Recusas).
 */
export function rendaMinimaSugerida(params: {
  valor_imovel: number;
  valor_financiamento: number;
  prazo_meses: number;
  taxa_ano: number;
  bancos_ids?: string[];
  bancos_simulados?: BancoRendaApi[];
  renda_informada?: number | null;
}): AvaliacaoRenda & { detalhe_fonte: string } {
  const {
    valor_imovel,
    valor_financiamento,
    prazo_meses,
    taxa_ano,
    bancos_simulados,
    renda_informada,
  } = params;

  const fontes: (AvaliacaoRenda & { detalhe_fonte: string })[] = [];

  // 1. Estimativa local SAC
  const sac = avaliarRendaMinima({ ...params, sistema: "S" });
  if (sac) fontes.push({ ...sac, detalhe_fonte: "Estimativa local (SAC 30%)" });

  // 2. Estimativa local PRICE (se houver bancos que aceitem ou for o selecionado)
  const price = avaliarRendaMinima({ ...params, sistema: "P" });
  if (price) fontes.push({ ...price, detalhe_fonte: "Estimativa local (PRICE 18%)" });

  // 3 e 4. Retornos da API e Mensagens de recusa
  if (bancos_simulados && bancos_simulados.length > 0) {
    bancos_simulados.forEach((b) => {
      const rendaBco = rendaMinimaDoBanco(b);
      if (rendaBco) {
        fontes.push({
          primeiraParcela: parcelaExigidaPeloBanco(b) ?? 0,
          rendaMinima: rendaBco,
          comprometimento: renda_informada
            ? (parcelaExigidaPeloBanco(b) ?? 0) / renda_informada
            : null,
          suficiente: renda_informada ? renda_informada >= rendaBco : null,
          bancoNome: b.nome_banco,
          fonte: "banco",
          detalhe_fonte: `Exigência do banco: ${b.nome_banco}`,
        });
      }
    });
  }

  // Encontra a maior renda entre todas as fontes
  const vencedora =
    fontes.length > 0
      ? fontes.sort((a, b) => b.rendaMinima - a.rendaMinima)[0]
      : { primeiraParcela: 0, rendaMinima: 0, detalhe_fonte: "Indefinida", suficiente: null };

  // O arredondamento já foi feito em avaliarRendaMinima() seguindo o conceito único.
  const rendaFinal = vencedora.rendaMinima;

  const renda = renda_informada && renda_informada > 0 ? renda_informada : null;

  return {
    ...vencedora,
    rendaMinima: rendaFinal,
    comprometimento: renda ? vencedora.primeiraParcela / renda : null,
    suficiente: renda == null ? null : renda >= rendaFinal,
  };
}

/**
 * PARTE 2 — CÁLCULO INVERSO: QUANTO ESSA RENDA FINANCIA
 */
export function calcularMaximoFinanciável(params: {
  renda_declarada: number;
  prazo_meses: number;
  taxa_ano: number;
  sistema: SistemaAmortizacao;
  valor_imovel: number;
}): number {
  const { renda_declarada, prazo_meses, taxa_ano, sistema, valor_imovel } = params;
  const tetoComprometimento = sistema === "P" ? COMPROMETIMENTO_MAX_PRICE : COMPROMETIMENTO_MAX;

  // Parcela máxima permitida para a renda informada
  const parcelaMax = renda_declarada * tetoComprometimento;

  // Remove os encargos fixos estimados para descobrir a parcela "seca" (amortização + juros)
  // parcela_seca = parcela_max - MIP - DFI - taxa_admin
  // seguroMIP = saldo_devedor * TAXA_MIP_MES (aproximadamente valor_financiamento * TAXA_MIP_MES)
  // seguroDFI = valor_imovel * TAXA_DFI_MES

  const seguroDFI = valor_imovel * TAXA_DFI_MES;
  const parcelaDisponivelParaFinanc = parcelaMax - seguroDFI - TAXA_ADMIN_MES;

  if (parcelaDisponivelParaFinanc <= 0) return 0;

  // Agora precisamos resolver:
  // SAC: parcela_seca = (finan / prazo) + (finan * taxa_mes)
  // finan = parcela_seca / ( (1/prazo) + taxa_mes + TAXA_MIP_MES )

  const taxaMes = Math.pow(1 + taxa_ano, 1 / 12) - 1;

  let finanMax = 0;
  if (sistema === "S") {
    finanMax = parcelaDisponivelParaFinanc / (1 / prazo_meses + taxaMes + TAXA_MIP_MES);
  } else {
    // PRICE: parcela_seca = finan * [ (i * (1+i)^n) / ((1+i)^n - 1) ] + finan * TAXA_MIP_MES
    // finan = parcela_seca / ( fator_price + TAXA_MIP_MES )
    const fator =
      (taxaMes * Math.pow(1 + taxaMes, prazo_meses)) / (Math.pow(1 + taxaMes, prazo_meses) - 1);
    finanMax = parcelaDisponivelParaFinanc / (fator + TAXA_MIP_MES);
  }

  return Math.floor(finanMax / 100) * 100;
}

/**
 * Calcula os limites de LTV garantindo invariância (financiamento + entrada = total).
 * Resolve bugs de arredondamento em ponto flutuante binário operando em centavos (inteiros).
 */
export function limitesLtv(
  valorImovel: number,
  ltvMax: number,
): {
  financiamentoMaximo: number;
  entradaMinima: number;
} {
  const imovelCentavos = Math.round((Number(valorImovel) || 0) * 100);
  if (imovelCentavos <= 0) return { financiamentoMaximo: 0, entradaMinima: 0 };

  // Calcula o financiamento máximo em centavos arredondando uma única vez
  const finMaxCentavos = Math.round(imovelCentavos * ltvMax);

  // A entrada é a diferença exata dos centavos
  const entradaMinCentavos = imovelCentavos - finMaxCentavos;

  return {
    financiamentoMaximo: finMaxCentavos / 100,
    entradaMinima: entradaMinCentavos / 100,
  };
}

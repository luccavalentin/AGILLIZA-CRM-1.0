import type { Form, Banco } from "./state";

/**
 * Helpers puros para regras de elegibilidade de bancos por operação/
 * produto/restrição especial. Todas as funções aqui são determinísticas
 * (sem estado nem side-effects) para permitir uso direto em `useMemo`.
 */

type BancoRef = { codigo_banco?: number | string | null; nome_banco?: string | null };

/** Bancos que operam pelo sistema PRICE (Tabela Price). Hoje: Bradesco (237) e Santander (33). */
export function aceitaPrice(b: BancoRef): boolean {
  const cod = String(b.codigo_banco ?? "").replace(/^0+/, "");
  const nome = (b.nome_banco ?? "").toLowerCase();
  return cod === "237" || cod === "33" || nome.includes("bradesco") || nome.includes("santander");
}

export function normalizarCodigoBanco(b: BancoRef): string {
  return String(b.codigo_banco ?? "").replace(/^0+/, "");
}

export function isSantander(b: BancoRef): boolean {
  const cod = normalizarCodigoBanco(b);
  const nome = (b.nome_banco ?? "").toLowerCase();
  return cod === "33" || nome.includes("santander");
}

export function isBradesco(b: BancoRef): boolean {
  const cod = normalizarCodigoBanco(b);
  const nome = (b.nome_banco ?? "").toLowerCase();
  return cod === "237" || nome.includes("bradesco");
}

export function isItau(b: BancoRef): boolean {
  const cod = normalizarCodigoBanco(b);
  const nome = (b.nome_banco ?? "").toLowerCase();
  return cod === "341" || nome.includes("itaú") || nome.includes("itau");
}

export interface RestricaoEspecial {
  ativo: boolean;
  motivo: string;
  isTerreno: boolean;
  isComercial: boolean;
  ltvMax: number;
  prazoMax: number;
  /** Apenas terreno restringe os bancos elegíveis a Bradesco. */
  apenasBradesco: boolean;
}

/**
 * Deriva a "restrição especial" a partir do formulário. Terreno/imóvel
 * comercial impõem LTV 70% e prazo máx. 240; terreno adicionalmente
 * restringe o pool de bancos a Bradesco.
 */
export function calcularRestricaoEspecial(f: Form, bancosSelecionados: Banco[] = []): RestricaoEspecial {
  const isTerreno = f.tipo_imovel === "TE" || f.tipo_imovel === "TC";
  const isComercial = f.uso_imovel === "C";
  const ativo = isTerreno || isComercial;
  const motivo = !ativo
    ? ""
    : isTerreno && isComercial
      ? "Terreno / Imóvel comercial"
      : isTerreno
        ? "Terreno"
        : "Imóvel comercial";

  let prazoMax = 240;
  if (isComercial) {
    // NOVA REGRA: Santander até 360, Bradesco e Itaú até 240.
    // O teto é o menor entre os bancos SELECIONADOS.
    const outrosBancos = bancosSelecionados.some(b => !isSantander(b));
    const temSantander = bancosSelecionados.some(b => isSantander(b));
    
    // Se só tem Santander, 360. Se tem outros ou não tem nenhum, 240 (conservador).
    if (temSantander && !outrosBancos) {
      prazoMax = 360;
    } else {
      prazoMax = 240;
    }
  }

  return {
    ativo,
    motivo,
    isTerreno,
    isComercial,
    ltvMax: 0.7,
    prazoMax,
    apenasBradesco: isTerreno,
  };
}

/**
 * Retorna `true` se o banco aceita a operação corrente. Regras:
 * - Home Equity: Itaú (341) não opera.
 * - Terreno: apenas Bradesco (237) opera.
 */
export function aceitaBancoNaOperacao(
  b: BancoRef,
  opts: { isHomeEquity: boolean; restricao: RestricaoEspecial },
): boolean {
  const cod = normalizarCodigoBanco(b);
  const nome = (b.nome_banco ?? "").toLowerCase();
  if (opts.isHomeEquity && isItau(b)) {
    return false;
  }
  if (opts.restricao.apenasBradesco) {
    return isBradesco(b);
  }
  return true;
}

/** Mensagem amigável explicando por que um banco específico foi bloqueado. */
export function mensagemBancoIncompativel(
  b: BancoRef,
  opts: { isHomeEquity: boolean; restricao: RestricaoEspecial },
): string {
  const cod = normalizarCodigoBanco(b);
  const nome = (b?.nome_banco ?? "").toLowerCase();
  if (opts.isHomeEquity && isItau(b)) {
    return "Home Equity: Itaú não opera este produto.";
  }
  if (opts.restricao.apenasBradesco) {
    return `${opts.restricao.motivo}: apenas Bradesco opera essa modalidade.`;
  }
  return "Banco incompatível com a operação selecionada.";
}

/** Prazo mínimo que o Bradesco aceita, em meses. */
export const PRAZO_MIN_BRADESCO = 180;

/**
 * Prazo mínimo exigido pelos bancos selecionados.
 *
 * Hoje só o Bradesco tem piso próprio (180 meses). Simular abaixo disso é
 * recusa certa — melhor barrar antes de gastar a consulta.
 */
export function prazoMinimoDosBancos(
  bancos: BancoRef[],
): { meses: number; bancos: string[] } | null {
  const comPiso = (bancos ?? []).filter((b) => isBradesco(b));
  if (comPiso.length === 0) return null;
  return {
    meses: PRAZO_MIN_BRADESCO,
    bancos: comPiso.map((b) => b.nome_banco ?? "Bradesco"),
  };
}

/**
 * Regras da simulação de pessoa jurídica.
 *
 * Hoje só o Bradesco opera PJ, e com limites próprios: financiamento de até
 * 70% do valor de compra e venda (contra 80% de PF) e prazo entre 180 e 240
 * meses. As despesas financiáveis seguem em 5% do valor do imóvel.
 */
export const REGRAS_PJ = {
  ltvMax: 0.7,
  prazoMin: 180,
  prazoMax: 240,
  pctDespesas: 5,
} as const;

/** Dos bancos disponíveis, os que operam pessoa jurídica. */
export function bancosQueOperamPJ<T extends BancoRef & { id: string }>(bancos: T[]): T[] {
  return (bancos ?? []).filter((b) => isBradesco(b));
}

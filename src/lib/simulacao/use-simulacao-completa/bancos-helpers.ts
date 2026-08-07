import type { Form } from "./state";

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
export function calcularRestricaoEspecial(f: Form): RestricaoEspecial {
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
  return {
    ativo,
    motivo,
    isTerreno,
    isComercial,
    ltvMax: 0.7,
    prazoMax: 240,
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
  const cod = String(b.codigo_banco ?? "").replace(/^0+/, "");
  const nome = (b.nome_banco ?? "").toLowerCase();
  if (opts.isHomeEquity && (cod === "341" || nome.includes("itaú") || nome.includes("itau"))) {
    return false;
  }
  if (opts.restricao.apenasBradesco) {
    return cod === "237" || nome.includes("bradesco");
  }
  return true;
}

/** Mensagem amigável explicando por que um banco específico foi bloqueado. */
export function mensagemBancoIncompativel(
  b: BancoRef,
  opts: { isHomeEquity: boolean; restricao: RestricaoEspecial },
): string {
  const cod = String(b?.codigo_banco ?? "").replace(/^0+/, "");
  const nome = (b?.nome_banco ?? "").toLowerCase();
  if (opts.isHomeEquity && (cod === "341" || nome.includes("itaú") || nome.includes("itau"))) {
    return "Home Equity: Itaú não opera este produto.";
  }
  if (opts.restricao.apenasBradesco) {
    return `${opts.restricao.motivo}: apenas Bradesco opera essa modalidade.`;
  }
  return "Banco incompatível com a operação selecionada.";
}

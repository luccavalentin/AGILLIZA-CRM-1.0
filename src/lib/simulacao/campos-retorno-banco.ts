/**
 * Condições que o banco devolveu na simulação, prontas para `simulacao_bancos`.
 *
 * Só parcela, taxa e CET eram gravados. Prazo, financiamento, IOF, indexador e
 * sistema de amortização ficavam só no `raw_response`, e as telas, que leem as
 * colunas, mostravam "—" ou o prazo pedido no lugar do que o banco aprovou
 * (conferência de 26/10/2026: ~6 mil simulações nessa situação).
 *
 * Mesmos campos que o sync de propostas já usa. Nada é estimado: o que o banco
 * não mandou fica de fora do objeto, e o update não apaga o que já estava.
 */
export function camposRetornoBanco(resp: any): Record<string, number | string> {
  const campos: Record<string, number | string> = {};
  if (!resp || typeof resp !== "object") return campos;

  const numero = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const texto = (v: unknown) => {
    const t = String(v ?? "").trim();
    return t ? t : null;
  };

  const prazo = numero(resp.prazoPagamentoBanco ?? resp.prazoPagamentoBancoMax);
  if (prazo != null && prazo > 0) campos.prazo_pagamento_max = prazo;

  const financiamento = numero(resp.valorFinanciamentoBanco ?? resp.valorFinanciamentoBancoMax);
  if (financiamento != null && financiamento > 0) campos.valor_financiamento_max = financiamento;

  // IOF zero é valor real do banco (isento), não ausência.
  const iof = numero(resp.valorIofBanco);
  if (iof != null && iof >= 0) campos.valor_iof = iof;

  const indexador = texto(resp.codigoIndexadorBanco);
  if (indexador) campos.codigo_indexador = indexador;

  const sistema = texto(resp.codigoSistemaAmortizacaoBanco);
  if (sistema) campos.sistema_amortizacao_banco = sistema;

  return campos;
}

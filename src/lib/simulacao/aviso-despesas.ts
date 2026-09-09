/**
 * Aviso de despesas financiadas descartadas pelo banco.
 *
 * O sistema manda `valorTotalFinanciamento` = financiamento + custas, e
 * Bradesco e Itaú devolvem exatamente esse total. O Santander devolve o
 * financiamento puro: a parcela vem calculada sobre um valor menor do que o
 * pedido, e nada no retorno diz isso.
 *
 * Caso real (SIM-005330, 09/09): pedido de R$ 262.500 + R$ 17.500 de custas.
 * Itaú devolveu R$ 280.000 e parcela de R$ 4.028,09; o Santander devolveu
 * R$ 262.500 e parcela de R$ 3.600,99 — R$ 427 a menos por uma parcela que
 * não cobre as custas.
 *
 * O aviso existe para o operador não levar essa parcela ao cliente achando
 * que ela inclui as despesas. Fica aqui, e não dentro do fluxo de envio,
 * porque a reconciliação (retorno assíncrono) precisa do mesmo texto.
 */

function formatarBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(v) || 0);
}

export function avisoDespesasDescartadas(params: {
  nomeBanco?: string | null;
  /** Financiamento + despesas, como foi enviado. */
  totalPedido: number;
  /** `valorTotalFinanciamento` que o banco devolveu. */
  totalRetornado: number;
  despesasFinanciadas: number;
}): string | null {
  const { totalPedido, totalRetornado, despesasFinanciadas } = params;
  if (!(despesasFinanciadas > 0)) return null;
  if (!(totalRetornado > 0)) return null;
  // Margem de um centavo: arredondamento do provedor não é divergência.
  if (!(totalRetornado < totalPedido - 0.01)) return null;

  return `Atenção: o ${params.nomeBanco ?? "banco"} calculou sobre ${formatarBRL(
    totalRetornado,
  )} e desconsiderou as despesas financiadas de ${formatarBRL(
    despesasFinanciadas,
  )}. A parcela real, com as despesas, será maior.`;
}

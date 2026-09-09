import { isSantander, type BancoRef } from "./use-simulacao-completa/bancos-helpers";

/**
 * Como as despesas financiadas (custas/ITBI) vão para cada banco.
 *
 * O contrato tem três campos: `valorFinanciamento`, `valorDespesasFinanciadas`
 * e `valorTotalFinanciamento` (a soma). Bradesco e Itaú respeitam o total —
 * pedimos 262.500 + 17.500 e a integração devolve 280.000, com a parcela
 * calculada em cima disso.
 *
 * O Santander não. Log da SIM-005331 (09/09/2026), passo a passo:
 *
 *   POST /simulacao        -> devolveu valorTotalFinanciamento: 280.000  ✅
 *   PUT  /simulacao/95607  -> devolveu valorTotalFinanciamento: 280.000  ✅
 *   POST /integracao       -> devolveu valorTotalFinanciamento: 262.500  ❌
 *
 * Ou seja: o valor é aceito e gravado, e na hora de integrar o adaptador do
 * Santander recalcula em cima de `valorFinanciamento`, jogando as custas
 * fora. A parcela sai R$ 427 abaixo da real (3.600,99 contra os 4.028,09 que
 * o Itaú devolveu para o mesmo caso).
 *
 * Não temos como mudar o adaptador do provedor. O que dá para fazer é pedir
 * ao Santander o valor que o cliente realmente vai dever: mandamos o total no
 * campo que ele lê, e zeramos os campos de despesa para não haver chance de
 * o valor ser somado duas vezes caso o provedor passe a considerá-los.
 *
 * O que muda na prática: o Santander passa a cotar sobre 280.000 em vez de
 * 262.500, e a parcela sobe — para o número certo. Como o LTV é calculado
 * sobre esse valor, uma operação no limite pode ser recusada ou reduzida pelo
 * banco: isso é a regra dele sobre o valor verdadeiro, e é melhor descobrir
 * na simulação do que na assinatura.
 */
export interface DespesasNoPayload {
  valorFinanciamento: number;
  valorDespesasFinanciadas: number;
  valorTotalFinanciamento: number;
  fgFinanciarDespesas: "S" | "N";
  /** true quando as custas foram embutidas no financiamento. */
  embutidas: boolean;
}

export function despesasParaOBanco(params: {
  banco: BancoRef;
  valorFinanciamento: number;
  valorDespesasFinanciadas: number;
}): DespesasNoPayload {
  const financiamento = Number(params.valorFinanciamento) || 0;
  const despesas = Number(params.valorDespesasFinanciadas) || 0;
  const total = financiamento + despesas;

  if (despesas > 0 && isSantander(params.banco)) {
    return {
      valorFinanciamento: total,
      valorDespesasFinanciadas: 0,
      valorTotalFinanciamento: total,
      fgFinanciarDespesas: "N",
      embutidas: true,
    };
  }

  return {
    valorFinanciamento: financiamento,
    valorDespesasFinanciadas: despesas,
    valorTotalFinanciamento: total,
    fgFinanciarDespesas: despesas > 0 ? "S" : "N",
    embutidas: false,
  };
}

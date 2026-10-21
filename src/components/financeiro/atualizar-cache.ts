import type { QueryClient } from "@tanstack/react-query";

/**
 * Depois de criar, editar, baixar, estornar, cancelar ou excluir uma conta, tudo
 * o que deriva dela fica velho: lista, cards de resumo, detalhe, KPIs do painel e
 * fluxo de caixa. Cada diálogo invalidava só parte dessas chaves e os cards
 * ficavam em R$ 0,00 até recarregar. Todas as consultas do financeiro começam
 * com "fin-": invalidar pelo prefixo não deixa nenhuma para trás.
 */
export function atualizarFinanceiro(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("fin-"),
  });
}

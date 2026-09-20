/**
 * Lê uma consulta inteira, em páginas, sem o teto invisível do PostgREST.
 *
 * O PostgREST devolve no máximo 1.000 linhas por resposta, e `.limit(5000)`
 * não muda isso: a consulta volta com mil linhas, sem erro nenhum. Foi assim
 * que a esteira escondeu 87 clientes e o card de volume simulado mostrou
 * R$ 411 mi em vez de R$ 2,43 bi (19/09/2026). Quem precisa do conjunto
 * completo usa esta função.
 *
 * `montar` precisa devolver uma consulta NOVA a cada chamada: o builder do
 * supabase-js guarda o `range` aplicado e não pode ser reaproveitado.
 *
 * Chegando ao teto de páginas com a última cheia, devolve ERRO em vez de um
 * resultado menor do que a realidade — número errado em silêncio é pior do
 * que uma tela que avisa.
 */
export const LOTE_PGRST = 1000;

export async function todasAsLinhas<T = any>(
  montar: () => any,
  maxLotes = 50,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const acumulado: T[] = [];
  for (let i = 0; i < maxLotes; i++) {
    const ini = i * LOTE_PGRST;
    const { data, error } = await montar().range(ini, ini + LOTE_PGRST - 1);
    if (error) return { data: acumulado, error };
    const linhas = (data ?? []) as T[];
    acumulado.push(...linhas);
    if (linhas.length < LOTE_PGRST) break;
    if (i === maxLotes - 1) {
      return {
        data: acumulado,
        error: {
          message: `A consulta passou de ${maxLotes * LOTE_PGRST} linhas e pararia no meio. Restrinja o filtro; se precisar do total, a conta tem de ser feita no banco.`,
        },
      };
    }
  }
  return { data: acumulado, error: null };
}

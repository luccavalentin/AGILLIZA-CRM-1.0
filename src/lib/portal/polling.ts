/**
 * Atualização periódica do portal do cliente. O portal não usa Supabase Auth
 * (sessão selada em cookie), então não há Realtime: as listas são consultadas
 * de tempos em tempos. Todas as telas que leem a mesma chave usam o mesmo
 * intervalo — o React Query aplica o menor entre os observadores, e um 3 s
 * esquecido em um componente valia para o portal inteiro. Com milhares de
 * clientes logados, cada segundo a menos aqui vira carga no servidor.
 *
 * Aba oculta não consulta (refetchIntervalInBackground: false); ao voltar, o
 * refetchOnWindowFocus sincroniza na hora.
 */
export const POLL_ATENDENTES_MS = 20_000;
export const POLL_MENSAGENS_MS = 15_000;

/** Para a consulta periódica enquanto a última tentativa deu erro. */
export function pollingPortal(ms: number) {
  return {
    refetchInterval: (q: { state: { status: string } }) =>
      q.state.status === "error" ? false : ms,
    refetchIntervalInBackground: false,
  } as const;
}

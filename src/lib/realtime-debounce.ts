/**
 * Coalescedor de invalidações de query em rajadas de eventos Realtime.
 *
 * Uma única mutação no banco (envio de proposta, mudança de status, chegada
 * de mensagem) costuma disparar múltiplos eventos `postgres_changes` em
 * milissegundos — trigger + update + insert em tabela filha. Sem coalescing,
 * cada evento re-executa todas as queries afetadas, causando pico de CPU no
 * cliente e refetch redundante.
 *
 * `createDebouncedInvalidator` retorna um par (agendar, cancelar) que agrupa
 * chamadas dentro da mesma janela (default 300ms) em uma única execução.
 */
export function createDebouncedInvalidator(fn: () => void, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, wait);
  };
  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return { schedule, cancel };
}

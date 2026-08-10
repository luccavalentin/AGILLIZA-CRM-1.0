import { redirect } from "@tanstack/react-router";
import { getMinhasPermissoes, type MinhasPermissoes } from "@/lib/permissions.functions";

/**
 * Cache em memória (por aba) das permissões efetivas do usuário.
 *
 * `assertModuloPermitido` roda no `beforeLoad` de ~43 rotas e também no
 * pré-carregamento por "intent" (hover/toque). Sem cache, cada navegação
 * disparava um novo round-trip ao servidor + 2-3 consultas ao banco só para
 * remontar o menu. Como esse subtree é `ssr: false`, o guard só executa no
 * cliente, onde há um único usuário — então um cache de módulo com TTL é
 * seguro e elimina a enxurrada de chamadas repetidas.
 */
const TTL_MS = 60_000;
let cache: { promise: Promise<MinhasPermissoes>; expira: number } | null = null;

function carregarPermissoes(): Promise<MinhasPermissoes> {
  const agora = Date.now();
  if (cache && cache.expira > agora) return cache.promise;

  const promise = getMinhasPermissoes().catch((err) => {
    // Falha não deve "colar" no cache: limpa para permitir nova tentativa.
    if (cache?.promise === promise) cache = null;
    throw err;
  });
  cache = { promise, expira: agora + TTL_MS };
  return promise;
}

/** Invalida o cache de permissões (ex.: logout ou troca de usuário). */
export function limparCachePermissoes(): void {
  cache = null;
}

/**
 * Garante que o usuário tenha permissão de visualização no módulo.
 * Chamado no `beforeLoad` das rotas internas; sem permissão -> /dashboard (sem tela de acesso negado).
 */
export async function assertModuloPermitido(
  modulo: string,
  /**
   * Módulos herdados aceitos como equivalentes. Usado quando um módulo é
   * desmembrado (ex.: `admin.compras` -> pedidos/aprovações) para não
   * revogar acesso de quem já tinha a permissão antiga.
   */
  equivalentes: string[] = [],
): Promise<void> {
  const perms = await carregarPermissoes();
  if (perms.todas) return;
  const aceitos = [modulo, ...equivalentes];
  if (!aceitos.some((m) => perms.chaves.includes(`${m}:view`))) {
    // Requisito de produto: usuário sem permissão NÃO deve ver "acesso negado".
    // O item já não aparece no menu (filter-nav); ao tentar a URL direta,
    // ele é levado silenciosamente para o início que todo interno acessa.
    throw redirect({ to: "/dashboard" });
  }
}

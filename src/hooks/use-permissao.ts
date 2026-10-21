import { useQuery } from "@tanstack/react-query";
import { getMinhasPermissoes } from "@/lib/permissions.functions";
import type { AcaoPermissao } from "@/integrations/supabase/exigir-permissao";

/**
 * A mesma matriz do menu (`["minhas-permissoes"]`, já em cache pelo shell), lida
 * por um botão. Serve para esconder o que o usuário não pode fazer; quem decide
 * de verdade é a função do servidor, com `exigirPermissao`.
 * Enquanto carrega, responde `false` — melhor o botão aparecer um instante
 * depois do que aparecer e recusar.
 */
export function usePermissao(modulo: string, acao: AcaoPermissao): boolean {
  const { data } = useQuery({
    queryKey: ["minhas-permissoes"],
    queryFn: () => getMinhasPermissoes(),
    staleTime: 5 * 60_000,
  });
  if (!data) return false;
  return data.todas || data.chaves.includes(`${modulo}:${acao}`);
}

/**
 * `true` quando a matriz já chegou. Serve para a tela não dizer "sem permissão" no
 * instante em que ela ainda está carregando (`usePermissao` responde `false` nesse meio-tempo).
 */
export function usePermissoesCarregadas(): boolean {
  const { data } = useQuery({
    queryKey: ["minhas-permissoes"],
    queryFn: () => getMinhasPermissoes(),
    staleTime: 5 * 60_000,
  });
  return !!data;
}

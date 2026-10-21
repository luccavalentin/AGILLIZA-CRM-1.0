import { useQuery } from "@tanstack/react-query";
import { getMinhasPermissoes } from "@/lib/permissions.functions";
import type { ContaTipo } from "@/lib/financeiro/financeiro.functions";

export interface PermissoesConta {
  criar: boolean;
  editar: boolean;
  baixar: boolean;
}

/**
 * O que o usuário pode fazer nas contas a pagar/receber, pela mesma matriz do
 * menu (cache `["minhas-permissoes"]`). Só esconde botões: quem decide é o
 * servidor (`exigirAcaoConta` em financeiro.functions). Lê a matriz direto porque
 * `usePermissao` não aceita a ação "baixar".
 */
export function usePermissoesConta(tipo: ContaTipo): PermissoesConta {
  const { data } = useQuery({
    queryKey: ["minhas-permissoes"],
    queryFn: () => getMinhasPermissoes(),
    staleTime: 5 * 60_000,
  });
  const modulo = tipo === "pagar" ? "financeiro.contas_pagar" : "financeiro.contas_receber";
  const tem = (acao: string) =>
    !!data && (data.todas || data.chaves.includes(`${modulo}:${acao}`));
  return { criar: tem("create"), editar: tem("edit"), baixar: tem("baixar") };
}

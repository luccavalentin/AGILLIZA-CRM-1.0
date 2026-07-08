import { redirect } from "@tanstack/react-router";
import { getMinhasPermissoes } from "@/lib/permissions.functions";

/**
 * Garante que o usuário tenha permissão de visualização no módulo.
 * Chamado no `beforeLoad` das rotas internas; sem permissão -> /sem-acesso.
 */
export async function assertModuloPermitido(modulo: string): Promise<void> {
  const perms = await getMinhasPermissoes();
  if (perms.todas) return;
  if (!perms.chaves.includes(`${modulo}:view`)) {
    // Requisito de produto: usuário sem permissão NÃO deve ver "acesso negado".
    // O item já não aparece no menu (filter-nav); ao tentar a URL direta,
    // ele é levado silenciosamente para o início que todo interno acessa.
    throw redirect({ to: "/dashboard" });
  }
}

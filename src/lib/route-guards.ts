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
    throw redirect({ to: "/sem-acesso" });
  }
}

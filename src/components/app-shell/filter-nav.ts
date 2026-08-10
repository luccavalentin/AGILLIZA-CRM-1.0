import type { NavGroup, NavItem } from "./nav-config";
import type { MinhasPermissoes } from "@/lib/permissions.functions";

/** Constrói o Set de chaves de permissão a partir da resposta do servidor. */
export function permsToSet(perms: MinhasPermissoes | undefined): Set<string> {
  return new Set(perms?.chaves ?? []);
}

function itemVisivel(item: NavItem, perms: Set<string>, todas: boolean): boolean {
  if (!item.perm) return true;
  if (todas) return true;
  const aceitos = [item.perm.modulo, ...(item.perm.equivalentes ?? [])];
  return aceitos.some((m) => perms.has(`${m}:view`));
}

/**
 * Filtra a navegação pela matriz de permissões.
 * - Item sem `perm` é sempre exibido.
 * - Item com `perm`: some se o usuário não tiver `${modulo}:view`.
 * - Item com `children`: primeiro respeita a própria `perm` do pai; depois
 *   filtra filhos (filho sem `perm` herda a `perm` do pai). Sobrando zero
 *   filhos, o pai é removido.
 * - Grupo vazio após filtragem é omitido.
 */
export function filterNavByPermissions(
  nav: NavGroup[],
  perms: Set<string>,
  todas = false,
): NavGroup[] {
  const groups: NavGroup[] = [];

  for (const group of nav) {
    const items: NavItem[] = [];

    for (const item of group.items) {
      if (item.children && item.children.length > 0) {
        // O pai só aparece se sua própria permissão for atendida.
        if (!itemVisivel(item, perms, todas)) continue;
        const children = item.children.filter((c) =>
          itemVisivel({ ...c, perm: c.perm ?? item.perm }, perms, todas),
        );
        if (children.length > 0) items.push({ ...item, children });
        continue;
      }
      if (itemVisivel(item, perms, todas)) items.push(item);
    }

    if (items.length > 0) groups.push({ ...group, items });
  }

  return groups;
}

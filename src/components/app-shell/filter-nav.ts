import type { NavGroup, NavItem } from "./nav-config";
import type { MinhasPermissoes } from "@/lib/permissions.functions";

/** Constrói o Set de chaves de permissão a partir da resposta do servidor. */
export function permsToSet(perms: MinhasPermissoes | undefined): Set<string> {
  return new Set(perms?.chaves ?? []);
}

function itemVisivel(item: NavItem, perms: Set<string>, todas: boolean): boolean {
  if (!item.perm) return true;
  if (todas) return true;
  return perms.has(`${item.perm.modulo}:view`);
}

/**
 * Filtra a navegação pela matriz de permissões.
 * - Item sem `perm` é sempre exibido.
 * - Item com `children`: filtra filhos; se sobrar zero, remove o pai.
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
        const children = item.children.filter((c) => itemVisivel(c, perms, todas));
        if (children.length > 0) items.push({ ...item, children });
        continue;
      }
      if (itemVisivel(item, perms, todas)) items.push(item);
    }

    if (items.length > 0) groups.push({ ...group, items });
  }

  return groups;
}

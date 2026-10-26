import { navInterno } from "@/components/app-shell/nav-config";
import { CATALOGO_MODULOS } from "@/lib/admin/regras-modulos.functions";
import { agruparModulosPeloMenu, type GrupoDoMenu, type ModuloNoMenu } from "@/lib/admin/modulos-por-menu";

/**
 * Os módulos do catálogo agrupados como no menu (CRM, Operacional, … Configurações gerais).
 * Calculado uma vez: matriz de permissões, resumo da pessoa e cadastro rápido usam o mesmo.
 */
export const GRUPOS_DO_MENU: GrupoDoMenu[] = agruparModulosPeloMenu(CATALOGO_MODULOS, navInterno);

const POR_CHAVE = new Map<string, ModuloNoMenu>(
  GRUPOS_DO_MENU.flatMap((g) => g.modulos.map((m) => [m.modulo, m] as const)),
);

/** O módulo com o nome e o grupo do menu (ou `undefined` se não está no catálogo). */
export const moduloNoMenu = (modulo: string): ModuloNoMenu | undefined => POR_CHAVE.get(modulo);

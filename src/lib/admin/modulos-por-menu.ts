/**
 * Matriz de permissões agrupada pelo MENU (pedido do dono, 26/10/2026, item C68).
 *
 * Antes, cada módulo do catálogo trazia um grupo escrito à mão ("Administração",
 * "Documentos"…) que não acompanhava o menu reorganizado. Agora o grupo e o nome vêm do
 * próprio `navInterno`: a pessoa marca a permissão no mesmo lugar e com o mesmo nome em
 * que vê a tela. Nenhuma CHAVE de módulo muda — só onde e como ela aparece (módulo
 * renomeado no menu, como "Códigos de acesso" → "Servidor de e-mail", mantém a chave).
 *
 * Como cada módulo encontra o seu lugar, em ordem:
 *   1. item do menu que exige o módulo e cujo endereço contém o nome dele
 *      (`admin.parametros` → "Parâmetros" em `/admin/parametros`, e não a Base de
 *      Conhecimento que também usa a mesma permissão);
 *   2. o primeiro item do menu que exige o módulo;
 *   3. item que aceita o módulo como equivalente (`saas.lgpd` → "Auditoria e LGPD");
 *   4. item sem permissão cujo endereço contém o nome do módulo ("Automações");
 *   5. o grupo onde caiu a maioria dos módulos do mesmo prefixo (`rh.ferias` → RH);
 *   6. "Outros", no fim.
 */
import type { NavGroup, NavItem } from "@/components/app-shell/nav-config";
import type { ModuloCatalogo } from "@/lib/admin/regras-modulos.functions";

export const GRUPO_OUTROS = "Outros";

export interface ModuloNoMenu extends ModuloCatalogo {
  /** Grupo do menu em que o módulo aparece. */
  grupoMenu: string;
  /** Nome que a pessoa vê no menu (ou o do catálogo, se o módulo não tem item próprio). */
  rotuloMenu: string;
  /** Telas do menu que este módulo libera (rótulos, sem repetição). */
  telas: string[];
}

export interface GrupoDoMenu {
  grupo: string;
  modulos: ModuloNoMenu[];
}

interface Ocorrencia {
  grupo: string;
  grupoIndice: number;
  ordem: number;
  item: NavItem;
}

/** Último pedaço da chave, no formato de endereço (`fluxo_caixa` → `fluxo-caixa`). */
function trechoDaChave(modulo: string): string {
  const partes = modulo.split(".");
  return (partes[partes.length - 1] ?? modulo).replace(/_/g, "-").toLowerCase();
}

function enderecoContem(item: NavItem, modulo: string): boolean {
  return !!item.to && item.to.toLowerCase().includes(trechoDaChave(modulo));
}

/** Percorre o menu (grupos, itens e subitens) na ordem em que aparece. */
function percorrer(nav: NavGroup[]): Ocorrencia[] {
  const lista: Ocorrencia[] = [];
  let ordem = 0;
  nav.forEach((g, grupoIndice) => {
    const visitar = (itens: NavItem[]) => {
      for (const item of itens) {
        lista.push({ grupo: g.label, grupoIndice, ordem: ordem++, item });
        if (item.children?.length) visitar(item.children);
      }
    };
    visitar(g.items);
  });
  return lista;
}

/**
 * Agrupa o catálogo de módulos pelo menu. Devolve os grupos na ordem do menu (só os que
 * têm algum módulo), com "Outros" no fim quando sobrar módulo sem lugar.
 */
export function agruparModulosPeloMenu(
  catalogo: readonly ModuloCatalogo[],
  nav: NavGroup[],
): GrupoDoMenu[] {
  const ocorrencias = percorrer(nav);
  const indiceDoGrupo = new Map(nav.map((g, i) => [g.label, i]));

  const escolhido = new Map<string, { grupo: string; ordem: number; rotulo: string | null }>();
  const telas = new Map<string, string[]>();

  for (const mod of catalogo) {
    const primarias = ocorrencias.filter((o) => o.item.perm?.modulo === mod.modulo);
    const equivalentes = ocorrencias.filter(
      (o) => o.item.perm?.modulo !== mod.modulo && o.item.perm?.equivalentes?.includes(mod.modulo),
    );
    const semPermissao = ocorrencias.filter((o) => !o.item.perm && enderecoContem(o.item, mod.modulo));

    const peloEndereco = primarias.find((o) => enderecoContem(o.item, mod.modulo));
    const achada = peloEndereco ?? primarias[0] ?? equivalentes[0] ?? semPermissao[0];

    const nomes = [...new Set(primarias.map((o) => o.item.label))];
    telas.set(mod.modulo, nomes);

    if (achada) {
      let rotulo: string | null = null;
      if (achada === peloEndereco || achada === primarias[0]) {
        // Item que é só a "pasta" de um submenu nomeia mal a permissão: fica o nome do catálogo.
        if (!achada.item.children?.length) rotulo = achada.item.label;
        // Sem item "dono" pelo endereço, a permissão abre várias telas do mesmo grupo
        // ("Bancos" e "APIs de IA"): o nome diz as duas.
        if (!peloEndereco) {
          const irmas = [
            ...new Set(
              primarias
                .filter((o) => o.grupo === achada.grupo && !o.item.children?.length)
                .map((o) => o.item.label),
            ),
          ];
          if (irmas.length >= 2 && irmas.length <= 3) {
            rotulo = `${irmas.slice(0, -1).join(", ")} e ${irmas[irmas.length - 1]}`;
          }
        }
      } else if (achada !== equivalentes[0]) {
        rotulo = achada.item.label;
      }
      // Equivalente: o item é de outro módulo; o nome certo é o do catálogo.
      escolhido.set(mod.modulo, { grupo: achada.grupo, ordem: achada.ordem, rotulo });
    }
  }

  // 5. Prefixo: o grupo onde caiu a maioria dos módulos com o mesmo começo de chave.
  const grupoDoPrefixo = new Map<string, string>();
  {
    const contagem = new Map<string, Map<string, number>>();
    for (const [modulo, e] of escolhido) {
      const prefixo = modulo.split(".")[0];
      const porGrupo = contagem.get(prefixo) ?? new Map<string, number>();
      porGrupo.set(e.grupo, (porGrupo.get(e.grupo) ?? 0) + 1);
      contagem.set(prefixo, porGrupo);
    }
    for (const [prefixo, porGrupo] of contagem) {
      const melhor = [...porGrupo.entries()].sort(
        (a, b) => b[1] - a[1] || (indiceDoGrupo.get(a[0]) ?? 0) - (indiceDoGrupo.get(b[0]) ?? 0),
      )[0];
      if (melhor) grupoDoPrefixo.set(prefixo, melhor[0]);
    }
  }

  const porGrupo = new Map<string, { m: ModuloNoMenu; ordem: number; catalogo: number }[]>();
  catalogo.forEach((mod, i) => {
    const e = escolhido.get(mod.modulo);
    const grupo = e?.grupo ?? grupoDoPrefixo.get(mod.modulo.split(".")[0]) ?? GRUPO_OUTROS;
    const linha: ModuloNoMenu = {
      ...mod,
      grupoMenu: grupo,
      rotuloMenu: e?.rotulo ?? mod.label,
      telas: telas.get(mod.modulo) ?? [],
    };
    const arr = porGrupo.get(grupo) ?? [];
    // Sem item próprio no menu, o módulo vem depois dos que têm, na ordem do catálogo.
    arr.push({ m: linha, ordem: e?.ordem ?? Number.MAX_SAFE_INTEGER, catalogo: i });
    porGrupo.set(grupo, arr);
  });

  const ordemDosGrupos = [...porGrupo.keys()].sort((a, b) => {
    const ia = a === GRUPO_OUTROS ? Number.MAX_SAFE_INTEGER : (indiceDoGrupo.get(a) ?? Number.MAX_SAFE_INTEGER - 1);
    const ib = b === GRUPO_OUTROS ? Number.MAX_SAFE_INTEGER : (indiceDoGrupo.get(b) ?? Number.MAX_SAFE_INTEGER - 1);
    return ia - ib;
  });

  return ordemDosGrupos.map((grupo) => ({
    grupo,
    modulos: (porGrupo.get(grupo) ?? [])
      .sort((a, b) => a.ordem - b.ordem || a.catalogo - b.catalogo)
      .map((x) => x.m),
  }));
}

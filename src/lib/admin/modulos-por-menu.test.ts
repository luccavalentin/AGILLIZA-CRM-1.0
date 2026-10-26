import { describe, expect, it } from "vitest";
import { Gauge } from "lucide-react";
import { navInterno, type NavGroup } from "@/components/app-shell/nav-config";
import { CATALOGO_MODULOS, type ModuloCatalogo } from "./regras-modulos.functions";
import { GRUPO_OUTROS, agruparModulosPeloMenu } from "./modulos-por-menu";

const grupos = agruparModulosPeloMenu(CATALOGO_MODULOS, navInterno);
const onde = (modulo: string) => {
  for (const g of grupos) {
    const m = g.modulos.find((x) => x.modulo === modulo);
    if (m) return { grupo: g.grupo, rotulo: m.rotuloMenu, telas: m.telas };
  }
  return null;
};

describe("matriz de permissões agrupada pelo menu", () => {
  it("nenhum módulo some e nenhuma chave muda", () => {
    const chaves = grupos.flatMap((g) => g.modulos.map((m) => m.modulo));
    expect(chaves.length).toBe(CATALOGO_MODULOS.length);
    expect(new Set(chaves)).toEqual(new Set(CATALOGO_MODULOS.map((m) => m.modulo)));
    // As ações também ficam intactas.
    for (const g of grupos) {
      for (const m of g.modulos) {
        const original = CATALOGO_MODULOS.find((c) => c.modulo === m.modulo)!;
        expect(m.acoes).toEqual(original.acoes);
      }
    }
  });

  it("os grupos seguem a ordem do menu, com Outros no fim", () => {
    const ordemMenu = navInterno.map((g) => g.label);
    const nomes = grupos.map((g) => g.grupo);
    const semOutros = nomes.filter((n) => n !== GRUPO_OUTROS);
    const indices = semOutros.map((n) => ordemMenu.indexOf(n));
    expect(indices.every((i) => i >= 0)).toBe(true);
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
    if (nomes.includes(GRUPO_OUTROS)) expect(nomes[nomes.length - 1]).toBe(GRUPO_OUTROS);
  });

  it("os grupos pedidos pelo dono aparecem com o nome do menu", () => {
    const nomes = grupos.map((g) => g.grupo);
    for (const g of [
      "CRM",
      "Operacional",
      "Documentos diversos",
      "Financeiro",
      "Diversos",
      "Gestão de Pessoas e RH",
      "Relatórios gerenciais",
      "Gestão de sistemas",
      "Gestão de Tecnologia",
      "Configurações gerais",
    ]) {
      expect(nomes).toContain(g);
    }
    // Nomes antigos escritos à mão não voltam.
    expect(nomes).not.toContain("Administração");
    expect(nomes).not.toContain("Documentos");
  });

  it("cada módulo cai no lugar da tela dele no menu", () => {
    expect(onde("admin.parametros")).toMatchObject({ grupo: "Configurações gerais", rotulo: "Parâmetros" });
    expect(onde("admin.pessoas")).toMatchObject({ grupo: "Configurações gerais", rotulo: "Pessoas e permissões" });
    expect(onde("saas.provedores")).toMatchObject({ grupo: "Configurações gerais" });
    expect(onde("saas.integracoes")).toMatchObject({ grupo: "Configurações gerais" });
    expect(onde("saas.tecnologia")?.grupo).toBe("Gestão de Tecnologia");
    expect(onde("saas.licencas")).toMatchObject({ grupo: "Gestão de sistemas", rotulo: "Licenças e assinaturas" });
    expect(onde("saas.lgpd")?.grupo).toBe("Gestão de sistemas");
    expect(onde("admin.compras.pedidos")?.grupo).toBe("Diversos");
    expect(onde("documentos.formularios")?.grupo).toBe("Documentos diversos");
    expect(onde("crm.clientes")?.grupo).toBe("CRM");
    // Módulo renomeado no menu mantém a chave antiga, com o nome novo.
    expect(onde("operacional.codigos")).toMatchObject({ grupo: "Operacional", rotulo: "Servidor de e-mail" });
    // Sem item próprio: vai para o grupo dos irmãos de prefixo.
    expect(onde("rh.ferias")?.grupo).toBe("Gestão de Pessoas e RH");
    expect(onde("admin.regras")?.grupo).toBe("Configurações gerais");
    // Uma permissão que abre duas telas do mesmo grupo diz as duas.
    expect(onde("admin.integracoes")?.rotulo).toBe("Bancos e APIs de IA");
    // Achado só como equivalente: o nome é o do catálogo, não o do item de outro módulo.
    expect(onde("saas.lgpd")?.rotulo).toBe("LGPD da plataforma");
    expect(onde("saas.patrocinados")?.rotulo).not.toBe(onde("saas.imobmatch")?.rotulo);
  });

  it("lista as telas que cada permissão libera", () => {
    const formularios = onde("documentos.formularios")!;
    expect(formularios.telas).toContain("Formulários");
    expect(formularios.telas).toContain("Todos os checklists");
  });

  it("módulo sem lugar nenhum vai para Outros; pasta de submenu não dá nome", () => {
    const nav: NavGroup[] = [
      {
        id: "a",
        label: "Grupo A",
        items: [
          {
            label: "Pasta",
            icon: Gauge,
            to: "/a",
            perm: { modulo: "x.pasta" },
            children: [{ label: "Filho", icon: Gauge, to: "/a/filho", perm: { modulo: "x.filho" } }],
          },
        ],
      },
    ];
    const catalogo: ModuloCatalogo[] = [
      { modulo: "x.pasta", label: "Pasta do catálogo", grupo: "?", acoes: [{ acao: "view", label: "Ver" }] },
      { modulo: "x.filho", label: "Filho do catálogo", grupo: "?", acoes: [{ acao: "view", label: "Ver" }] },
      { modulo: "x.solto", label: "Solto", grupo: "?", acoes: [{ acao: "view", label: "Ver" }] },
      { modulo: "z.sem", label: "Sem lugar", grupo: "?", acoes: [{ acao: "view", label: "Ver" }] },
    ];
    const r = agruparModulosPeloMenu(catalogo, nav);
    expect(r.map((g) => g.grupo)).toEqual(["Grupo A", GRUPO_OUTROS]);
    expect(r[0].modulos.map((m) => [m.modulo, m.rotuloMenu])).toEqual([
      ["x.pasta", "Pasta do catálogo"],
      ["x.filho", "Filho"],
      ["x.solto", "Solto"],
    ]);
    expect(r[1].modulos.map((m) => m.modulo)).toEqual(["z.sem"]);
  });
});

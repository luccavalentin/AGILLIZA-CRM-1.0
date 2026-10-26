import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { navInterno, navParceiro, type NavItem } from "@/components/app-shell/nav-config";
import { ROTEIROS, roteiroDe } from "./roteiros";
import {
  FORMA_CHAVE,
  RESERVA_ANCORA,
  chaveDaTela,
  deveAbrirSozinho,
  passoInicial,
  posicionarCaixa,
} from "./rota";
import { telasValidas } from "./tour.functions";

/*
 * Tour guiado do Agilliza Correspondente. O teste de cobertura falha quando aparece item novo
 * no menu (da equipe, do parceiro ou do portal do cliente) sem roteiro em roteiros.ts.
 */

const RAIZ = join(__dirname, "..", "..", "..");

/** O caminho de verdade de um item do menu (`/checklists/$id` + params → `/checklists/abertura-itau`). */
function caminhoDoItem(item: NavItem): string {
  let to = item.to ?? "";
  for (const [k, v] of Object.entries(item.params ?? {})) to = to.replace(`$${k}`, v);
  return to;
}
function itensDoMenu(itens: NavItem[]): NavItem[] {
  return itens.flatMap((i) => [i, ...itensDoMenu(i.children ?? [])]);
}
const menuEquipe = [...navInterno, ...navParceiro].flatMap((g) => itensDoMenu(g.items));

/** Os destinos do menu do portal do cliente (o menu mora dentro do cliente-shell.tsx). */
const fonteShellCliente = readFileSync(join(RAIZ, "src/components/cliente/cliente-shell.tsx"), "utf8");
const menuCliente = [...new Set([...fonteShellCliente.matchAll(/to: "(\/cliente\/[a-z0-9/-]+)"/g)].map((m) => m[1]))];
/** As telas do portal do cliente (rotas `cliente.*.tsx`, menos a saída). */
const rotasCliente = readdirSync(join(RAIZ, "src/routes"))
  .filter((f) => /^cliente\.[a-z0-9.-]+\.tsx$/.test(f) && f !== "cliente.logout.tsx")
  .map((f) => "/" + f.replace(/\.tsx$/, "").replace(/\./g, "/"));

/** Todo `data-tour="..."` escrito no código (para conferir os alvos dos roteiros). */
function ancorasNoCodigo(): Set<string> {
  const achadas = new Set<string>();
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.tsx?$/.test(nome) && !nome.endsWith(".test.ts")) {
        const fonte = readFileSync(p, "utf8");
        for (const m of fonte.matchAll(/data-tour="([a-z0-9-]+)"/g)) achadas.add(m[1]);
        for (const m of fonte.matchAll(/tour="([a-z0-9-]+)"/g)) achadas.add(m[1]);
      }
    }
  };
  andar(join(RAIZ, "src"));
  return achadas;
}

describe("tour: chave da tela", () => {
  it("caminho vira chave com pontos; busca e barra final não contam", () => {
    expect(chaveDaTela("/operacional/propostas/kanban")).toBe("operacional.propostas.kanban");
    expect(chaveDaTela("/formularios/checklist?banco=itau")).toBe("formularios.checklist");
    expect(chaveDaTela("/cliente/visao-geral/")).toBe("cliente.visao-geral");
    expect(chaveDaTela("/news")).toBe("news");
  });
  it("tela de detalhe (id) e caminho torto não têm tour", () => {
    expect(chaveDaTela("/")).toBeNull();
    expect(chaveDaTela("")).toBeNull();
    expect(chaveDaTela("/operacional/propostas/3f2a9c1e-1b2c-4d5e-8f90-123456789abc")).toBeNull();
    expect(chaveDaTela("/crm/clientes/abcdef12-0000-4000-8000-000000000000")).toBeNull();
    expect(chaveDaTela("/rh/funcionarios/12345")).toBeNull();
    expect(chaveDaTela("/crm/Clientes")).toBeNull();
    expect(chaveDaTela("/crm/../admin")).toBeNull();
    expect(chaveDaTela("/a/" + "b".repeat(90))).toBeNull();
  });
  it("só chaves válidas, sem repetir e no máximo 40 vão ao banco", () => {
    const muitas = Array.from({ length: 60 }, (_, i) => `tela.n${String.fromCharCode(97 + (i % 26))}${i}`);
    expect(telasValidas(["a.b", "a.b", "X", "", "a b", "'; drop", ...muitas])).toHaveLength(40);
    expect(telasValidas(["a.b", "a.b", "X", "../x"])).toEqual(["a.b"]);
  });
});

describe("tour: abrir sozinho e retomar", () => {
  const roteiro = { versao: 2, passos: [{ titulo: "a", texto: "a" }, { titulo: "b", texto: "b" }] };
  it("primeira visita abre; desligado não abre", () => {
    expect(deveAbrirSozinho(roteiro, undefined, true)).toBe(true);
    expect(deveAbrirSozinho(roteiro, undefined, false)).toBe(false);
  });
  it("concluído ou pulado na mesma versão não abre; versão nova abre de novo", () => {
    expect(deveAbrirSozinho(roteiro, { versao: 2, estado: "concluido", passo: 1 }, true)).toBe(false);
    expect(deveAbrirSozinho(roteiro, { versao: 2, estado: "pulado", passo: 0 }, true)).toBe(false);
    expect(deveAbrirSozinho(roteiro, { versao: 1, estado: "concluido", passo: 1 }, true)).toBe(true);
  });
  it("quem parou no meio recomeça do passo salvo (dentro dos limites)", () => {
    expect(deveAbrirSozinho(roteiro, { versao: 2, estado: "andamento", passo: 1 }, true)).toBe(true);
    expect(passoInicial(roteiro, { versao: 2, estado: "andamento", passo: 1 })).toBe(1);
    expect(passoInicial(roteiro, { versao: 2, estado: "andamento", passo: 99 })).toBe(1);
    expect(passoInicial(roteiro, { versao: 1, estado: "andamento", passo: 1 })).toBe(0);
  });
});

describe("tour: posição da caixa", () => {
  const janela = { width: 1280, height: 800 };
  const caixa = { width: 360, height: 200 };
  it("embaixo se couber, em cima se não, centro sem alvo; nunca sai da tela", () => {
    expect(posicionarCaixa({ top: 100, left: 100, width: 200, height: 40 }, caixa, janela).lado).toBe("baixo");
    expect(posicionarCaixa({ top: 700, left: 100, width: 200, height: 40 }, caixa, janela).lado).toBe("cima");
    expect(posicionarCaixa(null, caixa, janela).lado).toBe("centro");
    const canto = posicionarCaixa({ top: 100, left: 1250, width: 30, height: 30 }, caixa, janela);
    expect(canto.left + caixa.width).toBeLessThanOrEqual(janela.width - 12);
  });
});

describe("tour: roteiros", () => {
  it("todo item do menu da equipe e do parceiro tem roteiro", () => {
    const sem = menuEquipe
      .map((i) => ({ rotulo: i.label, caminho: caminhoDoItem(i) }))
      .filter((i) => i.caminho && !roteiroDe(chaveDaTela(i.caminho)));
    expect(sem).toEqual([]);
  });
  it("todo item do menu do portal do cliente e toda tela cliente.* têm roteiro", () => {
    expect(menuCliente.length).toBeGreaterThanOrEqual(7);
    expect(rotasCliente.length).toBeGreaterThanOrEqual(7);
    const sem = [...menuCliente, ...rotasCliente].filter((c) => !roteiroDe(chaveDaTela(c)));
    expect(sem).toEqual([]);
  });
  it("chaves válidas, textos curtos, sem o nome da integração bancária", () => {
    for (const [chave, r] of Object.entries(ROTEIROS)) {
      expect(FORMA_CHAVE.test(chave), chave).toBe(true);
      expect(Number.isInteger(r.versao) && r.versao >= 1 && r.versao <= 1000, chave).toBe(true);
      expect(r.passos.length, chave).toBeGreaterThanOrEqual(2);
      expect(r.passos.length, chave).toBeLessThanOrEqual(8);
      for (const p of r.passos) {
        expect(p.titulo.length, `${chave}: ${p.titulo}`).toBeLessThanOrEqual(48);
        expect(p.texto.length, `${chave}: ${p.titulo}`).toBeLessThanOrEqual(220);
        expect(`${r.titulo} ${p.titulo} ${p.texto}`).not.toMatch(/home\s*fin/i);
      }
    }
  });
  it("todo alvo é uma âncora estável ou um data-tour que existe no código", () => {
    const noCodigo = ancorasNoCodigo();
    const estaveis = new Set(Object.keys(RESERVA_ANCORA));
    const orfaos = Object.entries(ROTEIROS).flatMap(([chave, r]) =>
      r.passos
        .map((p) => p.alvo)
        .filter((a): a is string => !!a && !estaveis.has(a) && !noCodigo.has(a))
        .map((a) => `${chave} → ${a}`),
    );
    expect(orfaos).toEqual([]);
    // Lê o src inteiro do disco: com a suíte toda rodando em paralelo passa dos 5 s padrão.
  }, 30_000);
});

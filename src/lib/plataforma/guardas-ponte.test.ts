/**
 * Trava permanente do teste adversarial de 23/10/2026: toda server function que
 * fala com a plataforma pela ponte (comPlataforma/comConta) ou lê os códigos de
 * acesso dos bancos precisa da guarda `exigirPermissao` com o módulo certo.
 *
 * A server function é um endereço HTTP que qualquer pessoa logada chama com o
 * próprio token — esconder o botão na tela não protege nada.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = join(__dirname, "..");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

interface ServerFn {
  arquivo: string;
  nome: string;
  guardas: string[];
  usaPonte: boolean;
  usaCodigos: boolean;
}

function varrer(): ServerFn[] {
  const out: ServerFn[] = [];
  for (const a of arquivos(RAIZ)) {
    const s = readFileSync(a, "utf8");
    if (!s.includes("createServerFn")) continue;
    // Middlewares nomeados: const VER = exigirPermissao([...]) / const ler = () => exigirPermissao(...)
    const nomes = new Map<string, string>();
    for (const m of s.matchAll(/const\s+(\w+)\s*=\s*(?:\(\)\s*=>\s*)?exigirPermissao\(([\s\S]*?)\);/g)) {
      nomes.set(m[1], m[2].replace(/\s+/g, ""));
    }
    const inicios = [...s.matchAll(/export\s+const\s+(\w+)\s*=\s*createServerFn\(/g)];
    inicios.forEach((m, i) => {
      const fim = i + 1 < inicios.length ? inicios[i + 1].index! : s.length;
      const bloco = s.slice(m.index!, fim);
      const h = bloco.indexOf(".handler(");
      const cab = h > 0 ? bloco.slice(0, h) : bloco;
      const corpo = h > 0 ? bloco.slice(h) : "";
      const mw = (cab.match(/\.middleware\(([\s\S]*)$/)?.[1] ?? "").replace(/\s+/g, "");
      const guardas = [
        ...[...mw.matchAll(/exigirPermissao\((.*?)\)\]/g)].map((x) => x[1]),
        ...[...nomes.entries()].filter(([n]) => mw.split(/[^A-Za-z0-9_]/).includes(n)).map(([, g]) => g),
      ];
      out.push({
        arquivo: relative(RAIZ, a).split(sep).join("/"),
        nome: m[1],
        guardas,
        usaPonte: /\bcom(Plataforma|Conta)\b/.test(corpo),
        usaCodigos: /codigos_(caixas|recebidos)/.test(corpo),
      });
    });
  }
  return out;
}

const todas = varrer();

describe("guardas das server functions da ponte", () => {
  it("encontra as server functions (sanidade da varredura)", () => {
    expect(todas.length).toBeGreaterThan(300);
    expect(todas.filter((f) => f.usaPonte).length).toBeGreaterThan(80);
  });

  it("toda server function da ponte tem exigirPermissao com módulo saas.*, marketing.automacoes ou financeiro.repasses", () => {
    const sem = todas
      .filter((f) => f.usaPonte)
      .filter((f) => !f.guardas.some((g) => /"(saas\.[a-z_]+|marketing\.automacoes|financeiro\.repasses)"/.test(g)))
      .map((f) => `${f.arquivo} › ${f.nome}`);
    expect(sem).toEqual([]);
  });

  it("a Gestão de Tecnologia pede saas.tecnologia; as Automações, marketing.automacoes", () => {
    const tec = todas.filter((f) => f.arquivo === "tecnologia/tecnologia.functions.ts");
    expect(tec.length).toBeGreaterThan(5);
    for (const f of tec) expect(f.guardas.join()).toContain('"saas.tecnologia"');
    const aut = todas.filter((f) => f.arquivo === "social/automacoes.functions.ts" && f.usaPonte);
    for (const f of aut) expect(f.guardas.join()).toContain('"marketing.automacoes"');
  });

  it("repasses aos assinantes (financeiro da matriz): só com financeiro.repasses e a ação certa", () => {
    const rp = todas.filter((f) => f.arquivo === "financeiro/repasses.functions.ts");
    expect(rp.length).toBeGreaterThanOrEqual(10);
    for (const f of rp) expect(f.guardas.join(), f.nome).toContain('"financeiro.repasses"');
    const acao = (nome: string) => rp.find((f) => f.nome === nome)!.guardas.join();
    expect(acao("pagarRepasse")).toContain('"pagar"');
    expect(acao("estornarPagamentoRepasse")).toContain('"pagar"');
    expect(acao("aprovarRepasses")).toContain('"aprovar"');
    expect(acao("definirRegraRepasse")).toContain('"regras"');
    expect(acao("cancelarRepasse")).toContain('"edit"');
  });

  it("códigos de acesso: só com operacional.codigos", () => {
    const cod = todas.filter((f) => f.usaCodigos || f.arquivo === "codigos/codigos.functions.ts");
    expect(cod.length).toBeGreaterThanOrEqual(4);
    for (const f of cod) expect(f.guardas.join()).toContain('"operacional.codigos"');
  });

  it("Gestão de Parceiros e Anúncios: ler pede saas.imobmatch; decidir pede saas.imobmatch edit", () => {
    const im = todas.filter((f) => f.arquivo === "plataforma/imobmatch.functions.ts");
    expect(im.length).toBeGreaterThanOrEqual(14);
    for (const f of im) expect(f.guardas.join()).toContain('"saas.imobmatch"');
    // Toda escrita (POST) exige a ação "edit" — ver não basta para moderar.
    const fonte = readFileSync(join(RAIZ, "plataforma/imobmatch.functions.ts"), "utf8");
    const posts = [...fonte.matchAll(/export const (\w+) = createServerFn\(\{ method: "POST" \}\)/g)].map(
      (m) => m[1],
    );
    expect(posts.length).toBeGreaterThanOrEqual(5);
    for (const nome of posts) {
      const f = im.find((x) => x.nome === nome)!;
      expect(f.guardas.join(), nome).toContain('"edit"');
    }
  });

  it("banners patrocinados: saas.patrocinados (preços: saas.planos edit); escrita exige edit", () => {
    const pt = todas.filter((f) => f.arquivo === "plataforma/patrocinados.functions.ts");
    expect(pt.length).toBeGreaterThanOrEqual(12);
    for (const f of pt) expect(f.guardas.join()).toMatch(/"saas\.(patrocinados|planos)"/);
    const fonte = readFileSync(join(RAIZ, "plataforma/patrocinados.functions.ts"), "utf8");
    const posts = [...fonte.matchAll(/export const (\w+) = createServerFn\(\{ method: "POST" \}\)/g)].map(
      (m) => m[1],
    );
    expect(posts.length).toBeGreaterThanOrEqual(6);
    for (const nome of posts) {
      const f = pt.find((x) => x.nome === nome)!;
      expect(f.guardas.join(), nome).toContain('"edit"');
      expect(f.guardas.join(), nome).not.toContain('"view"');
    }
    const precos = pt.filter((f) => f.nome === "salvarPacote" || f.nome === "salvarEspaco");
    expect(precos.length).toBe(2);
    for (const f of precos) expect(f.guardas.join()).toContain('"saas.planos"');
  });

  it("aprovar e reprovar criativo levam a versão que o moderador viu (0294 do Corretor)", () => {
    const fonte = readFileSync(join(RAIZ, "plataforma/patrocinados.functions.ts"), "utf8");
    expect(fonte).toContain("plataforma.patrocinio_aprovar($1, $2)");
    expect(fonte).toContain("plataforma.patrocinio_reprovar($1, $2, $3)");
    expect(fonte).not.toMatch(/patrocinio_aprovar\(\$1\)|patrocinio_reprovar\(\$1, \$2\)/);
    const fila = readFileSync(
      join(RAIZ, "../components/plataforma/imobmatch/banners-fila.tsx"),
      "utf8",
    );
    // D3 (0302 do Corretor): manda a versão que o moderador ANALISOU, e se o criativo mudar
    // com a tela aberta a decisão trava até ele conferir a prévia nova (novo clique consciente).
    expect(fila).toContain("versao: versaoVista");
    expect(fila).not.toContain("versao: c.versao");
    expect(fila).toContain("Analisei a versão nova");
    expect(fila).toMatch(/disabled=\{aprovar\.isPending \|\| mudou\}/);
  });

  it("Consultas: só ver lê o custo com cobranca.ler; registrar custo segue no edit (0303 do Corretor)", () => {
    const fonte = readFileSync(join(RAIZ, "plataforma/consultas.functions.ts"), "utf8");
    expect(fonte).toContain("seguranca.auth_e_plataforma('cobranca.ler')");
    const cs = todas.filter((f) => f.arquivo === "plataforma/consultas.functions.ts");
    const registrar = cs.find((f) => f.nome === "registrarCustoConsulta")!;
    expect(registrar.guardas.join()).toContain('"edit"');
  });

  it("comissões dos assinantes pedem saas.comissoes", () => {
    const com = todas.filter((f) => f.arquivo === "plataforma/comissoes-assinantes.functions.ts");
    expect(com.length).toBeGreaterThan(0);
    for (const f of com) expect(f.guardas.join()).toContain('"saas.comissoes"');
  });
});

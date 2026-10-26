/**
 * Auditoria de 26/10/2026 sobre a ponte (0493/0499 do Corretor): o contexto de quem não é
 * super_admin leva só as permissões do módulo. O teste 911 do Corretor abre a ponte com
 * cada módulo e chama, uma a uma, as funções do banco que a tela daquele módulo usa — a
 * lista de lá TEM de ser a deste código. Este teste refaz a varredura das server functions
 * da ponte (módulo do `exigirPermissao` → funções do banco no handler) e compara.
 *
 * Função nova numa tela da plataforma = uma linha nova em `__telas` no 911 (e, se ela pedir
 * outra permissão, no mapa `plataforma.permissoes_dos_modulos_agilliza`).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const RAIZ = join(__dirname, "..");
const PASTA_IRMAOS = join(__dirname, "..", "..", "..", "..");
const ARQ_911 = join("packages", "db", "testes", "911_ponte_so_o_modulo_e_gestor_com_saas.sql");

/** Ramo (HEAD) de uma worktree ou repositório: lê `.git/HEAD` ou o `gitdir:` da worktree. */
function ramoDe(pasta: string): string | null {
  try {
    const g = join(pasta, ".git");
    let dirGit = g;
    if (statSync(g).isFile()) {
      const m = readFileSync(g, "utf8").match(/^gitdir:\s*(.+)\s*$/m);
      if (!m) return null;
      dirGit = isAbsolute(m[1]) ? m[1] : join(pasta, m[1]);
    }
    const head = readFileSync(join(dirGit, "HEAD"), "utf8").trim();
    return head.startsWith("ref: ") ? head.slice(5) : head;
  } catch {
    return null;
  }
}

/**
 * O 911 que vale é o do Agilliza Tech no MESMO ramo deste repositório (as telas e a lista
 * andam juntas): `ECO_CORRETOR` se indicado; senão a pasta irmã do Agilliza Tech que está no
 * mesmo ramo; por último `CORRETOR 2.0` (o repositório principal).
 */
function acharTeste911(): string {
  if (process.env.ECO_CORRETOR) return join(process.env.ECO_CORRETOR, ARQ_911);
  const meu = ramoDe(join(__dirname, "..", "..", ".."));
  if (meu) {
    try {
      for (const d of readdirSync(PASTA_IRMAOS)) {
        if (!/^CORRETOR/.test(d)) continue;
        const p = join(PASTA_IRMAOS, d);
        if (ramoDe(p) === meu && existsSync(join(p, ARQ_911))) return join(p, ARQ_911);
      }
    } catch {
      /* sem irmãos legíveis: cai no padrão */
    }
  }
  return join(PASTA_IRMAOS, "CORRETOR 2.0", ARQ_911);
}
const TESTE_911 = acharTeste911();

/** Tabelas que aparecem como `esquema.tabela (` em listas de colunas de insert — não são funções. */
const NAO_SAO_FUNCOES = new Set([
  "plataforma.custos_fornecedor",
  "operacional.proposta_exigencias",
  "radar.noticias",
  "radar.posts",
  "nucleo.entitlements",
  "nucleo.planos",
  "nucleo.assinaturas",
  "nucleo.faturas_plataforma",
  "comunicacao.base_conhecimento",
]);

const ESQUEMAS =
  "plataforma|nucleo|seguranca|integracao|operacional|crm|social|comunicacao|auditoria|acesso|receita|financeiro|cobranca|rede|radar|portal|imoveis|ia|publico|lgpd";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

/** "módulo|esquema.função" de todas as server functions que falam com a plataforma. */
function paresDoCodigo(): Set<string> {
  const pares = new Set<string>();
  for (const a of arquivos(RAIZ)) {
    const s = readFileSync(a, "utf8");
    if (!s.includes("createServerFn")) continue;
    const nomes = new Map<string, string>();
    for (const m of s.matchAll(
      /const\s+(\w+)\s*=\s*(?:\(\)\s*=>\s*)?exigirPermissao\(([\s\S]*?)\);/g,
    )) {
      nomes.set(m[1], m[2]);
    }
    // Auxiliares do arquivo: o SQL delas conta para a server function que as chama.
    const aux = new Map<string, string>();
    for (const m of s.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(([\s\S]*?)\n\}/g))
      aux.set(m[1], m[0]);
    const inicios = [...s.matchAll(/export\s+const\s+(\w+)\s*=\s*createServerFn\(/g)];
    inicios.forEach((m, i) => {
      const fim = i + 1 < inicios.length ? inicios[i + 1].index! : s.length;
      const bloco = s.slice(m.index!, fim);
      const h = bloco.indexOf(".handler(");
      const cab = h > 0 ? bloco.slice(0, h) : bloco;
      let corpo = h > 0 ? bloco.slice(h) : "";
      if (!/\bcom(Plataforma|Conta)\b|\bponte\(context/.test(corpo)) return;
      for (const [n, txt] of aux) if (new RegExp(`\\b${n}\\(`).test(corpo)) corpo += "\n" + txt;
      const mw = cab.match(/\.middleware\(([\s\S]*)$/)?.[1] ?? "";
      const guardas = [...mw.matchAll(/exigirPermissao\(([\s\S]*?)\)\s*[\],]/g)].map((x) => x[1]);
      for (const [n, g] of nomes) if (mw.split(/[^A-Za-z0-9_]/).includes(n)) guardas.push(g);
      const mods = new Set(
        (guardas.join(" ").match(/"(saas\.[a-z_]+|marketing\.[a-z_]+)"/g) ?? []).map((x) =>
          x.slice(1, -1),
        ),
      );
      const fns = new Set(
        [...corpo.matchAll(new RegExp(`\\b(${ESQUEMAS})\\.([a-z_][a-z0-9_]*)\\s*\\(`, "g"))]
          .map((x) => `${x[1]}.${x[2]}`)
          .filter((f) => !f.startsWith("seguranca.auth_") && !NAO_SAO_FUNCOES.has(f)),
      );
      for (const mod of mods) for (const f of fns) pares.add(`${mod}|${f}`);
    });
  }
  return pares;
}

function paresDo911(sql: string): Set<string> {
  const ini = sql.indexOf("insert into __telas values");
  const fim = sql.indexOf(";", ini);
  return new Set(
    [...sql.slice(ini, fim).matchAll(/\('([a-z_.]+)', '([a-z_.]+)'\)/g)].map(
      (m) => `${m[1]}|${m[2]}`,
    ),
  );
}

describe("ponte: as telas do Agilliza × o teste 911 do Corretor", () => {
  const codigo = paresDoCodigo();

  it("a varredura encontra as telas da plataforma", () => {
    const modulos = new Set([...codigo].map((p) => p.split("|")[0]));
    expect(modulos.size).toBeGreaterThanOrEqual(16); // Configurações só lê tabelas (sem função)
    expect(codigo.size).toBeGreaterThan(80);
    expect(codigo.has("saas.news|plataforma.usuarios")).toBe(true);
    expect(codigo.has("saas.receita|nucleo.alterar_status_tenant")).toBe(true);
  });

  it.skipIf(!existsSync(TESTE_911))(
    "toda função que uma tela chama está no 911 (e o 911 não tem sobra)",
    () => {
      const lista = paresDo911(readFileSync(TESTE_911, "utf8"));
      expect(lista.size).toBeGreaterThan(80);
      expect([...codigo].filter((p) => !lista.has(p)).sort(), "faltam no 911").toEqual([]);
      expect([...lista].filter((p) => !codigo.has(p)).sort(), "sobram no 911").toEqual([]);
    },
  );
});

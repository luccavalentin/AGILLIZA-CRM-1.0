/**
 * Consulta Ficha pelo caminho do Agilliza Tech (0319) com ponte e fornecedor SIMULADOS — nada de
 * rede: a "plataforma" daqui é um objeto que responde às mesmas funções do banco.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  acompanharNaPlataforma,
  MSG_DESLIGADA,
  MSG_SEM_CHAVE_CIFRAGEM,
  MSG_SEM_CREDENCIAL,
  MSG_SEM_CUSTO,
  MSG_SEM_PONTE,
  prontidaoDaConsulta,
  solicitarNaPlataforma,
  type DependenciasConsulta,
} from "./consulta-plataforma.server";
import { fichaDaApifull } from "./apifull-ficha";
import { resumirConsulta } from "./apifull-resumo";

const UID = "11111111-1111-4111-8111-111111111111";
const PED = "22222222-2222-4222-8222-222222222222";

function deps(o: Partial<DependenciasConsulta> & { respostas?: Record<string, unknown> } = {}) {
  const chamadas: { sql: string; params?: unknown[]; kek?: boolean }[] = [];
  const respostas: Record<string, unknown> = {
    consulta_ficha_disponivel: { d: { ativo: true, custo: 7 } },
    solicitar_consulta_ficha_correspondente: { r: { pedido_id: PED, existente: false } },
    resultado_consulta_ficha_correspondente: { r: { situacao: "na_fila", tipo_falha: null } },
    ...(o.respostas ?? {}),
  };
  const d: DependenciasConsulta = {
    ponteConfigurada: () => true,
    temChave: () => true,
    credencial: async () => ({ segredo: { APIFULL_TOKEN: "simulado" } }),
    ponte: vi.fn(async (fn, opcoes) =>
      fn({
        consultar: async () => [],
        uma: async (sql: string, params?: unknown[]) => {
          chamadas.push({ sql, params, kek: opcoes?.kek });
          const k = Object.keys(respostas).find((x) => sql.includes(x));
          return (k ? respostas[k] : null) as never;
        },
      }),
    ) as DependenciasConsulta["ponte"],
    ...o,
  };
  return { d, chamadas };
}

describe("prontidão: a tela diz exatamente o que falta", () => {
  it("sem ponte", async () => {
    expect((await prontidaoDaConsulta(deps({ ponteConfigurada: () => false }).d)).motivo).toBe(MSG_SEM_PONTE);
  });
  it("sem chave de cifragem", async () => {
    expect((await prontidaoDaConsulta(deps({ temChave: () => false }).d)).motivo).toBe(MSG_SEM_CHAVE_CIFRAGEM);
  });
  it("sem a chave da APIFull cadastrada (nula, vazia ou só espaços)", async () => {
    for (const credencial of [async () => null, async () => ({ segredo: {} }), async () => ({ segredo: { APIFULL_TOKEN: "  " } })]) {
      const r = await prontidaoDaConsulta(deps({ credencial }).d);
      expect(r).toEqual({ pronto: false, motivo: MSG_SEM_CREDENCIAL });
    }
    expect(MSG_SEM_CREDENCIAL).toContain("Configurações gerais › Chaves dos provedores");
  });
  it("leitura da credencial que falha conta como sem chave (não derruba a tela)", async () => {
    const r = await prontidaoDaConsulta(deps({ credencial: async () => Promise.reject(new Error("x")) }).d);
    expect(r.motivo).toBe(MSG_SEM_CREDENCIAL);
  });
  it("produto desligado e custo não cadastrado", async () => {
    expect((await prontidaoDaConsulta(deps({ respostas: { consulta_ficha_disponivel: { d: { ativo: false, custo: 7 } } } }).d)).motivo).toBe(MSG_DESLIGADA);
    expect((await prontidaoDaConsulta(deps({ respostas: { consulta_ficha_disponivel: { d: { ativo: true, custo: null } } } }).d)).motivo).toBe(MSG_SEM_CUSTO);
  });
  it("tudo certo", async () => {
    expect(await prontidaoDaConsulta(deps().d)).toEqual({ pronto: true, motivo: null });
  });
});

describe("pedir e acompanhar", () => {
  it("pede pela função da plataforma com a pessoa, a chave e a base legal", async () => {
    const { d, chamadas } = deps();
    const r = await solicitarNaPlataforma(d, {
      userId: UID, documento: "52998224725", nome: "Ana", finalidade: "Análise de crédito",
      base: "protecao_credito", autorizou: false,
    });
    expect(r).toEqual({ pedidoId: PED, existente: false });
    const c = chamadas.find((x) => x.sql.includes("solicitar_consulta_ficha_correspondente"))!;
    expect(c.params).toEqual([UID, "52998224725", "Ana", "Análise de crédito", "protecao_credito", false]);
    expect(c.kek).toBe(true);
  });
  it("sem a chave da APIFull o pedido nem sai (e a mensagem é a exata)", async () => {
    const { d, chamadas } = deps({ credencial: async () => null });
    await expect(
      solicitarNaPlataforma(d, { userId: UID, documento: "52998224725", nome: null, finalidade: "Análise", base: "legitimo_interesse", autorizou: false }),
    ).rejects.toThrow(MSG_SEM_CREDENCIAL);
    expect(chamadas.some((x) => x.sql.includes("solicitar"))).toBe(false);
  });
  it("na fila / executando seguem em andamento", async () => {
    expect(await acompanharNaPlataforma(deps().d, { userId: UID, pedidoId: PED, documento: "52998224725" })).toEqual({ situacao: "na_fila" });
    const ex = deps({ respostas: { resultado_consulta_ficha_correspondente: { r: { situacao: "executando" } } } });
    expect((await acompanharNaPlataforma(ex.d, { userId: UID, pedidoId: PED, documento: "52998224725" })).situacao).toBe("executando");
  });
  it("concluída vira a ficha do Agilliza (fornecedor simulado)", async () => {
    const { d } = deps({
      respostas: {
        resultado_consulta_ficha_correspondente: {
          r: {
            situacao: "concluida", score: 720, faixa: "Baixo risco",
            resumo: { nome: "Maria da Silva", apontamentos: 2, pendencias: 1, protestos: 1 },
            resultado: { dados: { score: { valor: 720 }, pendencias: [{ valor: 100 }] } },
            concluida_em: "2026-10-26T12:00:00Z",
          },
        },
      },
    });
    const r = await acompanharNaPlataforma(d, { userId: UID, pedidoId: PED, documento: "529.982.247-25" });
    expect(r.situacao).toBe("concluida");
    if (r.situacao !== "concluida") return;
    expect(r.ficha.score?.valor).toBe(720);
    expect(r.ficha.nome).toBe("Maria da Silva");
    expect(r.ficha.totalRestricoes).toBe(2);
    expect(r.ficha.documento).toBe("52998224725");
    expect(r.ficha.contatos).toEqual([]);
  });
  it("falhas viram mensagem para gente, sem detalhe técnico do fornecedor", async () => {
    for (const [tipo, trecho] of [["saldo", "sem saldo"], ["rejeicao", "recusou"], ["x_desconhecida", "não foi concluída"]] as const) {
      const { d } = deps({ respostas: { resultado_consulta_ficha_correspondente: { r: { situacao: "falhou", tipo_falha: tipo } } } });
      const r = await acompanharNaPlataforma(d, { userId: UID, pedidoId: PED, documento: "52998224725" });
      expect(r.situacao).toBe("falhou");
      if (r.situacao === "falhou") expect(r.mensagem).toContain(trecho);
    }
  });
  it("plataforma sem resposta para o pedido → erro legível", async () => {
    const { d } = deps({ respostas: { resultado_consulta_ficha_correspondente: null } });
    await expect(acompanharNaPlataforma(d, { userId: UID, pedidoId: PED, documento: "1" })).rejects.toThrow(
      "Consulta não encontrada.",
    );
  });
});

describe("ficha a partir do relatório da APIFull (corpo sem formato fixo)", () => {
  it("corpo vazio nunca vira 'nada consta' inventado: score nulo, sem restrições inventadas", () => {
    const f = fichaDaApifull("52998224725", { resultado: {} }, () => "2026-10-26T00:00:00Z");
    expect(f.score).toBeNull();
    expect(f.restricoes).toEqual([]);
    expect(f.provedor).toBe("Serasa Premium");
  });
  it("score fora da escala é descartado", () => {
    expect(fichaDaApifull("52998224725", { score: 5000 }).score).toBeNull();
    expect(fichaDaApifull("52998224725", { score: -1 }).score).toBeNull();
  });
  it("CNPJ vira pessoa jurídica", () => {
    expect(fichaDaApifull("11.222.333/0001-81", {}).tipoPessoa).toBe("J");
  });
  it("o resumo copiado do Agilliza Tech lê o mesmo corpo do mesmo jeito", () => {
    const corpo = { status: "ok", dados: { pessoa: { nome: "JOÃO", score: "650" }, protestos: [{}, {}], cheques: { quantidade: "1" } } };
    const r = resumirConsulta(corpo);
    expect(r.score).toBe(650);
    expect(r.protestos).toBe(2);
    expect(r.cheques).toBe(1);
  });
});

describe("guarda: só Clientes pede e acompanha a consulta pela plataforma", () => {
  it("as server fns da consulta exigem crm.clientes e ninguém mais chama a ponte direta", () => {
    const fonte = readFileSync(join(__dirname, "bureau.functions.ts"), "utf8");
    for (const nome of ["consultarFichaBureau", "acompanharConsultaFicha"]) {
      const i = fonte.indexOf(`export const ${nome} = createServerFn`);
      expect(i, nome).toBeGreaterThan(0);
      expect(fonte.slice(i, i + 200)).toContain('exigirPermissao(["crm.clientes", "view"])');
    }
    const servidor = readFileSync(join(__dirname, "consulta-plataforma.server.ts"), "utf8");
    expect(servidor).toContain("plataforma.solicitar_consulta_ficha_correspondente");
    expect(servidor).not.toMatch(/HomeFin/i);
  });
});

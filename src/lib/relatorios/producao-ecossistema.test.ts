import { describe, expect, it } from "vitest";
import {
  blocoDosFatos,
  fatosDaPropostaTech,
  filtrosParaUrl,
  juntarBlocos,
  lerFiltros,
  ranking,
  resolverIntervaloProducao,
  serie,
  totalizar,
  variacao,
  type FatoProducao,
} from "./producao-ecossistema";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const L1 = "33333333-3333-4333-8333-333333333333";

describe("filtros do Painel geral (URL e memória)", () => {
  it("vazio vira o padrão: Minha, Sua base, 30 dias", () => {
    expect(lerFiltros({})).toEqual({ escopo: "minha", base: "sua_base", periodo: "30d" });
    expect(lerFiltros(null)).toEqual({ escopo: "minha", base: "sua_base", periodo: "30d" });
  });

  it("um assinante sem licença válida cai para Assinantes — todos", () => {
    expect(lerFiltros({ base: "assinante" }).base).toBe("assinantes");
    expect(lerFiltros({ base: "assinante", licenca: "x' or 1=1 --" }).base).toBe("assinantes");
    const f = lerFiltros({ base: "assinante", licenca: L1.toUpperCase() });
    expect(f).toMatchObject({ base: "assinante", licenca: L1 });
  });

  it("licença solta não sobra fora de 'um assinante'", () => {
    expect(lerFiltros({ base: "sua_base", licenca: L1 }).licenca).toBeUndefined();
  });

  it("usuário: prefixo e uuid obrigatórios; precisa caber na base", () => {
    expect(lerFiltros({ usuario: U1 }).usuario).toBeUndefined(); // sem prefixo
    expect(lerFiltros({ usuario: "a:nao-e-uuid" }).usuario).toBeUndefined();
    expect(lerFiltros({ usuario: `a:${U1}` }).usuario).toBe(`a:${U1}`);
    expect(lerFiltros({ usuario: `t:${U1}` }).usuario).toBe(`t:${U1}`);
    // Assinantes — todos não filtra por usuário (são milhares)
    expect(lerFiltros({ base: "assinantes", usuario: `t:${U1}` }).usuario).toBeUndefined();
    // Num assinante só cabe usuário do Tech
    expect(
      lerFiltros({ base: "assinante", licenca: L1, usuario: `a:${U1}` }).usuario,
    ).toBeUndefined();
    expect(lerFiltros({ base: "assinante", licenca: L1, usuario: `t:${U2}` }).usuario).toBe(
      `t:${U2}`,
    );
  });

  it("escopo e período desconhecidos voltam ao padrão; personalizado exige datas em ordem", () => {
    expect(lerFiltros({ escopo: "tudo" }).escopo).toBe("minha");
    expect(lerFiltros({ periodo: "sempre" }).periodo).toBe("30d");
    expect(lerFiltros({ periodo: "custom", de: "2026-10-20", ate: "2026-10-01" }).periodo).toBe(
      "30d",
    );
    expect(lerFiltros({ periodo: "custom", de: "20/10/2026", ate: "2026-10-21" }).periodo).toBe(
      "30d",
    );
    expect(lerFiltros({ periodo: "custom", de: "2026-10-01", ate: "2026-10-20" })).toMatchObject({
      periodo: "custom",
      de: "2026-10-01",
      ate: "2026-10-20",
    });
  });

  it("URL curta: padrões ficam de fora e o que importa volta igual", () => {
    const f = lerFiltros({
      escopo: "geral",
      base: "assinante",
      licenca: L1,
      usuario: `t:${U1}`,
      periodo: "7d",
    });
    const url = filtrosParaUrl(f);
    expect(url).toEqual({
      escopo: "geral",
      base: "assinante",
      licenca: L1,
      usuario: `t:${U1}`,
      periodo: "7d",
      de: undefined,
      ate: undefined,
    });
    expect(lerFiltros(url as Record<string, unknown>)).toEqual(f);
    expect(filtrosParaUrl(lerFiltros({}))).toEqual({
      escopo: undefined,
      base: undefined,
      licenca: undefined,
      usuario: undefined,
      periodo: undefined,
      de: undefined,
      ate: undefined,
    });
  });
});

describe("período e período anterior", () => {
  // 26/10/2026 às 01h em Brasília = 04h UTC
  const agora = new Date("2026-10-26T04:00:00Z");

  it("30 dias contam hoje e o anterior tem a mesma duração", () => {
    const i = resolverIntervaloProducao(lerFiltros({}), agora);
    expect(i).toEqual({
      de: "2026-09-27",
      ate: "2026-10-26",
      anteriorDe: "2026-08-28",
      anteriorAte: "2026-09-26",
      dias: 30,
    });
  });

  it("hoje é o dia de Brasília, não o UTC (23h de 25/10 aqui ainda é 25/10)", () => {
    const i = resolverIntervaloProducao(
      lerFiltros({ periodo: "7d" }),
      new Date("2026-10-26T02:30:00Z"),
    );
    expect(i.ate).toBe("2026-10-25");
  });

  it("mês anterior vai do dia 1 ao último dia; o anterior a ele tem 30 dias", () => {
    const i = resolverIntervaloProducao(lerFiltros({ periodo: "mes_anterior" }), agora);
    expect(i).toMatchObject({
      de: "2026-09-01",
      ate: "2026-09-30",
      dias: 30,
      anteriorDe: "2026-08-02",
      anteriorAte: "2026-08-31",
    });
  });

  it("este ano e personalizado", () => {
    expect(resolverIntervaloProducao(lerFiltros({ periodo: "ano" }), agora).de).toBe("2026-01-01");
    const c = resolverIntervaloProducao(
      lerFiltros({ periodo: "custom", de: "2026-10-01", ate: "2026-10-10" }),
      agora,
    );
    expect(c).toMatchObject({ dias: 10, anteriorDe: "2026-09-21", anteriorAte: "2026-09-30" });
  });
});

const f = (x: Partial<FatoProducao>): FatoProducao => ({
  tipo: "simulacao",
  dia: "2026-10-20",
  usuarioId: `a:${U1}`,
  usuarioNome: "Ana",
  contaId: "agilliza",
  contaNome: "Agilliza Correspondente",
  ...x,
});

describe("soma, ranking e série", () => {
  const fatos: FatoProducao[] = [
    f({}),
    f({}),
    f({ tipo: "proposta" }),
    f({ tipo: "aprovada" }),
    f({ tipo: "contrato", valor: 300_000, registrado: true }),
    f({
      tipo: "contrato",
      valor: 150_000.5,
      usuarioId: `t:${U2}`,
      usuarioNome: "Bia",
      contaId: L1,
      contaNome: "Imob X",
    }),
    f({ tipo: "simulacao", dia: "2026-09-01" }), // fora do intervalo da série
  ];

  it("totaliza cada natureza sem misturar", () => {
    expect(totalizar(fatos)).toEqual({
      simulacoes: 3,
      propostas: 1,
      aprovadas: 1,
      contratos: 2,
      registrados: 1,
      valor: 450_000.5,
    });
  });

  it("ranking por usuário e por conta ordena por contratos e valor", () => {
    const r = ranking(fatos, "usuario");
    expect(r.map((x) => x.id)).toEqual([`a:${U1}`, `t:${U2}`]);
    expect(r[0]).toMatchObject({ contratos: 1, valor: 300_000, simulacoes: 3 });
    const c = ranking(fatos, "conta");
    expect(c.map((x) => x.nome)).toEqual(["Agilliza Correspondente", "Imob X"]);
  });

  it("fato sem usuário não entra no ranking, mas entra no total", () => {
    const sem = [f({ usuarioId: null })];
    expect(ranking(sem, "usuario")).toEqual([]);
    expect(totalizar(sem).simulacoes).toBe(1);
  });

  it("série cobre todos os dias do intervalo, com zero onde não houve nada", () => {
    const s = serie(fatos, "2026-10-19", "2026-10-21");
    expect(s.map((p) => p.rotulo)).toEqual(["19/10", "20/10", "21/10"]);
    expect(s[1]).toMatchObject({ simulacoes: 2, propostas: 1, contratos: 2 });
    expect(s[0]).toMatchObject({ simulacoes: 0, propostas: 0, contratos: 0 });
  });

  it("série por mês acima de 62 dias", () => {
    const s = serie(fatos, "2026-08-01", "2026-10-31");
    expect(s.map((p) => p.rotulo)).toEqual(["ago/26", "set/26", "out/26"]);
    expect(s[1].simulacoes).toBe(1);
  });
});

describe("variação contra o período anterior", () => {
  it("sem base anterior é 'novo' (nada de +100% inventado)", () => {
    expect(variacao(5, 0)).toEqual({ pct: null });
  });
  it("zero contra zero não mostra nada", () => {
    expect(variacao(0, 0)).toBeUndefined();
  });
  it("abaixo de 0,5% é estável; acima, direção e percentual", () => {
    expect(variacao(1000, 999)).toEqual({ pct: 0 });
    expect(variacao(150, 100)).toEqual({ pct: 50, sobe: true });
    expect(variacao(50, 100)).toEqual({ pct: 50, sobe: false });
  });
});

describe("fontes juntas (Sua base = Agilliza + contas do Tech)", () => {
  it("soma totais, junta ranking pelo mesmo id e a série pelo mesmo dia", () => {
    const a = blocoDosFatos(
      [f({}), f({ tipo: "contrato", valor: 10 })],
      [f({})],
      "2026-10-20",
      "2026-10-20",
    );
    const b = blocoDosFatos(
      [f({ usuarioId: `t:${U2}`, contaId: L1, contaNome: "Imob X" })],
      [],
      "2026-10-20",
      "2026-10-20",
    );
    const j = juntarBlocos(a, b);
    expect(j.atual).toMatchObject({ simulacoes: 2, contratos: 1, valor: 10 });
    expect(j.anterior.simulacoes).toBe(1);
    expect(j.serie).toHaveLength(1);
    expect(j.serie[0].simulacoes).toBe(2);
    expect(j.rankingContas.map((x) => x.id)).toEqual(["agilliza", L1]);
    // mesmo id dos dois lados soma (não duplica a linha)
    const k = juntarBlocos(a, a);
    expect(k.rankingUsuarios).toHaveLength(1);
    expect(k.rankingUsuarios[0].simulacoes).toBe(2);
  });
});

describe("proposta do Agilliza Tech vira fatos com as regras do correspondente", () => {
  const dia = (s: string) => s.slice(0, 10);
  it("aprovada conta como proposta e aprovada; contrato não conta como aprovada", () => {
    const ap = fatosDaPropostaTech(
      { status: "condicionada", criado_em: "2026-10-20T10:00:00Z" },
      dia,
    );
    expect(ap.map((x) => x.tipo)).toEqual(["proposta", "aprovada"]);
    const ct = fatosDaPropostaTech(
      {
        status: "registrado",
        criado_em: "2026-10-20T10:00:00Z",
        valor_aprovado: "250000.00",
        valor_financiamento: 300000,
        usuario_id: U1,
        tenant_id: L1,
      },
      dia,
    );
    expect(ct.map((x) => x.tipo)).toEqual(["proposta", "contrato"]);
    expect(ct[1]).toMatchObject({
      registrado: true,
      valor: 250000,
      usuarioId: `t:${U1}`,
      contaId: L1,
    });
  });
  it("sem valor aprovado usa o pedido; valor torto vira zero (não NaN)", () => {
    const a = fatosDaPropostaTech(
      { status: "contrato", criado_em: "2026-10-20", valor_financiamento: 1000 },
      dia,
    );
    expect(a[1].valor).toBe(1000);
    const b = fatosDaPropostaTech(
      { status: "contrato", criado_em: "2026-10-20", valor_aprovado: "abc" },
      dia,
    );
    expect(b[1].valor).toBe(0);
  });
  it("recusada e cancelada contam só como proposta enviada", () => {
    for (const status of ["recusada", "cancelada", "aguardando_correspondente"]) {
      expect(
        fatosDaPropostaTech({ status, criado_em: "2026-10-20" }, dia).map((x) => x.tipo),
      ).toEqual(["proposta"]);
    }
  });
});

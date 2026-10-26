import { describe, expect, it } from "vitest";
import {
  agrupar,
  combinarBlocos,
  filtrosRelatorioParaUrl,
  funil,
  gargalosPorEtapa,
  lerFiltrosRelatorio,
  linkOrigem,
  normalizarBloco,
  ordenarPor,
  planoDeLeitura,
  ranking,
  serieMensal,
  taxa,
  temposPorEtapa,
  totalizarFatos,
  valorMetrica,
  variacao,
  ZERO_MEDIDAS,
} from "./ecossistema";

const CONTA = "0b6b5a8e-4f3a-4c1e-9a7b-1d2c3e4f5a6b";
const PESSOA = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const agilliza = normalizarBloco(
  {
    fatos: [
      { mes: "2026-09", banco: "caixa", usuario_id: PESSOA, usuario_nome: "Ana", parceiro_id: null,
        simulacoes: 4, propostas: 3, aprovadas: 2, contratos: 1, registrados: 1, valor_contratado: "300000.50",
        h_contrato: 48, n_contrato: 1, h_aprov: 24, n_aprov: 2 },
      { mes: "2026-10", banco: "itau", usuario_id: null, usuario_nome: "Sem responsável",
        simulacoes: 1, propostas: 1 },
    ],
    anterior: { propostas: 2, contratos: 2 },
    gargalos: [{ status: "analise_juridica", quantidade: 2, dias_parado: 10, parados_15d: 0, sla_vencido: 0 }],
    escopo: "geral",
  },
  "agilliza",
);
const tech = normalizarBloco(
  {
    fatos: [
      { mes: "2026-10", grupo: "assinantes", conta_id: CONTA, conta_nome: "Imob Alfa", conta_tipo: "imobiliaria",
        banco: "caixa", usuario_id: PESSOA, usuario_nome: "Beto", propostas: 5, aprovadas: 3, contratos: 2,
        valor_contratado: 500000, cpf: "52998224725" },
    ],
    anterior: { propostas: 1 },
    gargalos: [{ grupo: "assinantes", status: "contrato", quantidade: 1, dias_parado: 20, parados_15d: 1, sla_vencido: 1 }],
    contas: { total: 3, ativas: 2, teste: 1, suspensas: 0, por_tipo: { imobiliaria: 2 } },
  },
  "tech",
);

describe("filtros do relatório", () => {
  it("padrão: Sua base inteira, Geral, este mês", () => {
    const f = lerFiltrosRelatorio({});
    expect(f).toMatchObject({ visao: "recorte", escopo: "geral", periodo: "mes" });
    expect(f.base).toEqual({ base: "sua", origem: "tudo", contaId: null });
  });

  it("valor torto vira padrão (nada de injeção na URL)", () => {
    const f = lerFiltrosRelatorio({ visao: "tudo", escopo: "x", periodo: "decada", banco: "itau'; drop", usuario: "eu" });
    expect(f.visao).toBe("recorte");
    expect(f.escopo).toBe("geral");
    expect(f.periodo).toBe("mes");
    expect(f.banco).toBeUndefined();
    expect(f.usuario).toBeUndefined();
  });

  it("período personalizado exige as duas datas válidas e em ordem", () => {
    expect(lerFiltrosRelatorio({ periodo: "custom", de: "2026-10-10", ate: "2026-10-01" }).periodo).toBe("mes");
    const ok = lerFiltrosRelatorio({ periodo: "custom", de: "2026-10-01", ate: "2026-10-10" });
    expect(ok).toMatchObject({ periodo: "custom", de: "2026-10-01", ate: "2026-10-10" });
  });

  it("ida e volta pela URL", () => {
    const f = lerFiltrosRelatorio({ base: "assinantes", conta: CONTA, banco: "caixa", usuario: `t:${PESSOA}`, escopo: "minha" });
    expect(lerFiltrosRelatorio(filtrosRelatorioParaUrl(f))).toEqual(f);
    const eco = lerFiltrosRelatorio({ visao: "ecossistema", base: "assinantes" });
    expect(filtrosRelatorioParaUrl(eco).base).toBeUndefined();
  });
});

describe("plano de leitura (o que vem de cada ponta)", () => {
  const f = (s: Record<string, unknown>) => lerFiltrosRelatorio(s);

  it("Sua base inteira: Agilliza + vinculados sem contar de novo o que foi levado ao Agilliza", () => {
    expect(planoDeLeitura(f({}), true)).toEqual({
      agilliza: true,
      tech: { grupo: "vinculados", licenca: null, semNoAgilliza: true },
    });
  });

  it("Assinantes não trazem o Agilliza; um assinante vira a licença", () => {
    expect(planoDeLeitura(f({ base: "assinantes", conta: CONTA }), true)).toEqual({
      agilliza: false,
      tech: { grupo: "assinantes", licenca: CONTA, semNoAgilliza: false },
    });
  });

  it("Ecossistema: tudo, deduplicado", () => {
    expect(planoDeLeitura(f({ visao: "ecossistema" }), true).tech).toEqual({
      grupo: "todos",
      licenca: null,
      semNoAgilliza: true,
    });
  });

  it("sem permissão das contas do Tech, nunca pede a ponte", () => {
    expect(planoDeLeitura(f({ visao: "ecossistema" }), false)).toEqual({ agilliza: true, tech: null });
    expect(planoDeLeitura(f({ base: "assinantes" }), false).tech).toBeNull();
  });

  it("usuário do Agilliza tira o Tech; usuário do Tech tira o Agilliza", () => {
    expect(planoDeLeitura(f({ usuario: `a:${PESSOA}` }), true).tech).toBeNull();
    expect(planoDeLeitura(f({ usuario: `t:${PESSOA}` }), true).agilliza).toBe(false);
  });
});

describe("cubo", () => {
  it("normaliza números, prefixa usuários e ignora colunas que não são do cubo", () => {
    expect(agilliza.fatos[0].valor_contratado).toBe(300000.5);
    expect(agilliza.fatos[0].usuario_id).toBe(`a:${PESSOA}`);
    expect(agilliza.fatos[0].grupo).toBe("agilliza");
    expect(tech.fatos[0].usuario_id).toBe(`t:${PESSOA}`);
    expect(JSON.stringify(tech.fatos)).not.toContain("52998224725");
  });

  it("combina as pontas somando o anterior e preservando gargalos e contas", () => {
    const c = combinarBlocos(agilliza, null, tech);
    expect(c.fatos).toHaveLength(3);
    expect(c.anterior.propostas).toBe(3);
    expect(c.gargalos).toHaveLength(2);
    expect(c.contas?.ativas).toBe(2);
    const t = totalizarFatos(c.fatos);
    expect(t.propostas).toBe(9);
    expect(t.contratos).toBe(3);
    expect(t.valor_contratado).toBe(800000.5);
  });

  it("funil com conversão etapa a etapa e sem divisão por zero", () => {
    const t = totalizarFatos(combinarBlocos(agilliza, tech).fatos);
    const etapas = funil(t);
    expect(etapas.map((e) => e.valor)).toEqual([5, 9, 5, 3, 1]);
    expect(etapas[0].conversao).toBeNull();
    expect(etapas[3].conversao).toBe(60);
    expect(funil(ZERO_MEDIDAS)[1].conversao).toBeNull();
  });

  it("tempo por etapa em dias pela média ponderada", () => {
    const t = totalizarFatos(agilliza.fatos);
    const [aprov, contrato, registro] = temposPorEtapa(t);
    expect(aprov.dias).toBe(0.5);
    expect(contrato.dias).toBe(2);
    expect(registro.dias).toBeNull();
  });

  it("agrupa por conta, banco e usuário sem misturar pontas", () => {
    const c = combinarBlocos(agilliza, tech);
    const contas = agrupar(c.fatos, "conta");
    expect(contas.map((l) => l.rotulo).sort()).toEqual(["Agilliza Correspondente", "Imob Alfa"]);
    const bancos = agrupar(c.fatos, "banco");
    expect(bancos.find((b) => b.chave === "caixa")?.totais.propostas).toBe(8);
    const pessoas = agrupar(c.fatos, "usuario");
    // O mesmo uuid em pontas diferentes são pessoas diferentes (a: e t:).
    expect(pessoas.filter((p) => p.chave.endsWith(PESSOA))).toHaveLength(2);
  });

  it("ranking por contratos e ordenação por métrica derivada", () => {
    const c = combinarBlocos(agilliza, tech);
    expect(ranking(c.fatos, "conta")[0].rotulo).toBe("Imob Alfa");
    const porConversao = ordenarPor(agrupar(c.fatos, "conta"), "conversao");
    expect(porConversao[0].rotulo).toBe("Imob Alfa");
    expect(valorMetrica(porConversao[0].totais, "ticket_medio")).toBe(250000);
  });

  it("série mensal preenche os meses vazios do intervalo", () => {
    const s = serieMensal(combinarBlocos(agilliza, tech).fatos, "2026-08-15", "2026-10-26");
    expect(s.map((l) => l.chave)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(s[0].totais.propostas).toBe(0);
    expect(s[2].totais.propostas).toBe(6);
  });

  it("gargalos juntam as pontas pela etapa com média ponderada", () => {
    const g = gargalosPorEtapa(combinarBlocos(agilliza, tech).gargalos);
    expect(g[0]).toMatchObject({ etapa: "Análise jurídica", quantidade: 2, dias_parado: 10 });
    expect(g[1]).toMatchObject({ etapa: "Contrato emitido", sla_vencido: 1 });
  });
});

describe("indicadores", () => {
  it("taxa e variação sem inventar percentual", () => {
    expect(taxa(1, 3)).toBe(33.3);
    expect(taxa(1, 0)).toBeNull();
    expect(variacao(10, 0)).toMatchObject({ pct: null });
    expect(variacao(0, 0)).toMatchObject({ pct: 0 });
    expect(variacao(5, 10, false)).toMatchObject({ pct: 50, sobe: false, bom: false });
  });
});

describe("caminho até a origem", () => {
  const i = { de: "2026-10-01", ate: "2026-10-26" };
  it("leva o recorte, o período e a situação para a lista", () => {
    const f = lerFiltrosRelatorio({ base: "assinantes", conta: CONTA, banco: "caixa" });
    expect(linkOrigem(f, i, "contratos")).toEqual({
      to: "/operacional/propostas",
      search: { base: "assinantes", conta: CONTA, de: i.de, ate: i.ate, situacao: "contrato", banco: "caixa" },
    });
    expect(linkOrigem(f, i, "simulacoes").to).toBe("/operacional/simulacoes");
  });
  it("linha de uma conta abre a conta certa no grupo certo", () => {
    const f = lerFiltrosRelatorio({ visao: "ecossistema" });
    expect(linkOrigem(f, i, "propostas", { contaId: CONTA, grupo: "vinculados" }).search).toMatchObject({
      origem: "vinculados",
      conta: CONTA,
    });
    expect(linkOrigem(f, i, "propostas", { grupo: "agilliza" }).search).toMatchObject({ origem: "agilliza" });
  });
});

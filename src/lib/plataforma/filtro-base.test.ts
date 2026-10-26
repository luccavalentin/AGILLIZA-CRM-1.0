import { describe, expect, it } from "vitest";
import {
  alvoDoFiltro,
  documentoSeguro,
  filtroAtivo,
  iniciais,
  lerFiltroBase,
  paramsDoFiltro,
  rotuloDoFiltro,
  searchDoFiltro,
} from "./filtro-base";

const ID = "3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

describe("lerFiltroBase (URL → filtro)", () => {
  it("sem nada é Sua base, tudo junto (padrão)", () => {
    expect(lerFiltroBase({})).toEqual({ base: "sua", origem: "tudo", contaId: null });
    expect(lerFiltroBase(null)).toEqual({ base: "sua", origem: "tudo", contaId: null });
  });
  it("assinantes, com e sem conta", () => {
    expect(lerFiltroBase({ base: "assinantes" })).toEqual({ base: "assinantes", contaId: null });
    expect(lerFiltroBase({ base: "assinantes", conta: ID.toUpperCase() })).toEqual({
      base: "assinantes",
      contaId: ID,
    });
  });
  it("conta torta é ignorada (não vira filtro nem injeção)", () => {
    expect(lerFiltroBase({ base: "assinantes", conta: "x' or 1=1" })).toEqual({
      base: "assinantes",
      contaId: null,
    });
    expect(lerFiltroBase({ conta: 123 })).toEqual({ base: "sua", origem: "tudo", contaId: null });
    expect(lerFiltroBase({ conta: { id: ID } })).toEqual({ base: "sua", origem: "tudo", contaId: null });
  });
  it("base ou origem desconhecida cai no padrão", () => {
    expect(lerFiltroBase({ base: "todas" })).toEqual({ base: "sua", origem: "tudo", contaId: null });
    expect(lerFiltroBase({ origem: "plataforma" })).toEqual({ base: "sua", origem: "tudo", contaId: null });
  });
  it("conta em Sua base é uma vinculada", () => {
    expect(lerFiltroBase({ origem: "agilliza", conta: ID })).toEqual({
      base: "sua",
      origem: "vinculados",
      contaId: ID,
    });
  });
});

describe("paramsDoFiltro / searchDoFiltro (filtro → URL)", () => {
  it("padrão não suja o endereço", () => {
    expect(paramsDoFiltro({ base: "sua", origem: "tudo", contaId: null })).toEqual({});
  });
  it("ida e volta sem perda", () => {
    const casos = [
      { base: "assinantes", contaId: ID },
      { base: "assinantes", contaId: null },
      { base: "sua", origem: "agilliza", contaId: null },
      { base: "sua", origem: "vinculados", contaId: ID },
    ] as const;
    for (const c of casos) expect(lerFiltroBase(paramsDoFiltro(c))).toEqual(c);
  });
  it("validateSearch só devolve parâmetros saneados", () => {
    expect(searchDoFiltro({ base: "assinantes", conta: "lixo", aba: "x" })).toEqual({ base: "assinantes" });
    expect(searchDoFiltro({ origem: "agilliza" })).toEqual({ origem: "agilliza" });
  });
});

describe("alvoDoFiltro (o que cada tela busca)", () => {
  it("Sua base tudo: Agilliza + vinculados, sem duplicar o que já veio ao Agilliza", () => {
    expect(alvoDoFiltro({ base: "sua", origem: "tudo", contaId: null })).toEqual({
      agilliza: true,
      grupo: "vinculados",
      licenca: null,
      semNoAgilliza: true,
    });
  });
  it("só o Agilliza não consulta o Agilliza Tech", () => {
    expect(alvoDoFiltro({ base: "sua", origem: "agilliza", contaId: null }).grupo).toBeNull();
  });
  it("assinantes nunca mistura a base do Agilliza", () => {
    const a = alvoDoFiltro({ base: "assinantes", contaId: ID });
    expect(a.agilliza).toBe(false);
    expect(a.grupo).toBe("assinantes");
    expect(a.licenca).toBe(ID);
    expect(a.semNoAgilliza).toBe(false);
  });
});

describe("apresentação", () => {
  it("rótulos", () => {
    expect(rotuloDoFiltro({ base: "assinantes", contaId: null })).toBe("Todos os assinantes");
    expect(rotuloDoFiltro({ base: "assinantes", contaId: ID }, { id: ID, nome: "Imobiliária Alfa", tipo: "imobiliaria" })).toBe(
      "Imobiliária Alfa",
    );
    expect(rotuloDoFiltro({ base: "sua", origem: "tudo", contaId: null })).toBe("Sua base");
  });
  it("filtro ativo", () => {
    expect(filtroAtivo({ base: "sua", origem: "tudo", contaId: null })).toBe(false);
    expect(filtroAtivo({ base: "assinantes", contaId: null })).toBe(true);
  });
  it("iniciais ignoram preposição, emoji e espaços", () => {
    expect(iniciais("Imobiliária da Alfa")).toBe("IA");
    expect(iniciais("  beto  ")).toBe("B");
    expect(iniciais("🏠 Casa Nova")).toBe("CN");
    expect(iniciais("")).toBe("?");
    expect(iniciais(null)).toBe("?");
  });
  it("documento nunca sai inteiro na lista (LGPD)", () => {
    expect(documentoSeguro("52998224725")).toBe("***.982.***-25");
    expect(documentoSeguro("11.222.333/0001-81")).toBe("**.222.***/****-81");
    expect(documentoSeguro("***.982.***-25")).toBe("***.982.***-25");
    expect(documentoSeguro("123456789")).toBe("");
    expect(documentoSeguro(null)).toBe("");
  });
});

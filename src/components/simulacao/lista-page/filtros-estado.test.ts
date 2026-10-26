import { describe, expect, it } from "vitest";
import { destinoDaLinha } from "@/components/plataforma/conta-nativa/espelho-linha";
import {
  contarFiltrosAtivos,
  dataValida,
  FILTROS_VAZIOS,
  hojeEmSaoPaulo,
  lerFiltrosDaUrl,
  paramsDaConsulta,
  paramsDosFiltros,
  periodoDoPreset,
  periodoEmOrdem,
  presetDoPeriodo,
  rotuloPeriodo,
} from "./filtros-estado";

const U = "3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const U2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
// 01/03/2026 02:30 UTC = 28/02/2026 23:30 em São Paulo (fuso -03).
const VIRADA = new Date("2026-03-01T02:30:00Z");

describe("URL → filtros", () => {
  it("vazio é o padrão", () => {
    expect(lerFiltrosDaUrl({})).toEqual(FILTROS_VAZIOS);
    expect(lerFiltrosDaUrl(undefined)).toEqual(FILTROS_VAZIOS);
  });
  it("valores tortos não viram filtro", () => {
    expect(
      lerFiltrosDaUrl({
        de: "2026-02-31",
        ate: "ontem",
        resp: "1 or 1=1",
        escopo: "todas-mesmo",
        q: { $ne: 1 },
      }),
    ).toEqual(FILTROS_VAZIOS);
  });
  it("busca numérica (vira número no parser da URL) e longa demais", () => {
    expect(lerFiltrosDaUrl({ q: 12345 }).q).toBe("12345");
    expect(lerFiltrosDaUrl({ q: "x".repeat(500) }).q).toHaveLength(120);
  });
  it("período invertido é colocado em ordem", () => {
    expect(lerFiltrosDaUrl({ de: "2026-10-20", ate: "2026-10-01" })).toMatchObject({
      de: "2026-10-01",
      ate: "2026-10-20",
    });
    expect(periodoEmOrdem("2026-10-20", "")).toEqual({ de: "2026-10-20", ate: "" });
  });
  it("responsável normalizado e escopo minhas", () => {
    expect(lerFiltrosDaUrl({ resp: U.toUpperCase(), escopo: "minhas" })).toMatchObject({
      resp: U,
      escopo: "minhas",
    });
  });
});

describe("filtros → URL", () => {
  it("padrão não suja o endereço", () => {
    expect(paramsDosFiltros(FILTROS_VAZIOS)).toEqual({});
  });
  it("ida e volta sem perda", () => {
    const f = { q: "maria", de: "2026-10-01", ate: "2026-10-20", resp: U, escopo: "todas" as const };
    expect(lerFiltrosDaUrl(paramsDosFiltros(f))).toEqual(f);
  });
  it("não grava responsável inválido nem busca só de espaços", () => {
    expect(paramsDosFiltros({ ...FILTROS_VAZIOS, q: "   ", resp: "x" })).toEqual({});
  });
});

describe("datas e atalhos (fuso de São Paulo)", () => {
  it("valida datas de calendário", () => {
    expect(dataValida("2026-02-28")).toBe(true);
    expect(dataValida("2026-02-29")).toBe(false);
    expect(dataValida("2028-02-29")).toBe(true);
    expect(dataValida("26-10-2026")).toBe(false);
    expect(dataValida(null)).toBe(false);
  });
  it("hoje é o dia de São Paulo, não o UTC", () => {
    expect(hojeEmSaoPaulo(VIRADA)).toBe("2026-02-28");
  });
  it("atalhos contam o dia de hoje", () => {
    expect(periodoDoPreset("hoje", VIRADA)).toEqual({ de: "2026-02-28", ate: "2026-02-28" });
    expect(periodoDoPreset("7d", VIRADA)).toEqual({ de: "2026-02-22", ate: "2026-02-28" });
    expect(periodoDoPreset("30d", VIRADA)).toEqual({ de: "2026-01-30", ate: "2026-02-28" });
    expect(periodoDoPreset("mes", VIRADA)).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
  });
  it("reconhece o atalho e rotula o período", () => {
    expect(presetDoPeriodo("2026-02-22", "2026-02-28", VIRADA)).toBe("7d");
    expect(rotuloPeriodo("2026-02-22", "2026-02-28", VIRADA)).toBe("7 dias");
    expect(rotuloPeriodo("2026-10-01", "2026-10-20", VIRADA)).toBe("01/10/26 – 20/10/26");
    expect(rotuloPeriodo("2026-10-05", "", VIRADA)).toBe("desde 05/10/26");
    expect(rotuloPeriodo("", "", VIRADA)).toBeNull();
  });
});

describe("contagem e consulta", () => {
  it("conta cada filtro aplicado uma vez", () => {
    expect(contarFiltrosAtivos(FILTROS_VAZIOS)).toBe(0);
    expect(
      contarFiltrosAtivos({ q: "a", de: "2026-10-01", ate: "2026-10-02", resp: U, escopo: "todas" }, true),
    ).toBe(4);
    // Em "Minhas" o responsável não vale (não é enviado): não conta.
    expect(contarFiltrosAtivos({ ...FILTROS_VAZIOS, resp: U, escopo: "minhas" })).toBe(1);
  });
  it("mesmos parâmetros de antes para listarSimulacoes", () => {
    expect(paramsDaConsulta({ q: "", de: "2026-10-20", ate: "2026-10-01", resp: U, escopo: "todas" }, " ana ")).toEqual({
      escopo: "todas",
      q: "ana",
      desde: "2026-10-01",
      ate: "2026-10-20",
      responsavel: U,
    });
    expect(paramsDaConsulta({ ...FILTROS_VAZIOS, resp: U, escopo: "minhas" }, "")).toEqual({
      escopo: "minhas",
      q: undefined,
      desde: undefined,
      ate: undefined,
      responsavel: undefined,
    });
  });
});

describe("espelho pela conta da linha", () => {
  it("já espelhada vai direto para a cópia do Agilliza", () => {
    expect(destinoDaLinha({ id: U, _licenca: U2, _simulacao_agilliza_id: U2 })).toEqual({ tipo: "direto", id: U2 });
  });
  it("linha de grupo espelha pela própria conta", () => {
    expect(destinoDaLinha({ id: U, _licenca: U2 })).toEqual({
      tipo: "espelhar",
      licenca: U2,
      simulacaoId: U,
    });
  });
  it("linha sem conta não espelha (nunca numa conta errada)", () => {
    expect(destinoDaLinha({ id: U })).toEqual({ tipo: "nenhum" });
    expect(destinoDaLinha({ id: U, _licenca: "x' or 1=1" })).toEqual({ tipo: "nenhum" });
    expect(destinoDaLinha(undefined)).toEqual({ tipo: "nenhum" });
  });
  it("na visão de uma conta, a conta da tela vale para linhas sem _licenca; a da linha prevalece", () => {
    expect(destinoDaLinha({ id: U }, U2)).toEqual({ tipo: "espelhar", licenca: U2, simulacaoId: U });
    expect(destinoDaLinha({ id: U, _licenca: U }, U2)).toMatchObject({ licenca: U });
  });
  it("id torto não espelha", () => {
    expect(destinoDaLinha({ id: "abc", _licenca: U2 })).toEqual({ tipo: "nenhum" });
  });
});

import { describe, expect, it } from "vitest";
import { consultaVisivel, fichaSemDadosSensiveis } from "./visibilidade";
import type { FichaBureau } from "./tipos";

const EU = "u-1";

describe("consultaVisivel (LGPD)", () => {
  it("papel amplo vê tudo", () => {
    expect(consultaVisivel({ ator_id: "outro", cliente_id: "c9" }, EU, true, {})).toBe(true);
  });
  it("quem consultou vê a própria consulta, mesmo sem cliente", () => {
    expect(consultaVisivel({ ator_id: EU, cliente_id: null }, EU, false, {})).toBe(true);
  });
  it("ATAQUE: consulta de colega sobre cliente fora da carteira não aparece", () => {
    expect(consultaVisivel({ ator_id: "colega", cliente_id: "c2" }, EU, false, { c1: "Ana" })).toBe(false);
  });
  it("cliente visível pela RLS libera a consulta do colega", () => {
    expect(consultaVisivel({ ator_id: "colega", cliente_id: "c1" }, EU, false, { c1: "Ana" })).toBe(true);
  });
  it("consulta avulsa (sem cliente) de colega não aparece", () => {
    expect(consultaVisivel({ ator_id: "colega", cliente_id: null }, EU, false, {})).toBe(false);
  });
  it("entrada torta (ator nulo) não libera", () => {
    expect(consultaVisivel({ ator_id: null, cliente_id: undefined }, EU, false, {})).toBe(false);
  });
});

describe("fichaSemDadosSensiveis", () => {
  it("tira documento inteiro, contatos, nascimento e renda", () => {
    const f = {
      documento: "52998224725",
      tipoPessoa: "F",
      nome: "Ana",
      nascimentoOuFundacao: "1990-01-01",
      rendaPresumida: 9000,
      contatos: [{ tipo: "telefone", valor: "11999999999" }],
    } as unknown as FichaBureau;
    const r = fichaSemDadosSensiveis(f);
    expect(r.documento).not.toContain("52998224725");
    expect(r.contatos).toEqual([]);
    expect(r.nascimentoOuFundacao).toBeNull();
    expect(r.rendaPresumida).toBeNull();
    expect(r.nome).toBe("Ana");
  });
});

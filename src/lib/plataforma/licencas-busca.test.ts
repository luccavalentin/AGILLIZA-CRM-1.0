import { describe, expect, it } from "vitest";
import { lerBuscaLicencas, linkDaLicenca } from "./licencas-busca";

const ID = "0195c0de-0000-7000-8000-000000000001";

describe("?conta= das licenças (link do financeiro da matriz)", () => {
  it("aceita só um uuid", () => {
    expect(lerBuscaLicencas({ conta: ID })).toEqual({ conta: ID });
    expect(lerBuscaLicencas({ conta: ID.toUpperCase() })).toEqual({ conta: ID });
    expect(lerBuscaLicencas({ conta: ` ${ID} ` })).toEqual({ conta: ID });
  });
  it("ignora o que não é uuid (sem injeção na busca)", () => {
    expect(lerBuscaLicencas({ conta: "x' or 1=1 --" })).toEqual({});
    expect(lerBuscaLicencas({ conta: 123 })).toEqual({});
    expect(lerBuscaLicencas({ conta: [ID] })).toEqual({});
    expect(lerBuscaLicencas({})).toEqual({});
  });
  it("o link do financeiro é lido de volta pela tela", () => {
    const url = new URL(linkDaLicenca(ID), "https://x.test");
    expect(url.pathname).toBe("/plataforma/licencas");
    expect(lerBuscaLicencas(Object.fromEntries(url.searchParams))).toEqual({ conta: ID });
  });
});

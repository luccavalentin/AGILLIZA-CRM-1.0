import { describe, expect, it } from "vitest";
import { resolverFaixa } from "./faixa-bytes";

describe("pedido parcial (Range) da rota de arquivo selado", () => {
  it("o primeiro pedido do Safari (bytes=0-1) volta só 2 bytes", () => {
    expect(resolverFaixa("bytes=0-1", 1000)).toEqual({ ini: 0, fim: 1 });
  });
  it("início aberto vai até o fim; fim além do tamanho é cortado", () => {
    expect(resolverFaixa("bytes=500-", 1000)).toEqual({ ini: 500, fim: 999 });
    expect(resolverFaixa("bytes=900-5000", 1000)).toEqual({ ini: 900, fim: 999 });
  });
  it("sufixo: os últimos N bytes (e N maior que o arquivo é o arquivo todo)", () => {
    expect(resolverFaixa("bytes=-100", 1000)).toEqual({ ini: 900, fim: 999 });
    expect(resolverFaixa("bytes=-5000", 1000)).toEqual({ ini: 0, fim: 999 });
  });
  it("faixa impossível responde 416", () => {
    expect(resolverFaixa("bytes=1000-", 1000)).toBe("invalida");
    expect(resolverFaixa("bytes=50-10", 1000)).toBe("invalida");
    expect(resolverFaixa("bytes=-0", 1000)).toBe("invalida");
  });
  it("sem Range, várias faixas ou lixo: arquivo inteiro (200)", () => {
    expect(resolverFaixa(null, 1000)).toBeNull();
    expect(resolverFaixa("bytes=0-1,5-9", 1000)).toBeNull();
    expect(resolverFaixa("items=0-1", 1000)).toBeNull();
    expect(resolverFaixa("bytes=-", 1000)).toBeNull();
    expect(resolverFaixa("bytes=0-1", 0)).toBeNull();
  });
});

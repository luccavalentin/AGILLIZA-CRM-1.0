import { beforeEach, describe, expect, it, vi } from "vitest";
import { ESTADO_INICIAL, estadoInicialComRascunho } from "./state";

function fakeStorage(valor: string | null) {
  const store = { v: valor };
  vi.stubGlobal("sessionStorage", {
    getItem: () => store.v,
    removeItem: () => {
      store.v = null;
    },
    setItem: (_k: string, v: string) => {
      store.v = v;
    },
  });
  return store;
}

describe("estadoInicialComRascunho", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("aplica sexo, estado civil e regime deixados pela ficha do cliente", () => {
    fakeStorage(
      JSON.stringify({
        nome_cliente: "Maria Souza",
        sexo: "F",
        estado_civil: "CA",
        regime_casamento: "CP",
        sexo_conjuge: "M",
      }),
    );
    const f = estadoInicialComRascunho();
    expect(f.nome_cliente).toBe("Maria Souza");
    expect(f.sexo).toBe("F");
    expect(f.estado_civil).toBe("CA");
    expect(f.regime_casamento).toBe("CP");
    expect(f.sexo_conjuge).toBe("M");
  });

  it("ignora chave que não é do formulário e valor vazio", () => {
    fakeStorage(JSON.stringify({ renda_familiar: 9999, sexo: "", nome_cliente: "Ana" }));
    const f = estadoInicialComRascunho();
    expect((f as any).renda_familiar).toBeUndefined();
    expect(f.sexo).toBeUndefined();
    expect(f.nome_cliente).toBe("Ana");
  });

  it("consome o rascunho: a segunda abertura já vem limpa", () => {
    fakeStorage(JSON.stringify({ nome_cliente: "Ana" }));
    expect(estadoInicialComRascunho().nome_cliente).toBe("Ana");
    expect(estadoInicialComRascunho().nome_cliente).toBe(ESTADO_INICIAL.nome_cliente);
  });

  it("sem rascunho ou com JSON inválido devolve o estado inicial", () => {
    fakeStorage(null);
    expect(estadoInicialComRascunho()).toEqual(ESTADO_INICIAL);
    fakeStorage("{quebrado");
    expect(estadoInicialComRascunho()).toEqual(ESTADO_INICIAL);
  });
});

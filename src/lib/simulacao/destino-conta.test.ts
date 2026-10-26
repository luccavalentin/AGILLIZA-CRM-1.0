import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assinarContaDestino,
  comContaDestino,
  contaDestinoAtual,
  definirContaDestino,
  normalizarContaId,
} from "./destino-conta";

const ID = "3F2B8C1E-1A2B-4C3D-8E9F-0A1B2C3D4E5F";

afterEach(() => definirContaDestino(null));

describe("destino da simulação (C29)", () => {
  it("uuid torto nunca vira destino", () => {
    for (const v of ["", " ", "x' or 1=1", "123", null, undefined, 42, {}, [ID], `${ID}x`]) {
      expect(normalizarContaId(v)).toBeNull();
    }
    expect(normalizarContaId(` ${ID} `)).toBe(ID.toLowerCase());
  });

  it("sem destino, os dados da simulação ficam idênticos (nenhuma chave nova)", () => {
    const dados = { valor_imovel: 500000, cliente_id: "c" };
    const r = comContaDestino(dados);
    expect(r).toBe(dados);
    expect("conta_assinante_id" in r).toBe(false);
  });

  it("com destino, leva só o uuid saneado", () => {
    definirContaDestino({ id: ID, nome: "Imobiliária Alfa" });
    expect(comContaDestino({ a: 1 })).toEqual({ a: 1, conta_assinante_id: ID.toLowerCase() });
  });

  it("destino torto volta para a sua base", () => {
    definirContaDestino({ id: ID, nome: "Alfa" });
    definirContaDestino({ id: "lixo", nome: "Hacker" });
    expect(contaDestinoAtual()).toBeNull();
    expect(comContaDestino({ a: 1 })).toEqual({ a: 1 });
  });

  it("troca de destino avisa quem ouve e limpar volta para a sua base", () => {
    const ouvinte = vi.fn();
    const parar = assinarContaDestino(ouvinte);
    definirContaDestino({ id: ID, nome: "Alfa" });
    definirContaDestino({ id: ID, nome: "Alfa" }); // igual: não repete o aviso
    definirContaDestino({ id: "11111111-2222-4333-8444-555555555555", nome: "Beta" });
    definirContaDestino(null);
    parar();
    definirContaDestino({ id: ID, nome: "Alfa" });
    expect(ouvinte).toHaveBeenCalledTimes(3);
    expect(ouvinte.mock.calls[2][0]).toBeNull();
  });

  it("nome vazio vira Assinante", () => {
    definirContaDestino({ id: ID, nome: "   " });
    expect(contaDestinoAtual()?.nome).toBe("Assinante");
  });
});

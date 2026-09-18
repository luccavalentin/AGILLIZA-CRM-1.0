import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

import { camposQueMudam, estavel, mesmoValor } from "./sync-estado.server";

describe("comparação antes de gravar", () => {
  it("número gravado como texto é igual ao mesmo número", () => {
    expect(mesmoValor("24000", 24000)).toBe(true);
    expect(mesmoValor("4402.62", 4402.62)).toBe(true);
    expect(mesmoValor("4402.62", 4402.63)).toBe(false);
  });

  it("nulo, indefinido e vazio são equivalentes", () => {
    expect(mesmoValor(null, undefined)).toBe(true);
    expect(mesmoValor("", null)).toBe(true);
    expect(mesmoValor(null, "5527215")).toBe(false);
  });

  it("jsonb compara por conteúdo, sem depender da ordem das chaves", () => {
    expect(mesmoValor({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(mesmoValor({ a: 1 }, { a: 2 })).toBe(false);
    expect(estavel([{ b: 1, a: 2 }])).toBe(estavel([{ a: 2, b: 1 }]));
  });

  it("mudança real de status é detectada; campos iguais ficam de fora", () => {
    const atual = {
      status: "em_analise_credito",
      detalhe_status_atual: "Em análise",
      valor: "100",
    };
    const patch = { status: "credito_aprovado", detalhe_status_atual: "Em análise", valor: 100 };
    expect(camposQueMudam(atual, patch)).toEqual({ status: "credito_aprovado" });
  });

  it("sem mudança, nada para gravar", () => {
    expect(camposQueMudam({ status: "credito_aprovado" }, { status: "credito_aprovado" })).toEqual(
      {},
    );
  });
});

import { describe, expect, it } from "vitest";
import { termoSemAcento } from "@/lib/crm/busca";

describe("termoSemAcento", () => {
  it("tira acento e passa para minúsculo, como nome_busca", () => {
    expect(termoSemAcento("João")).toBe("joao");
    expect(termoSemAcento("MARIA ÂNGELA da Conceição")).toBe("maria angela da conceicao");
  });

  it("termo já sem acento fica igual", () => {
    expect(termoSemAcento("joao")).toBe("joao");
  });
});

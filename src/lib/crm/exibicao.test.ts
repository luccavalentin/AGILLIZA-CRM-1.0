import { describe, expect, it } from "vitest";
import { exibirDocumento } from "@/lib/crm/documento";
import { iniciaisDoNome } from "@/components/shared/iniciais";
import { toTitleCase } from "@/lib/utils";

describe("exibirDocumento", () => {
  it("pontua CPF e CNPJ crus", () => {
    expect(exibirDocumento("52998224725")).toBe("529.982.247-25");
    expect(exibirDocumento("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("mantém documento já mascarado (sem permissão de PII)", () => {
    expect(exibirDocumento("***.***.247-**")).toBe("***.***.247-**");
  });

  it("vazio vira texto vazio", () => {
    expect(exibirDocumento(null)).toBe("");
    expect(exibirDocumento("")).toBe("");
  });
});

describe("iniciaisDoNome", () => {
  it("ignora colchetes e pontuação", () => {
    expect(iniciaisDoNome("[TESTE] João Silva")).toBe("TS");
    expect(iniciaisDoNome("[T")).toBe("T");
  });

  it("primeiro e último nome", () => {
    expect(iniciaisDoNome("maria da silva souza")).toBe("MS");
    expect(iniciaisDoNome("Ana")).toBe("A");
  });

  it("sem nome usa o valor de vazio", () => {
    expect(iniciaisDoNome(null)).toBe("?");
    expect(iniciaisDoNome("  ", "—")).toBe("—");
  });
});

describe("toTitleCase", () => {
  it("preserva o marcador entre colchetes e capitaliza o nome", () => {
    expect(toTitleCase("[TESTE] JOAO DA SILVA")).toBe("[TESTE] Joao da Silva");
  });

  it("preserva código com dígito e sufixo de empresa", () => {
    expect(toTitleCase("[TESTE] F4 CLIENTE QA")).toBe("[TESTE] F4 Cliente Qa");
    expect(toTitleCase("PADARIA BOM PAO LTDA")).toBe("Padaria Bom Pao LTDA");
  });

  it("capitaliza a primeira letra depois de pontuação", () => {
    expect(toTitleCase("(JOAO) DE SOUZA")).toBe("(Joao) de Souza");
  });
});

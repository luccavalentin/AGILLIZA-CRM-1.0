import { describe, expect, it } from "vitest";
import { ABAS_CLIENTE, ABA_CLIENTE_PADRAO, abaClienteInicial } from "./abas-cliente";

describe("abas da ficha do cliente (C09–C11)", () => {
  it("segue a ordem pedida pelo dono, com o Resumo ao final", () => {
    expect(ABAS_CLIENTE.map((a) => a.label)).toEqual([
      "Vínculo de atendimento",
      "Dados do comprador",
      "Dados do vendedor",
      "Imóvel",
      "IQ",
      "Documentos",
      "Negócios",
      "Demandas & Tarefas",
      "Histórico",
      "Resumo",
    ]);
  });

  it("não tem mais App cliente, Registro de interações nem o rótulo Vendedores", () => {
    const rotulos = ABAS_CLIENTE.map((a) => a.label);
    const ids = ABAS_CLIENTE.map((a) => a.v as string);
    expect(rotulos).not.toContain("App cliente");
    expect(rotulos).not.toContain("Registro de interações");
    expect(rotulos).not.toContain("Vendedores");
    expect(ids).not.toContain("mensagens");
    expect(ids).not.toContain("interacoes");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("abre em Vínculo de atendimento", () => {
    expect(ABA_CLIENTE_PADRAO).toBe("vinculo");
    expect(abaClienteInicial(undefined)).toBe("vinculo");
    expect(abaClienteInicial("")).toBe("vinculo");
  });

  it("respeita a aba pedida na URL, inclusive o Resumo dos links antigos", () => {
    expect(abaClienteInicial("resumo")).toBe("resumo");
    expect(abaClienteInicial("documentos")).toBe("documentos");
    expect(abaClienteInicial(" Negocios ")).toBe("negocios");
  });

  it("abas removidas e nomes antigos vão para um destino válido", () => {
    expect(abaClienteInicial("mensagens")).toBe("vinculo");
    expect(abaClienteInicial("app")).toBe("vinculo");
    expect(abaClienteInicial("interacoes")).toBe("vinculo");
    expect(abaClienteInicial("vendedor")).toBe("vendedores");
    expect(abaClienteInicial("tarefas")).toBe("atividades");
  });

  it("entrada torta nunca vira aba inexistente", () => {
    for (const lixo of [
      null,
      42,
      {},
      ["resumo"],
      "<script>",
      "__proto__",
      "constructor",
      "toString",
      "x".repeat(5000),
    ]) {
      const r = abaClienteInicial(lixo);
      expect(ABAS_CLIENTE.some((a) => a.v === r)).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import { completaSchema, wizardSchema, VALOR_IMOVEL_MINIMO } from "./schemas";

const wizardValido = {
  produto: "financiamento_imobiliario" as const,
  valor_imovel: 800_000,
  valor_entrada: 160_000,
  valor_financiamento: 640_000,
  data_nascimento: "1990-01-01",
  prazo_meses: 420,
};

describe("piso de valor", () => {
  it("aceita valores de mercado", () => {
    expect(wizardSchema.safeParse(wizardValido).success).toBe(true);
  });

  it("barra imóvel abaixo do piso com mensagem própria", () => {
    const r = wizardSchema.safeParse({
      ...wizardValido,
      valor_imovel: 2_000,
      valor_entrada: 400,
      valor_financiamento: 1_600,
    });
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(msgs.some((m) => m.includes("R$ 50.000,00"))).toBe(true);
    expect(msgs.some((m) => m.includes("R$ 30.000,00"))).toBe(true);
  });

  it("o piso do imóvel vale também na simulação completa", () => {
    const campo = completaSchema.safeParse({ valor_imovel: VALOR_IMOVEL_MINIMO - 1 });
    expect(campo.success).toBe(false);
  });
});

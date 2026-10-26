import { describe, expect, it } from "vitest";
import type { PlanoCatalogo } from "@/lib/plataforma/planos.functions";
import {
  assinaturasAtivas,
  horasLegiveis,
  menorMensal,
  normalizarMoeda,
  numero,
  partesLimite,
  vitrineDoPlano,
} from "./comum";

const plano = (p: Partial<PlanoCatalogo>): PlanoCatalogo => ({
  id: "1",
  codigo: "x",
  nome: "Plano",
  descricao: null,
  publico: "corretor",
  preco_mensal: 100,
  preco_anual: null,
  preco_trimestral: null,
  preco_semestral: null,
  vende_mensal: true,
  preco_por_usuario: null,
  preco_por_contato: null,
  trial_dias: 7,
  dias_acesso: 30,
  ativo: true,
  assinaturas: 0,
  limites: {},
  ...p,
});

describe("catálogo de planos (tela)", () => {
  it("lê moeda pt-BR e recusa texto torto", () => {
    expect(numero("1.234,50")).toBe(1234.5);
    expect(numero("79.9")).toBe(79.9);
    expect(numero("  ")).toBeNull();
    expect(numero("abc")).toBeNaN();
    expect(normalizarMoeda("abc")).toBe("abc");
  });

  it("descreve limites em português", () => {
    expect(partesLimite("imoveis.max", 50)).toEqual(["Imóveis", "até 50"]);
    expect(partesLimite("usuarios", -1)).toEqual(["Usuários", "sem limite"]);
    expect(partesLimite("ia", false)).toEqual(["IA", "não incluído"]);
    expect(partesLimite("financeiro", "completo")).toEqual(["Financeiro", "Completo"]);
  });

  it("vitrine e menor preço mensal seguem os pacotes gravados", () => {
    const p = plano({ vende_mensal: false, preco_trimestral: 270, preco_anual: 960 });
    expect(vitrineDoPlano(p).map((v) => v.nome)).toEqual(["Trimestral", "Anual"]);
    expect(menorMensal(p)).toBe(80);
    expect(menorMensal(plano({}))).toBe(100);
  });

  it("plural e horas legíveis", () => {
    expect(assinaturasAtivas(1)).toBe("1 assinatura ativa");
    expect(assinaturasAtivas(2)).toBe("2 assinaturas ativas");
    expect(horasLegiveis(4)).toBe("4 h");
    expect(horasLegiveis(24)).toBe("1 d");
    expect(horasLegiveis(54)).toBe("2 d 6 h");
    expect(horasLegiveis(0)).toBe("—");
  });
});

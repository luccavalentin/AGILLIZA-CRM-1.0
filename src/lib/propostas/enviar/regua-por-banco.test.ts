import { describe, it, expect } from "vitest";
import { homefinPodeRegravarRegua, ORIGEM_ROBO_PORTAL } from "./helpers-retorno.server";

/** Régua como o robô grava (a etapa ativa marcada, todas com a origem). */
const reguaRobo = (ativa: string) =>
  [
    "Simulação",
    "Crédito",
    "Documentos",
    "Engenharia",
    "Análise Jurídica",
    "Contrato Emitido",
    "Registro",
  ].map((nome) => ({ nome, ativa: nome === ativa, origem: ORIGEM_ROBO_PORTAL }));

/** Funil como a HomeFin devolve. */
const funilHomefin = (ativa: string) =>
  ["Simulação", "Crédito", "Engenharia", "Análise Jurídica", "Contrato Emitido", "Registro"].map(
    (nome) => ({ nome, ativa: nome === ativa }),
  );

describe("Régua por banco: vale quem estiver mais adiante", () => {
  it("Bradesco (régua da própria HomeFin) segue regravando como sempre", () => {
    expect(homefinPodeRegravarRegua(funilHomefin("Engenharia"), funilHomefin("Crédito"))).toBe(
      true,
    );
    expect(homefinPodeRegravarRegua(null, funilHomefin("Simulação"))).toBe(true);
    expect(homefinPodeRegravarRegua([], funilHomefin("Simulação"))).toBe(true);
  });

  it("Itaú/Santander: o funil parado da HomeFin não apaga o que o robô leu no banco", () => {
    expect(homefinPodeRegravarRegua(reguaRobo("Crédito"), funilHomefin("Simulação"))).toBe(false);
    expect(homefinPodeRegravarRegua(reguaRobo("Documentos"), funilHomefin("Crédito"))).toBe(false);
  });

  it("etapa de formulários do robô fica à frente do crédito da HomeFin", () => {
    const itau = [
      { nome: "Crédito", ativa: false, origem: ORIGEM_ROBO_PORTAL },
      { nome: "Formulários Digitais", ativa: true, origem: ORIGEM_ROBO_PORTAL },
    ];
    expect(homefinPodeRegravarRegua(itau, funilHomefin("Crédito"))).toBe(false);
    expect(homefinPodeRegravarRegua(itau, funilHomefin("Engenharia"))).toBe(true);
  });

  it("mesma etapa nos dois: fica a leitura do robô", () => {
    expect(homefinPodeRegravarRegua(reguaRobo("Engenharia"), funilHomefin("Engenharia"))).toBe(
      false,
    );
  });

  it("se a HomeFin passar a mover o banco e estiver à frente, ela assume", () => {
    expect(homefinPodeRegravarRegua(reguaRobo("Documentos"), funilHomefin("Engenharia"))).toBe(
      true,
    );
    expect(homefinPodeRegravarRegua(reguaRobo("Crédito"), funilHomefin("Registro"))).toBe(true);
  });
});

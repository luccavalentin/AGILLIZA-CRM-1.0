import { describe, expect, it } from "vitest";
import { navInterno, navParceiro } from "./nav-config";

/* Consolidação c1 (26/10/2026): Agilliza News no menu do correspondente, em Visão Geral, logo
   abaixo do Painel geral (a página /news é da frente a7). */
describe("menu do correspondente: Visão Geral", () => {
  const visao = navInterno.find((g) => g.id === "visao-geral");
  it("Painel geral e, logo abaixo, Agilliza News", () => {
    expect(visao?.items.map((i) => [i.label, i.to])).toEqual([
      ["Painel geral", "/visao-geral/painel"],
      ["Agilliza News", "/news"],
    ]);
  });
  it("continua o primeiro bloco do menu", () => {
    expect(navInterno[0]?.id).toBe("visao-geral");
  });
  it("o portal do parceiro não herda a News da equipe", () => {
    expect(navParceiro.flatMap((g) => g.items).some((i) => i.to === "/news")).toBe(false);
  });
});

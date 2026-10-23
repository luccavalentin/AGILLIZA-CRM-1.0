import { describe, expect, it } from "vitest";
import { ALTURA, CAMINHO_UF, LARGURA, NOME_UF, REGIAO_UF, ROTULO_UF, projetar } from "./brasil-geo";

describe("mapa do Brasil", () => {
  const ufs = Object.keys(NOME_UF);

  it("tem os 27 estados, cada um com contorno, rótulo e região", () => {
    expect(ufs).toHaveLength(27);
    for (const uf of ufs) {
      expect(CAMINHO_UF[uf], uf).toMatch(/^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+)+Z$/);
      expect(ROTULO_UF[uf], uf).toBeDefined();
      expect(REGIAO_UF[uf], uf).toBeDefined();
    }
  });

  it("todo ponto e todo rótulo cabem no desenho", () => {
    const numeros = Object.values(CAMINHO_UF)
      .join(" ")
      .match(/[\d.]+/g)!
      .map(Number);
    expect(numeros.every((n) => Number.isFinite(n) && n >= 0)).toBe(true);
    for (const r of Object.values(ROTULO_UF)) {
      const [x, y] = projetar(r.fora ?? r.em);
      expect(x).toBeLessThan(LARGURA - 12);
      expect(y).toBeLessThan(ALTURA);
    }
  });

  it("estados vizinhos dividem a mesma divisa (sem fresta): cada trecho é de no máximo dois estados", () => {
    const usos = new Map<string, number>();
    for (const d of Object.values(CAMINHO_UF)) {
      const pts = d.slice(1, -1).split("L");
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const k = [a, b].sort().join("|");
        usos.set(k, (usos.get(k) ?? 0) + 1);
      }
    }
    expect(Math.max(...usos.values())).toBeLessThanOrEqual(2);
    // Divisa compartilhada de verdade: SP–PR, BA–MG, RS–SC etc. aparecem duas vezes.
    expect([...usos.values()].filter((n) => n === 2).length).toBeGreaterThan(60);
  });
});

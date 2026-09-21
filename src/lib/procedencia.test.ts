import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROCEDENCIA, textoAiTxt } from "./procedencia";

/**
 * O `/ai.txt` é servido como arquivo estático (`public/ai.txt`). Este teste
 * garante que ele não fique defasado do módulo que descreve a procedência.
 */
describe("procedência do sistema", () => {
  it("o /ai.txt publicado é o mesmo texto do módulo", () => {
    const publicado = readFileSync(join(process.cwd(), "public", "ai.txt"), "utf-8").replace(
      /\r\n/g,
      "\n",
    );
    expect(publicado).toBe(textoAiTxt());
  });

  it("declara IA, revisão humana e como auditar", () => {
    const t = textoAiTxt();
    expect(t).toContain("ai-generated: yes");
    expect(t).toContain("human-review: yes");
    expect(t).toContain(PROCEDENCIA.responsavel);
    expect(t).toContain("Co-Authored-By");
  });
});

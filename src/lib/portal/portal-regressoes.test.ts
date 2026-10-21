import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pollingPortal, POLL_ATENDENTES_MS, POLL_MENSAGENS_MS } from "./polling";
import { rotuloRelatorio } from "@/lib/relatorios/shared";

/**
 * Regressões do portal do cliente e das telas de login (QA 21/10/2026).
 * Lê o próprio código: os dois erros abaixo não aparecem na tela.
 */
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? arquivos(join(dir, e.name))
      : /\.(tsx?|jsx?)$/.test(e.name) && !e.name.endsWith(".test.ts")
        ? [join(dir, e.name)]
        : [],
  );
}

describe("portal do cliente", () => {
  it("não grava CPF/CNPJ/e-mail do login no localStorage", () => {
    // Só as telas de entrada e seus componentes: varrer o src inteiro passava
    // do tempo-limite do teste quando a suíte roda em paralelo.
    const gravam = [join(raiz, "routes"), join(raiz, "components", "auth")]
      .flatMap((d) => arquivos(d))
      .filter((f) => /setItem\(\s*["']last_logged_in_email["']/.test(readFileSync(f, "utf8")));
    expect(gravam).toEqual([]);
  }, 20_000);

  it("não consulta conversas e mensagens a cada poucos segundos", () => {
    expect(POLL_ATENDENTES_MS).toBeGreaterThanOrEqual(15_000);
    expect(POLL_MENSAGENS_MS).toBeGreaterThanOrEqual(15_000);
    const opcoes = pollingPortal(POLL_MENSAGENS_MS);
    expect(opcoes.refetchIntervalInBackground).toBe(false);
    expect(opcoes.refetchInterval({ state: { status: "error" } })).toBe(false);
    expect(opcoes.refetchInterval({ state: { status: "success" } })).toBe(POLL_MENSAGENS_MS);

    // Um intervalo curto em qualquer observador da mesma chave vale para todos.
    const curtos = [
      ...arquivos(join(raiz, "components", "cliente")),
      ...arquivos(join(raiz, "routes")).filter((f) => /cliente/.test(f)),
    ].filter((f) =>
      /refetchInterval:[^\n]*\b([0-9]{3,4}|1[0-4]_?[0-9]{3})\)/.test(readFileSync(f, "utf8")),
    );
    expect(curtos).toEqual([]);
  });
});

describe("relatórios", () => {
  it("mostra o nome do relatório, não o código", () => {
    expect(rotuloRelatorio("app-cliente")).toBe("App do cliente");
    expect(rotuloRelatorio("propostas-aprovadas")).toBe("Propostas aprovadas");
    expect(rotuloRelatorio("algo_novo")).toBe("Algo novo");
  });
});

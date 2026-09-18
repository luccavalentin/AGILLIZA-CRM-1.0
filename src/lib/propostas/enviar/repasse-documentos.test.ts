import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/simulacao/homefin.server", () => ({}));
vi.mock("@/lib/bancos/agencia", () => ({ ehAgenciaDoBradesco: () => true }));

import { itemAguardandoRepasse } from "./documentos.server";

const base = {
  arquivos: [{ idArquivo: 1155 }],
  tipoSituacao: "A",
  integravelBradesco: true,
  situacaoIntegracao: "pending",
};

describe("itemAguardandoRepasse", () => {
  it("aprovado na HomeFin, com arquivo e ainda pendente no banco: tenta de novo", () => {
    // Matrícula da PRO-000404 (op 31430): subiu em 17/09 e ficou `pending`.
    expect(itemAguardandoRepasse(base)).toBe(true);
  });

  it("já no banco, sem arquivo, não aprovado ou não integrável: não mexe", () => {
    expect(itemAguardandoRepasse({ ...base, situacaoIntegracao: "success" })).toBe(false);
    expect(itemAguardandoRepasse({ ...base, arquivos: [] })).toBe(false);
    expect(itemAguardandoRepasse({ ...base, tipoSituacao: "I" })).toBe(false);
    expect(itemAguardandoRepasse({ ...base, integravelBradesco: false })).toBe(false);
  });
});

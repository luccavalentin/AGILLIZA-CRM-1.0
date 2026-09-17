import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/simulacao/homefin.server", () => ({}));

import { resumoDoChecklist } from "./documentos.server";

describe("resumo das pendências do checklist do banco", () => {
  it("conta vagas sem arquivo, recusadas, em análise e no banco; ignora dispensadas", () => {
    const arq = [{ idArquivo: "1", nomeArquivo: "x.pdf" }];
    expect(
      resumoDoChecklist([
        { tipoSituacao: "P", arquivos: [] },
        { tipoSituacao: "D", arquivos: [] },
        { tipoSituacao: "R", comentarioAnalise: "ilegível", arquivos: arq },
        { tipoSituacao: "I", arquivos: arq },
        { tipoSituacao: "A", situacaoIntegracao: "success", arquivos: arq },
        { tipoSituacao: "A", situacaoIntegracao: "error", arquivos: arq },
      ]),
    ).toEqual({ semArquivo: 1, recusados: 2, emAnalise: 1, noBanco: 1 });
  });
});

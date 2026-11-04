import { describe, expect, it } from "vitest";
import * as XLSX from "@e965/xlsx";
import { lerPlanilhaGenerica } from "./planilhas";

/* QA de 03/11/2026 (A1): a troca de `xlsx` por `@e965/xlsx` (e02c464a) deixou a leitura
   importando o pacote antigo, que não está mais instalado. Estes testes leem planilhas de
   verdade, em CSV e em .xlsx, pelo mesmo caminho do comparador. */
describe("lerPlanilhaGenerica", () => {
  it("lê um CSV com cabeçalhos em português", async () => {
    const csv = "Proposta;Nome;Valor\n12345;Maria Souza;1.500,00\n";
    const linhas = await lerPlanilhaGenerica(new File([csv], "banco.csv"), "banco");
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ numeroProposta: "12345", nome: "Maria Souza", lado: "banco" });
  });

  it("lê um .xlsx binário", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Proposta", "Nome"], ["987", "João Lima"]]), "A");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const linhas = await lerPlanilhaGenerica(new File([buf], "controle.xlsx"), "controle");
    expect(linhas).toEqual([expect.objectContaining({ numeroProposta: "987", nome: "João Lima" })]);
  });
});

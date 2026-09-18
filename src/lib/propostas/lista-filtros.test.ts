import { describe, expect, it } from "vitest";
import { clausulasDeBusca } from "./lista-filtros";
import { grupoDoStatus, statusDoGrupo } from "./status-grupos";

describe("busca da listagem de propostas", () => {
  it("nome não gera comparação de CPF (que casava com tudo)", () => {
    const c = clausulasDeBusca("Elisabeth");
    expect(c.some((x) => x.startsWith("cpf_cnpj"))).toBe(false);
    expect(c).toContain("nome_cliente.ilike.%Elisabeth%");
  });

  it("documento procura pelos dígitos", () => {
    expect(clausulasDeBusca("274.934.178-73")).toContain("cpf_cnpj.ilike.%27493417873%");
  });

  it("número da proposta procura nos dois números", () => {
    const c = clausulasDeBusca("PRO-000311");
    expect(c).toContain("numero_proposta.ilike.%PRO-000311%");
    expect(c).toContain("numero_proposta_banco.ilike.%PRO-000311%");
    // "000311" tem dígitos: o CPF entra junto, sem atrapalhar.
    expect(c).toContain("cpf_cnpj.ilike.%000311%");
  });

  it("termo vazio não filtra nada", () => {
    expect(clausulasDeBusca("   ")).toEqual([]);
  });
});

describe("grupos de status", () => {
  it("todo status do grupo volta pelo mapa do grupo", () => {
    for (const grupo of ["enviadas", "aprovadas", "recusadas", "canceladas"] as const) {
      const lista = statusDoGrupo(grupo);
      expect(lista.length).toBeGreaterThan(0);
      for (const s of lista) expect(grupoDoStatus(s)).toBe(grupo);
    }
  });

  it("rascunho e erro de envio não entram em grupo nenhum", () => {
    expect(grupoDoStatus("rascunho")).toBeNull();
    expect(grupoDoStatus("erro_envio")).toBeNull();
  });
});

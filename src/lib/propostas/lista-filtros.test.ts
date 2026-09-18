import { describe, expect, it } from "vitest";
import { aplicarFiltrosPropostas, clausulasDeBusca, ID_INEXISTENTE } from "./lista-filtros";
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
  });

  it("termo vazio não filtra nada", () => {
    expect(clausulasDeBusca("   ")).toEqual([]);
  });
});

/** Consulta de mentira: encadeia como a do Supabase e guarda o que recebeu. */
function consultaFalsa() {
  const chamadas: string[] = [];
  const q: any = {
    chamadas,
    // O builder do Supabase é um thenable — o dublê também é, para pegar quem
    // usar `await` antes da hora (foi o que derrubou a lista em 17/09/2026).
    then: (resolver: any) => resolver({ data: [], error: null, count: 0 }),
    order: () => q,
  };
  for (const m of ["is", "not", "or", "eq", "in", "gte", "lte"]) {
    q[m] = (...args: any[]) => {
      const texto = args.map((a) => (Array.isArray(a) ? a.join("|") : String(a))).join(",");
      chamadas.push(`${m}:${texto}`);
      return q;
    };
  }
  return q;
}

describe("montagem dos filtros da listagem", () => {
  it("devolve a consulta para ordenar e paginar depois, sem executá-la", () => {
    const q = aplicarFiltrosPropostas(consultaFalsa(), { escopo: "todas" });
    expect(typeof (q as any).order).toBe("function");
    // Função síncrona: `await` sobre ela executaria a consulta antes da hora.
    expect(aplicarFiltrosPropostas(consultaFalsa(), {})).not.toBeInstanceOf(Promise);
  });

  it("ativas por padrão; aba de excluídas inverte", () => {
    expect(consultaDe({}).chamadas).toContain("is:deleted_at,null");
    expect(consultaDe({ apenas_excluidas: true }).chamadas).toContain("not:deleted_at,is,null");
  });

  it("'minhas' pega responsável, criador e os clientes do usuário", () => {
    const c = consultaDe({ escopo: "minhas", userId: "u1", clientesDoUsuario: ["c1", "c2"] });
    expect(c.chamadas.join(" ")).toContain("usuario_responsavel_id.eq.u1");
    expect(c.chamadas.join(" ")).toContain("cliente_id.in.(c1,c2)");
  });

  it("parceiro sem cliente nenhum devolve lista vazia, não a lista inteira", () => {
    const c = consultaDe({ clientesPorParceiro: [[]] });
    expect(c.chamadas).toContain(`eq:id,${ID_INEXISTENTE}`);
  });

  it("grupo do card filtra por status no banco", () => {
    const c = consultaDe({ statusDoGrupo: statusDoGrupo("recusadas") });
    expect(c.chamadas.some((x: string) => x.startsWith("in:status"))).toBe(true);
  });
});

function consultaDe(f: Parameters<typeof aplicarFiltrosPropostas>[1]) {
  return aplicarFiltrosPropostas(consultaFalsa(), f) as any;
}

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

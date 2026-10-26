import { beforeAll, describe, expect, it } from "vitest";

/*
 * PDF da simulação (pedido do dono, 26/10/2026): "não sai os dados do cliente
 * completo". O bloco do proponente tem de trazer tudo o que a simulação guarda
 * do cliente — titular, cônjuge, composição de renda, renda considerada e imóvel.
 */

let dadosDoProponente: (s: any) => { titulo: string; itens: { rotulo: string; valor: string }[] }[];

beforeAll(async () => {
  // A paleta do PDF lê o tema do documento ao carregar o módulo.
  (globalThis as any).document ??= {
    documentElement: { classList: { contains: () => false } },
  };
  (globalThis as any).localStorage ??= { getItem: () => null, setItem() {} };
  ({ dadosDoProponente } = await import("./simulacao-pdf"));
});

const base = {
  id: "sim-1",
  tipo_pessoa: "PF",
  nome_cliente: "Maria Aparecida dos Santos",
  cpf_cnpj: "52998224725",
  data_nascimento: "1985-04-12",
  sexo: "F",
  estado_civil: "CA",
  regime_casamento: "comunhao_parcial",
  email: "maria@exemplo.com.br",
  celular: "11987654321",
  renda_total: 28000,
  possui_conjuge: true,
  compoe_renda_conjuge: true,
  nome_conjuge: "José Roberto",
  cpf_conjuge: "11144477735",
  data_nascimento_conjuge: "1982-09-30",
  sexo_conjuge: "M",
  email_conjuge: "jose@exemplo.com.br",
  celular_conjuge: "11912345678",
  renda_conjuge: 12000,
  uf: "SP",
  cep_imovel: "01310100",
  situacao_imovel: "U",
  utiliza_fgts: "S",
  _participantes: [
    { nome: "Ana Beatriz", vinculo: "Filho(a)", cpf_cnpj: "39053344705", data_nascimento: "2001-02-03", estado_civil: "S", renda: 4500, compoe_renda: true },
    { nome: "Carlos", vinculo: "Pai", cpf_cnpj: "86288366757", renda: 3000, compoe_renda: false },
  ],
};

const mapa = (s: any) =>
  Object.fromEntries(
    dadosDoProponente(s).map((sec) => [sec.titulo, Object.fromEntries(sec.itens.map((i) => [i.rotulo, i.valor.replace(/ /g, " ")]))]),
  );

describe("dados do proponente no PDF", () => {
  it("titular completo: documento, nascimento, sexo, estado civil, regime, contato e renda", () => {
    const t = mapa(base)["Dados do proponente"]!;
    expect(t).toMatchObject({
      Titular: "MARIA APARECIDA DOS SANTOS",
      CPF: "529.982.247-25",
      "Data de nascimento": "12/04/1985",
      Sexo: "Feminino",
      "Estado civil": "Casado(a)",
      "Regime de casamento": "Comunhão parcial",
      "E-mail": "maria@exemplo.com.br",
      Celular: "(11) 98765-4321",
      "Renda do titular": "R$ 28.000,00",
    });
  });

  it("cônjuge com contato, renda e se compõe renda", () => {
    expect(mapa(base)["Cônjuge / coobrigado"]).toMatchObject({
      Nome: "JOSÉ ROBERTO",
      CPF: "111.444.777-35",
      "E-mail": "jose@exemplo.com.br",
      Celular: "(11) 91234-5678",
      "Renda do cônjuge": "R$ 12.000,00",
      "Compõe renda": "Sim",
    });
  });

  it("composição de renda lista cada participante", () => {
    const secao = dadosDoProponente(base).find((s) => s.titulo === "Composição de renda")!;
    const valores = secao.itens.map((i) => i.valor);
    expect(valores).toContain("ANA BEATRIZ");
    expect(valores).toContain("CARLOS");
    expect(valores).toContain("Filho(a)");
    expect(valores).toContain("Não");
  });

  it("renda total considerada = a que vai ao banco (titular + cônjuge que compõe + quem compõe)", () => {
    expect(mapa(base)["Renda e imóvel"]).toMatchObject({
      "Renda total considerada": "R$ 44.500,00",
      "Utiliza FGTS": "Sim",
      "Situação do imóvel": "Usado",
      "UF do imóvel": "SP",
      "CEP do imóvel": "01310-100",
    });
  });

  it("solteiro sem cônjuge e sem participantes: sem essas seções; campo vazio vira traço", () => {
    const secs = mapa({ ...base, estado_civil: "S", nome_conjuge: "", possui_conjuge: false, _participantes: [], email: "" });
    expect(Object.keys(secs)).toEqual(["Dados do proponente", "Renda e imóvel"]);
    expect(secs["Dados do proponente"]!["E-mail"]).toBe("—");
    expect(secs["Dados do proponente"]!["Regime de casamento"]).toBeUndefined();
  });
});

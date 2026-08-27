import { describe, expect, it } from "vitest";
import { validarCamposSimulacao } from "./campos-obrigatorios";

/** Simulação completa de um titular, preenchida à mão (sem vínculo com o CRM). */
const baseSolteiro = {
  id_operacao_homefin: 1,
  tipo_imovel: "AP",
  uso_imovel: "R",
  situacao_imovel: "U",
  uf: "SP",
  valor_imovel: 500000,
  valor_financiamento: 400000,
  prazo: 360,
  sistema_amortizacao: "S",
  nome_cliente: "MARIA DE SOUZA",
  cpf_cnpj: "12345678909",
  data_nascimento: "1990-05-10",
  sexo: "F",
  email: "maria@exemplo.com",
  celular: "11999998888",
  renda_total: 12000,
  estado_civil: "S",
};

const pedeSexoDoConjuge = (sim: any) =>
  validarCamposSimulacao(sim).some((c) => c.campo === "Sexo do cônjuge");

describe("validarCamposSimulacao — sexo do cônjuge", () => {
  it("não exige para titular solteiro preenchido manualmente", () => {
    expect(pedeSexoDoConjuge(baseSolteiro)).toBe(false);
  });

  it("não exige para solteiro mesmo com possui_conjuge residual ligado", () => {
    // A flag sobrevive a trocas de estado civil e a cadastros herdados; ela
    // não pode, sozinha, bloquear a simulação de um solteiro.
    expect(pedeSexoDoConjuge({ ...baseSolteiro, possui_conjuge: true })).toBe(false);
  });

  it("não exige para solteiro com sobras de dados do cônjuge no formulário", () => {
    expect(
      pedeSexoDoConjuge({
        ...baseSolteiro,
        possui_conjuge: true,
        nome_conjuge: "JOÃO",
        cpf_conjuge: "98765432100",
      }),
    ).toBe(false);
  });

  it("não exige para casado enquanto o cônjuge não foi identificado", () => {
    expect(
      pedeSexoDoConjuge({ ...baseSolteiro, estado_civil: "CA", possui_conjuge: true }),
    ).toBe(false);
  });

  it("exige para casado com cônjuge identificado e sexo em branco", () => {
    expect(
      pedeSexoDoConjuge({
        ...baseSolteiro,
        estado_civil: "CA",
        nome_conjuge: "JOÃO DA SILVA",
        cpf_conjuge: "98765432100",
      }),
    ).toBe(true);
  });

  it("aceita o estado civil no formato do CRM (texto) além do código", () => {
    expect(
      pedeSexoDoConjuge({
        ...baseSolteiro,
        estado_civil: "casado",
        nome_conjuge: "JOÃO DA SILVA",
      }),
    ).toBe(true);
    expect(pedeSexoDoConjuge({ ...baseSolteiro, estado_civil: "solteiro" })).toBe(false);
  });

  it("não exige quando casado, identificado e o sexo já está preenchido", () => {
    expect(
      pedeSexoDoConjuge({
        ...baseSolteiro,
        estado_civil: "CA",
        nome_conjuge: "JOÃO DA SILVA",
        sexo_conjuge: "M",
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// O bloqueio real chegava pelo schema, não por `validarCamposSimulacao`: o
// enum de `sexo_conjuge` reprovava string vazia, e o erro saía com o rótulo
// "Sexo do cônjuge".
// ---------------------------------------------------------------------------
import { completaSchema } from "./schemas";

const simulacaoCompletaSolteiro = {
  ...baseSolteiro,
  produto: "financiamento_imobiliario",
  cep_imovel: "01001000",
  valor_entrada: 100000,
  utiliza_fgts: "N",
  bancos_ids: ["11111111-1111-4111-8111-111111111111"],
  consentimento_lgpd: true,
  consentimento_scr: true,
};

const errosDe = (dados: any) => {
  const r = completaSchema.safeParse(dados);
  return r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
};

describe("completaSchema — sexo do cônjuge", () => {
  it("aceita solteiro com sexo_conjuge vazio (vindo da limpeza do formulário)", () => {
    expect(errosDe({ ...simulacaoCompletaSolteiro, sexo_conjuge: "" })).not.toContain(
      "sexo_conjuge",
    );
  });

  it("aceita solteiro com sexo_conjuge nulo ou ausente", () => {
    expect(errosDe({ ...simulacaoCompletaSolteiro, sexo_conjuge: null })).not.toContain(
      "sexo_conjuge",
    );
    expect(errosDe(simulacaoCompletaSolteiro)).not.toContain("sexo_conjuge");
  });

  it("continua exigindo de casado que compõe renda com cônjuge identificado", () => {
    expect(
      errosDe({
        ...simulacaoCompletaSolteiro,
        estado_civil: "CA",
        nome_conjuge: "JOÃO DA SILVA",
        compoe_renda_conjuge: true,
        sexo_conjuge: "",
      }),
    ).toContain("sexo_conjuge");
  });
});

// ---------------------------------------------------------------------------
// Pessoa jurídica: empresa não tem sexo nem estado civil. Exigi-los travava o
// envio da modalidade inteira.
// ---------------------------------------------------------------------------
const basePJ = {
  ...simulacaoCompletaSolteiro,
  tipo_pessoa: "PJ",
  nome_cliente: "CONSTRUTORA LELO LTDA",
  cpf_cnpj: "11222333000181",
  sexo: "",
  estado_civil: "",
};

describe("pessoa jurídica", () => {
  it("não exige sexo nem estado civil de PJ", () => {
    const campos = validarCamposSimulacao(basePJ).map((c) => c.campo);
    expect(campos).not.toContain("Sexo");
    expect(campos).not.toContain("Estado civil");
  });

  it("continua exigindo os dois de pessoa física", () => {
    const campos = validarCamposSimulacao({
      ...basePJ,
      tipo_pessoa: "PF",
      cpf_cnpj: "12345678909",
    }).map((c) => c.campo);
    expect(campos).toContain("Sexo");
    expect(campos).toContain("Estado civil");
  });

  it("o schema aceita PJ sem sexo e sem estado civil", () => {
    const erros = errosDe(basePJ);
    expect(erros).not.toContain("sexo");
    expect(erros).not.toContain("estado_civil");
  });

  it("o schema segue exigindo os dois em PF", () => {
    const erros = errosDe({ ...basePJ, tipo_pessoa: "PF", cpf_cnpj: "12345678909" });
    expect(erros).toContain("sexo");
    expect(erros).toContain("estado_civil");
  });
});

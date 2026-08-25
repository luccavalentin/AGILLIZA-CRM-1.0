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

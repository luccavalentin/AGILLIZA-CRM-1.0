import { describe, expect, it } from "vitest";
import { ehPropostaJaNoBanco } from "./helpers-retorno.server";

// Retorno real do Bradesco na PRO-000471 (20/09/2026): o operador definiu a
// agência, reenviou e o banco recusou porque a proposta do primeiro envio já
// estava lá. Isso não é falha de integração.
const RETORNO_103 = JSON.stringify({
  codigo: "103",
  mensagem:
    "Já existe proposta em análise para o cpf informado, por favor, aguarde o resultado da análise para iniciar uma nova proposta.[cpfcnpj = '43226056808']",
});

describe("proposta já em análise no banco", () => {
  it("reconhece o retorno do Bradesco, como texto ou objeto", () => {
    expect(ehPropostaJaNoBanco(RETORNO_103)).toBe(true);
    expect(ehPropostaJaNoBanco(JSON.parse(RETORNO_103))).toBe(true);
  });

  it("reconhece pelo texto, mesmo sem o código", () => {
    expect(
      ehPropostaJaNoBanco({ mensagem: "Ja existe proposta em analise para o CPF informado" }),
    ).toBe(true);
    expect(ehPropostaJaNoBanco("Já existe proposta em análise para o cpf informado")).toBe(true);
  });

  it("não confunde com as outras recusas", () => {
    expect(ehPropostaJaNoBanco(null)).toBe(false);
    expect(ehPropostaJaNoBanco({ codigo: "514", mensagem: "Crédito não aprovado" })).toBe(false);
    expect(ehPropostaJaNoBanco("Erro desconhecido na integração Itaú")).toBe(false);
    expect(ehPropostaJaNoBanco({ codigo: "121-L", mensagem: "" })).toBe(false);
  });
});

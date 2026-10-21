import { describe, expect, it } from "vitest";
import { ehCancelamento, mensagemDeErro } from "./mensagem";

describe("cancelamento não é falha", () => {
  it("reconhece o CancelledError do React Query", () => {
    const e = new Error("CancelledError");
    e.name = "CancelledError";
    expect(ehCancelamento(e)).toBe(true);
    expect(ehCancelamento({ message: "CancelledError" })).toBe(true);
    expect(ehCancelamento(new DOMException("The operation was aborted.", "AbortError"))).toBe(true);
  });

  it("erro de verdade continua sendo erro", () => {
    expect(ehCancelamento(new Error("O banco recusou a proposta."))).toBe(false);
    expect(ehCancelamento(null)).toBe(false);
  });
});

describe("mensagem para a tela", () => {
  it("queda de rede vira aviso de conexão", () => {
    expect(mensagemDeErro(new Error("Failed to fetch"), "x")).toMatch(/Sem conexão/);
  });

  it("mensagem do banco passa intacta", () => {
    const msg = "Já existe proposta em análise para o cpf informado";
    expect(mensagemDeErro(new Error(msg), "x")).toBe(msg);
  });
});

describe("erro técnico vira frase", () => {
  it("validação do servidor (Zod) vira frase por campo", () => {
    const zod = JSON.stringify([
      { code: "too_big", maximum: 31, path: ["dia_pagamento_salario"], message: "Number must be less than or equal to 31" },
    ]);
    expect(mensagemDeErro(new Error(zod), "x")).toBe("Dia pagamento salario: o máximo é 31.");
  });

  it("data vazia no banco vira aviso de data", () => {
    expect(mensagemDeErro(new Error('invalid input syntax for type date: ""'), "x")).toBe(
      "Data inválida ou não informada.",
    );
  });

  it("restrição do banco não aparece crua", () => {
    const pg = 'new row for relation "rh_documentos_checklist" violates check constraint "rh_documentos_checklist_status_check"';
    expect(mensagemDeErro(new Error(pg), "x")).toBe("Valor não permitido para este campo.");
  });

  it("texto que começa com colchete mas não é validação passa intacto", () => {
    expect(mensagemDeErro(new Error("[Banco] recusou"), "x")).toBe("[Banco] recusou");
  });
});

describe("mensagem própria do schema", () => {
  it("mensagem em português definida no schema é a que aparece", () => {
    const zod = JSON.stringify([
      { code: "too_small", minimum: 0, path: ["valor"], message: "Informe um valor maior que zero." },
    ]);
    expect(mensagemDeErro(new Error(zod), "x")).toBe("Informe um valor maior que zero.");
  });
});

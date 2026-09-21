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

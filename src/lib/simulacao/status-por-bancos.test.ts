import { describe, expect, it } from "vitest";
import { statusPorBancos } from "./simulacoes.functions";

describe("statusPorBancos", () => {
  it("é 'simulada' quando todos os bancos responderam", () => {
    expect(statusPorBancos(["simulada", "simulada", "simulada"])).toBe("simulada");
  });

  it("é 'enviando' enquanto nenhum banco respondeu", () => {
    expect(statusPorBancos(["aguardando", "aguardando"])).toBe("enviando");
    expect(statusPorBancos(["enviando", "aguardando"])).toBe("enviando");
  });

  it("mostra o que já voltou quando um banco ainda está em análise", () => {
    // O caso real de 09/09: Bradesco e Itaú devolveram em segundos e o
    // Santander ficou pendurado. A simulação inteira aparecia como
    // "Em análise" e o operador não via nenhum valor.
    expect(statusPorBancos(["simulada", "simulada", "aguardando"])).toBe("parcialmente_simulada");
  });

  it("também é parcial quando um banco deu erro e outro respondeu", () => {
    expect(statusPorBancos(["simulada", "erro"])).toBe("parcialmente_simulada");
  });

  it("continua 'enviando' quando um deu erro e o outro ainda espera", () => {
    // Nada voltou com valor: não há o que mostrar, e o banco pendente ainda
    // pode responder.
    expect(statusPorBancos(["erro", "aguardando"])).toBe("enviando");
  });

  it("é 'erro_banco' quando todos falharam", () => {
    expect(statusPorBancos(["erro", "erro"])).toBe("erro_banco");
  });
});

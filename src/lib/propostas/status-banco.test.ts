import { describe, expect, it } from "vitest";
import { statusInternoBanco } from "./enviar/helpers-retorno.server";

/**
 * `tipoSituacao` da integração, conforme a documentação:
 *   S = Sem Integração
 *   P = Erro ao Enviar Proposta
 *   N = Análise de Crédito
 *   A = Crédito Aprovado
 *   R = Crédito Recusado
 */
describe("statusInternoBanco — tipoSituacao do provedor", () => {
  it('"N" é análise de crédito, não recusa', () => {
    const r = statusInternoBanco("N", false, null);
    expect(r.banco).toBe("em_analise");
    expect(r.proposta).toBe("em_analise_credito");
  });

  it('"R" é recusa', () => {
    expect(statusInternoBanco("R", false, null).proposta).toBe("credito_recusado");
  });

  it('"A" é aprovação', () => {
    expect(statusInternoBanco("A", false, null).proposta).toBe("credito_aprovado");
  });

  it('"C" (condicionada) é desfecho favorável', () => {
    expect(statusInternoBanco("C", false, null).proposta).toBe("credito_aprovado");
  });

  it("recusa explícita no código do banco continua sendo recusa", () => {
    expect(statusInternoBanco("N", false, "CREDITO RECUSADO").proposta).toBe("credito_recusado");
    expect(statusInternoBanco("N", false, "514").proposta).toBe("credito_recusado");
  });

  it("regressão: a proposta 5495683 voltou com N e foi exibida como recusada", () => {
    // Retorno real do Bradesco em 08/09/2026: tipoSituacao "N", sem
    // codigoSituacaoBanco e sem retornoIntegracao — ou seja, em análise.
    const r = statusInternoBanco("N", false, null);
    expect(r.proposta).not.toBe("credito_recusado");
  });
});

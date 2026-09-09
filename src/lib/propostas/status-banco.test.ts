import { describe, expect, it } from "vitest";
import {
  ehFalhaIntegracaoBanco,
  situacaoBancoDeTipo,
  statusInternoBanco,
} from "./enviar/helpers-retorno.server";

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

  it('"C" é desfecho favorável, porém condicionado', () => {
    // Favorável (o crédito saiu), mas com exigência a cumprir — por isso não
    // entra como aprovação plena.
    expect(statusInternoBanco("C", false, null).proposta).toBe("credito_condicionado");
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

  it("regressão: a PRO-000258 voltou E sem mensagem e foi exibida como enviada", () => {
    // Retorno real do POST /incluir-proposta-integracao em 08/09/2026: HTTP 200,
    // `tipoSituacao: "E"`, nenhum protocolo e `retornoIntegracao: null`. A
    // proposta nunca saiu da fila do provedor (`dataHoraEnvioIntegracao: null`)
    // e continuava "E" meia hora depois — é recusa definitiva, não espera.
    const respostaReal = {
      idBanco: 45,
      idSimulacao: 93588,
      tipoSituacao: "E",
      retornoIntegracao: null,
      codigoSituacaoBanco: null,
      codigoOportunidadeBanco: null,
      codigoSimulacaoBanco: null,
      dataHoraEnvioIntegracao: null,
      dataHoraRetornoIntegracao: null,
    };

    expect(ehFalhaIntegracaoBanco(respostaReal)).toBe(true);
    expect(statusInternoBanco("E", false, null, respostaReal).banco).toBe("erro");
  });

  // Domínio oficial do swagger 29/01/2026: S/P/N/A/R =
  // Sem Integração / Erro ao Enviar Proposta / Análise Crédito /
  // Crédito Aprovado / Crédito Recusado.
  it('"S" é "Sem Integração": a proposta não foi ao banco', () => {
    const r = statusInternoBanco("S", false, null);
    expect(r.banco).toBe("nao_enviado");
    expect(r.proposta).toBeNull();
    expect(situacaoBancoDeTipo("S")).toBe("nao_enviado");
  });

  it('"P" é "Erro ao Enviar Proposta"', () => {
    expect(statusInternoBanco("P", false, null).banco).toBe("erro");
  });

  // Caso comprovado: a PRO-000261 voltou com `tipoSituacao: "C"` e
  // `codigoSituacaoBanco: "900"`, e no portal do próprio Santander aparece
  // como "Crédito aprovado mediante a comprovação de renda". O sistema exibia
  // "Crédito aprovado", e o operador seguiria sem saber da exigência.
  it('"C" é aprovação COM condições (PRO-000261, código 900)', () => {
    const r = statusInternoBanco("C", false, "900");
    expect(r.banco).toBe("condicionado");
    expect(r.proposta).toBe("credito_condicionado");
  });

  it("texto de exigência marca condicionado em qualquer banco", () => {
    for (const codigo of [
      "CREDITO APROVADO MEDIANTE COMPROVACAO DE RENDA",
      "APROVADO SUJEITO A ANALISE DOCUMENTAL",
    ]) {
      expect(statusInternoBanco("A", false, codigo).proposta).toBe("credito_condicionado");
    }
  });

  it("514 desfavorável continua sendo recusa", () => {
    const r = statusInternoBanco("R", false, "514 - ANALISE AUTOMATICA DESFAVORAVEL");
    expect(r.proposta).toBe("credito_recusado");
  });

  it("condicionado vem do texto do banco e tem status próprio", () => {
    for (const codigo of [
      "CREDITO APROVADO CONDICIONADO",
      "APROVADO COM RESSALVA",
      "APROVADO COM EXIGENCIA",
    ]) {
      const r = statusInternoBanco("A", false, codigo);
      expect(r.banco).toBe("condicionado");
      expect(r.proposta).toBe("credito_condicionado");
    }
  });

  it("condicionado ganha da aprovação quando o retorno diz as duas coisas", () => {
    // "aprovado condicionado" casa com "aprov" e com "cond"; a condição manda.
    expect(statusInternoBanco("A", false, "APROVADO CONDICIONADO").proposta).toBe(
      "credito_condicionado",
    );
  });
});

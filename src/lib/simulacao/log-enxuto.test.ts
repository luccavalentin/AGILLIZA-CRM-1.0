import { describe, it, expect } from "vitest";
import { enxugarRespostaDeLog } from "./homefin.server";

/** Resposta real do `GET /oportunidade/{id}`, encurtada. */
const oportunidade = {
  etapa: [
    { idEtapa: 1, nomeEtapa: "Simulação", active: true, completed: false },
    { idEtapa: 2, nomeEtapa: "Crédito", active: false, completed: false },
  ],
  oportunidade: { tipoSituacao: "A", codigoOportunidadeBanco: "XPTO-1" },
  participantes: [{ idParticipante: 1 }, { idParticipante: 2 }],
  simulacoes: [{ idSimulacao: 89125, tipoSituacao: "A", valorParcelaBanco: 5927.14, lixo: "x" }],
};

describe("log da integração — encolher só o que não é lido", () => {
  it("resume a consulta de acompanhamento bem-sucedida", () => {
    const r = enxugarRespostaDeLog("/oportunidade/27361", "GET", 200, oportunidade) as any;
    expect(r._resumido).toBe(true);
    expect(r.tipoSituacao).toBe("A");
    expect(r.etapaAtiva).toBe("Simulação");
    expect(r.qtdParticipantes).toBe(2);
    expect(r.simulacoes[0].valorParcelaBanco).toBe(5927.14);
    // O peso morto some: nada de etapas inteiras nem participantes completos.
    expect(JSON.stringify(r).length).toBeLessThan(JSON.stringify(oportunidade).length);
  });

  it("mantém o corpo inteiro quando deu erro — é quando ele importa", () => {
    const erro = { message: "Prazo acima do permitido", detalhe: { campo: "prazo" } };
    expect(enxugarRespostaDeLog("/oportunidade/27361", "GET", 400, erro)).toEqual(erro);
    expect(enxugarRespostaDeLog("/oportunidade/27361", "GET", 500, erro)).toEqual(erro);
  });

  it("não mexe no que os envios devolvem — é a trilha de auditoria", () => {
    const retorno = { idSimulacao: 1, retornoIntegracao: "ok", tudo: "preservado" };
    expect(enxugarRespostaDeLog("/oportunidade/1/simulacao", "POST", 200, retorno)).toEqual(retorno);
    expect(
      enxugarRespostaDeLog("/oportunidade/1/incluir-proposta-integracao", "POST", 200, retorno),
    ).toEqual(retorno);
    expect(enxugarRespostaDeLog("/oportunidade/1", "PUT", 200, retorno)).toEqual(retorno);
  });

  it("sub-recurso não é consulta de acompanhamento", () => {
    const checklist = [{ idDocumento: "1", nomeDocumento: "RG" }];
    expect(enxugarRespostaDeLog("/oportunidade/1/documentos", "GET", 200, checklist)).toEqual(
      checklist,
    );
  });

  it("aguenta corpo ausente ou não-objeto", () => {
    expect(enxugarRespostaDeLog("/oportunidade/1", "GET", 200, null)).toBeNull();
    expect(enxugarRespostaDeLog("/oportunidade/1", "GET", 200, "texto")).toBe("texto");
    expect(enxugarRespostaDeLog("/oportunidade/1", "GET", undefined, oportunidade)).toEqual(
      oportunidade,
    );
  });
});

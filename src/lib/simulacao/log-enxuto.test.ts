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

/**
 * Forma do contrato `GetOpportunityOk`: as listas moram DENTRO do envelope
 * `oportunidade`. É a forma que a HomeFin devolve em produção — e a que o
 * resumidor ignorava, gravando `simulacoes: []` em todo log de acompanhamento.
 */
const comEnvelope = {
  etapa: [{ idEtapa: 1, nomeEtapa: "Simulação", active: true }],
  oportunidade: {
    tipoSituacao: "A",
    codigoOportunidadeBanco: "XPTO-1",
    participantes: [{ idParticipante: 1 }, { idParticipante: 2 }],
    simulacoes: [
      {
        idSimulacao: 90271,
        idBanco: 9,
        tipoSituacao: "P",
        valorParcelaBanco: null,
        dataHoraRetornoIntegracao: null,
      },
      { idSimulacao: 90270, idBanco: 45, tipoSituacao: "P", valorParcelaBanco: 4827.11 },
    ],
  },
};

describe("log da integração — envelope `oportunidade`", () => {
  it("lê simulações e participantes de dentro do envelope", () => {
    const r = enxugarRespostaDeLog("/oportunidade/28417", "GET", 200, comEnvelope) as any;
    expect(r.simulacoes).toHaveLength(2);
    expect(r.qtdParticipantes).toBe(2);
    expect(r.tipoSituacao).toBe("A");
  });

  it("preserva o que distingue banco assíncrono pendente de leitura falha", () => {
    const r = enxugarRespostaDeLog("/oportunidade/28417", "GET", 200, comEnvelope) as any;
    const santander = r.simulacoes.find((s: any) => s.idBanco === 9);
    expect(santander.valorParcelaBanco).toBeNull();
    expect(santander.dataHoraRetornoIntegracao).toBeNull();
    const bradesco = r.simulacoes.find((s: any) => s.idBanco === 45);
    expect(bradesco.valorParcelaBanco).toBe(4827.11);
  });

  it("regressão: ler só a raiz devolvia lista vazia", () => {
    // Como o resumidor lia antes:
    expect((comEnvelope as any).simulacoes ?? []).toEqual([]);
    // Como lê agora:
    const r = enxugarRespostaDeLog("/oportunidade/28417", "GET", 200, comEnvelope) as any;
    expect(r.simulacoes.length).toBeGreaterThan(0);
  });
});

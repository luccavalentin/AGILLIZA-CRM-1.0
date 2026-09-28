import { describe, it, expect } from "vitest";
import { enxugarRespostaDeLog } from "./homefin.server";

/**
 * Resposta do `GET /oportunidade/{id}` com o peso que ela tem em produção:
 * etapas e participantes completos. É esse peso que o resumo existe para
 * jogar fora — uma fixture enxuta demais faria a asserção de tamanho medir
 * ruído em vez do ganho real.
 */
const oportunidade = {
  etapa: [
    {
      idEtapa: 1,
      nomeEtapa: "Simulação",
      ordemEtapa: 1,
      active: true,
      completed: false,
      dataHoraCriacao: "2026-09-25T19:37:45.000Z",
      dataHoraAlteracao: "2026-09-25T19:38:18.000Z",
    },
    {
      idEtapa: 2,
      nomeEtapa: "Crédito",
      ordemEtapa: 2,
      active: false,
      completed: false,
      dataHoraCriacao: "2026-09-25T19:37:45.000Z",
      dataHoraAlteracao: null,
    },
  ],
  oportunidade: { tipoSituacao: "A", codigoOportunidadeBanco: "XPTO-1" },
  participantes: [
    { idParticipante: 1, nome: "Fulano de Tal", cpf: "00000000000", tipoSituacao: "A" },
    { idParticipante: 2, nome: "Beltrana de Tal", cpf: "11111111111", tipoSituacao: "A" },
  ],
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
    expect(enxugarRespostaDeLog("/oportunidade/1/simulacao", "POST", 200, retorno)).toEqual(
      retorno,
    );
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

  it("guarda os quatro valores que o sync grava como aprovado", () => {
    // Forma real do retorno da PRO-000577 (25/09/2026): o resumo guardava só a
    // parcela, então não dava para dizer se a taxa tinha vindo do banco ou se
    // era resto da simulação. Sem os quatro, o log não audita a carta.
    const aprovada = {
      oportunidade: {
        tipoSituacao: "A",
        simulacoes: [
          {
            idSimulacao: 113920,
            idBanco: 61,
            tipoSituacao: "A",
            valorParcelaBanco: 3611.16,
            taxaJurosAnoBanco: 10.31,
            valorFinanciamentoBanco: 320000,
            prazoPagamentoBanco: 360,
          },
        ],
      },
    };
    const r = enxugarRespostaDeLog("/oportunidade/33616", "GET", 200, aprovada) as any;
    const itau = r.simulacoes[0];
    expect(itau.valorParcelaBanco).toBe(3611.16);
    expect(itau.taxaJurosAnoBanco).toBe(10.31);
    expect(itau.valorFinanciamentoBanco).toBe(320000);
    expect(itau.prazoPagamentoBanco).toBe(360);
  });

  it("distingue taxa ausente de taxa zero", () => {
    // `null` explícito é a prova de que o banco omitiu o campo — é o que
    // autoriza o sync a deixar o campo aprovado vazio em vez de herdar a
    // simulação.
    const semTaxa = {
      oportunidade: {
        simulacoes: [{ idSimulacao: 1, idBanco: 61, valorParcelaBanco: 3611.16 }],
      },
    };
    const r = enxugarRespostaDeLog("/oportunidade/1", "GET", 200, semTaxa) as any;
    expect(r.simulacoes[0].taxaJurosAnoBanco).toBeNull();
  });

  it("regressão: ler só a raiz devolvia lista vazia", () => {
    // Como o resumidor lia antes:
    expect((comEnvelope as any).simulacoes ?? []).toEqual([]);
    // Como lê agora:
    const r = enxugarRespostaDeLog("/oportunidade/28417", "GET", 200, comEnvelope) as any;
    expect(r.simulacoes.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  minutosUteisEntre,
  prazoSlaDocumentos,
  situacaoDocumentacao,
  somarDiasUteis,
  tempoAtePrazo,
  type DocumentoHomefinLinha,
} from "./documentacao-status";

const doc = (situacao: string, enviado_em = "2026-09-22T10:00:00"): DocumentoHomefinLinha => ({
  situacao,
  mensagem: situacao === "erro" ? "Recusado na análise da HomeFin: ilegível" : null,
  nome_vaga: "RG",
  enviado_em,
  atualizado_em: enviado_em,
});

/**
 * Instantes escritos com o fuso de Brasília explícito: o SLA é contado no
 * expediente de lá, e o teste não pode depender do relógio de quem roda.
 * Em setembro de 2026: 23 é quarta, 25 é sexta, 26 é sábado, 28 é segunda,
 * 29 é terça.
 */
const bsb = (iso: string) => new Date(`${iso}-03:00`);

describe("SLA D+2 dos documentos — conta expediente, não calendário", () => {
  it("quarta 10h vence sexta 10h (8h na quarta, 9h na quinta, 1h na sexta)", () => {
    expect(prazoSlaDocumentos(bsb("2026-09-23T10:00:00")).toISOString()).toBe(
      bsb("2026-09-25T10:00:00").toISOString(),
    );
  });

  it("congela às 18h e volta no dia seguinte", () => {
    // Quarta 17h: sobra 1 h no dia, 9 h na quinta e as 8 h restantes na sexta.
    expect(prazoSlaDocumentos(bsb("2026-09-23T17:00:00")).toISOString()).toBe(
      bsb("2026-09-25T17:00:00").toISOString(),
    );
    // Recebido às 20h, fora do expediente: a contagem só começa às 09h.
    expect(prazoSlaDocumentos(bsb("2026-09-23T20:00:00")).toISOString()).toBe(
      bsb("2026-09-25T18:00:00").toISOString(),
    );
  });

  it("congela no fim de semana", () => {
    // Sexta 17h → 1 h na sexta, 9 h na segunda, 8 h na terça.
    expect(prazoSlaDocumentos(bsb("2026-09-25T17:00:00")).toISOString()).toBe(
      bsb("2026-09-29T17:00:00").toISOString(),
    );
    // Recebido no sábado: começa a contar segunda às 09h.
    expect(prazoSlaDocumentos(bsb("2026-09-26T09:00:00")).toISOString()).toBe(
      bsb("2026-09-29T18:00:00").toISOString(),
    );
  });

  it("minutosUteisEntre ignora noite e fim de semana", () => {
    // Sexta 17h → terça 17h: 1 h + 9 h + 8 h = 18 h de expediente.
    expect(minutosUteisEntre(bsb("2026-09-25T17:00:00"), bsb("2026-09-29T17:00:00"))).toBe(18 * 60);
    // Uma noite inteira não conta nada.
    expect(minutosUteisEntre(bsb("2026-09-23T18:00:00"), bsb("2026-09-24T09:00:00"))).toBe(0);
    // Um fim de semana inteiro também não.
    expect(minutosUteisEntre(bsb("2026-09-25T18:00:00"), bsb("2026-09-28T09:00:00"))).toBe(0);
  });

  it("somarDiasUteis segue existindo para quem quer só a data", () => {
    expect(somarDiasUteis(bsb("2026-09-23T10:00:00"), 2).toISOString()).toBe(
      bsb("2026-09-25T10:00:00").toISOString(),
    );
  });

  it("mostra o tempo restante em expediente — um 'd' são 9 h", () => {
    // Sexta 17h, prazo terça 17h: 18 h de expediente = 2 dias úteis cheios.
    // No calendário seriam "4d 00h", que foi o que o selo mostrava.
    expect(tempoAtePrazo(bsb("2026-09-29T17:00:00"), bsb("2026-09-25T17:00:00"))).toEqual({
      vencido: false,
      urgente: false,
      texto: "2d 00h",
    });
    // A noite não consome prazo: quarta 17h → quinta 10h são 2 h de expediente.
    expect(tempoAtePrazo(bsb("2026-09-24T10:00:00"), bsb("2026-09-23T17:00:00"))).toEqual({
      vencido: false,
      urgente: true,
      texto: "2h 00min",
    });
    // Sábado ao meio-dia: a contagem recomeça segunda às 09h.
    expect(tempoAtePrazo(bsb("2026-09-29T17:00:00"), bsb("2026-09-26T12:00:00"))).toMatchObject({
      vencido: false,
      texto: "1d 08h",
    });
  });

  it("amarelo abaixo de 4 h de expediente", () => {
    const agora = bsb("2026-09-23T10:00:00");
    // 3 h de expediente: perto de estourar.
    expect(tempoAtePrazo(bsb("2026-09-23T13:00:00"), agora).urgente).toBe(true);
    // 5 h: ainda folgado.
    expect(tempoAtePrazo(bsb("2026-09-23T15:00:00"), agora).urgente).toBe(false);
  });

  it("atraso também é contado em expediente", () => {
    // Prazo quarta 16h, agora quinta 11h: 2 h na quarta + 2 h na quinta.
    expect(tempoAtePrazo(bsb("2026-09-23T16:00:00"), bsb("2026-09-24T11:00:00"))).toEqual({
      vencido: true,
      urgente: false,
      texto: "4h 00min",
    });
  });
});

describe("Situação da documentação", () => {
  it("sem documento enviado à HomeFin não há selo, nem na etapa de documentos", () => {
    expect(situacaoDocumentacao("aguardando_documentos", [])).toBeNull();
    expect(situacaoDocumentacao("engenharia_vistoria", null)).toBeNull();
    expect(situacaoDocumentacao("credito_aprovado", [])).toBeNull();
  });

  it("recusado vence em análise, que vence aprovado", () => {
    expect(
      situacaoDocumentacao("aguardando_documentos", [doc("aprovado"), doc("erro"), doc("homefin")]),
    ).toMatchObject({ tipo: "rejeitado", rejeitados: 1, emAnalise: 1, total: 3 });
    expect(
      situacaoDocumentacao("aguardando_documentos", [doc("aprovado"), doc("homefin")]),
    ).toMatchObject({ tipo: "em_analise", emAnalise: 1, total: 2 });
    expect(situacaoDocumentacao("engenharia_vistoria", [doc("aprovado"), doc("enviado")])).toEqual({
      tipo: "aprovado",
      aprovados: 2,
      noBanco: 1,
      total: 2,
      novidadeEm: "2026-09-22T10:00:00",
      naoLido: true,
    });
  });

  describe("aviso de novidade (o que faz o selo piscar)", () => {
    it("documento só enviado e esperando não é novidade", () => {
      // O caso da op 34038: 10 documentos na fila da HomeFin, nenhum decidido.
      // Piscar aqui era alarme falso — não havia o que ler.
      expect(
        situacaoDocumentacao("aguardando_documentos", [doc("homefin"), doc("homefin")]),
      ).toMatchObject({ tipo: "em_analise", novidadeEm: null, naoLido: false });
    });

    it("decisão da HomeFin é novidade, mesmo com outros ainda na fila", () => {
      expect(
        situacaoDocumentacao("aguardando_documentos", [
          doc("homefin", "2026-09-22T10:00:00"),
          doc("aprovado", "2026-09-23T15:00:00"),
        ]),
      ).toMatchObject({ tipo: "em_analise", novidadeEm: "2026-09-23T15:00:00", naoLido: true });
      expect(
        situacaoDocumentacao("aguardando_documentos", [doc("erro", "2026-09-24T08:00:00")]),
      ).toMatchObject({ tipo: "rejeitado", novidadeEm: "2026-09-24T08:00:00", naoLido: true });
    });

    it("leitura posterior à decisão apaga o aviso", () => {
      const docs = [doc("aprovado", "2026-09-26T10:00:00Z")];
      expect(
        situacaoDocumentacao("engenharia_vistoria", docs, "2026-09-26T11:00:00Z"),
      ).toMatchObject({ naoLido: false });
      // Leitura anterior à decisão: ainda há o que ver.
      expect(
        situacaoDocumentacao("engenharia_vistoria", docs, "2026-09-26T09:00:00Z"),
      ).toMatchObject({ naoLido: true });
    });

    it("sem decisão nenhuma, nunca pisca — nem sem marca de leitura", () => {
      expect(situacaoDocumentacao("engenharia_vistoria", [doc("homefin")], null)).toMatchObject({
        naoLido: false,
      });
    });
  });

  it("o SLA conta a partir do documento mais antigo ainda em análise", () => {
    const s = situacaoDocumentacao("aguardando_documentos", [
      doc("homefin", "2026-09-23T15:00:00"),
      doc("homefin", "2026-09-22T09:00:00"),
      doc("aprovado", "2026-09-21T08:00:00"),
    ]);
    expect(s).toMatchObject({ tipo: "em_analise", recebidoEm: "2026-09-22T09:00:00" });
    // Terça 09h + 18 h de expediente: 9 h na terça e 9 h na quarta, vencendo
    // quarta às 18h (antes, contando no calendário, dava quinta às 09h).
    expect(new Date((s as any).prazo).toString()).toBe(new Date("2026-09-23T18:00:00").toString());
  });

  it("proposta encerrada não ganha selo", () => {
    expect(situacaoDocumentacao("cancelada", [doc("erro")])).toBeNull();
    expect(situacaoDocumentacao("credito_recusado", [doc("homefin")])).toBeNull();
  });

  it("ainda no crédito não ganha selo, mesmo com documento enviado", () => {
    expect(situacaoDocumentacao("credito_aprovado", [doc("homefin")])).toBeNull();
    expect(situacaoDocumentacao("credito_condicionado", [doc("erro")])).toBeNull();
    expect(situacaoDocumentacao("aguardando_documentos", [doc("homefin")])).toMatchObject({
      tipo: "em_analise",
    });
  });
});

import { describe, it, expect } from "vitest";
import {
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

describe("SLA D+2 dos documentos", () => {
  it("conta só dias úteis", () => {
    // Quarta 10h → sexta 10h.
    expect(somarDiasUteis(new Date("2026-09-23T10:00:00"), 2).toString()).toBe(
      new Date("2026-09-25T10:00:00").toString(),
    );
    // Sexta 10h → terça 10h (pula sábado e domingo).
    expect(prazoSlaDocumentos("2026-09-25T10:00:00").toString()).toBe(
      new Date("2026-09-29T10:00:00").toString(),
    );
    // Recebido no sábado: segunda é o 1º dia útil, terça o 2º.
    expect(prazoSlaDocumentos("2026-09-26T09:00:00").toString()).toBe(
      new Date("2026-09-29T09:00:00").toString(),
    );
  });

  it("mostra o tempo restante e o atraso", () => {
    const agora = new Date("2026-09-24T10:00:00");
    expect(tempoAtePrazo("2026-09-25T14:30:00", agora)).toEqual({
      vencido: false,
      urgente: false,
      texto: "1d 04h",
    });
    expect(tempoAtePrazo("2026-09-24T12:05:00", agora)).toEqual({
      vencido: false,
      urgente: true,
      texto: "2h 05min",
    });
    // Menos de 12 h: perto de estourar (amarelo).
    expect(tempoAtePrazo("2026-09-24T21:00:00", agora)).toMatchObject({
      vencido: false,
      urgente: true,
    });
    // 13 h ainda está folgado (verde).
    expect(tempoAtePrazo("2026-09-24T23:00:00", agora)).toMatchObject({
      vencido: false,
      urgente: false,
    });
    expect(tempoAtePrazo("2026-09-24T07:00:00", agora)).toEqual({
      vencido: true,
      urgente: false,
      texto: "3h 00min",
    });
  });
});

describe("Situação da documentação", () => {
  it("sem documento: só aparece na etapa de documentos", () => {
    expect(situacaoDocumentacao("aguardando_documentos", [])).toEqual({ tipo: "aguardando" });
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
    });
  });

  it("o SLA conta a partir do documento mais antigo ainda em análise", () => {
    const s = situacaoDocumentacao("aguardando_documentos", [
      doc("homefin", "2026-09-23T15:00:00"),
      doc("homefin", "2026-09-22T09:00:00"),
      doc("aprovado", "2026-09-21T08:00:00"),
    ]);
    expect(s).toMatchObject({ tipo: "em_analise", recebidoEm: "2026-09-22T09:00:00" });
    expect(new Date((s as any).prazo).toString()).toBe(new Date("2026-09-24T09:00:00").toString());
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

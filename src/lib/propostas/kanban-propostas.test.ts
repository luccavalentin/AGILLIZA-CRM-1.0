import { describe, expect, it } from "vitest";
import {
  COLUNAS_KANBAN,
  avaliarSoltura,
  colunaDoStatus,
  colunaDoStatusAssinante,
  diasParado,
  montarPrazos,
  nivelSla,
  podeArrastar,
  proximasEtapasManuais,
  resumoColuna,
} from "./kanban-propostas";

/** Situações da proposta do assinante (mesmas chaves de ROTULO_PROPOSTA_ASSINANTE). */
const SITUACOES_ASSINANTE = [
  "aguardando_correspondente", "em_envio", "enviada", "em_analise", "aguardando_documentos",
  "condicionada", "aprovada", "recusada", "erro_envio", "formularios", "engenharia_vistoria",
  "analise_juridica", "contrato", "registrado", "cancelada",
];

describe("colunas do kanban", () => {
  it("Contrato registrado vem logo depois de Contrato emitido", () => {
    const destinos = COLUNAS_KANBAN.map((c) => c.destino);
    expect(destinos.indexOf("registrado")).toBe(destinos.indexOf("contrato_emitido") + 1);
    expect(COLUNAS_KANBAN.find((c) => c.destino === "registrado")!.rotulo).toBe("Contrato registrado");
  });

  it("todo status da proposta cai em exatamente uma coluna (nenhum some do quadro)", () => {
    const todos = [
      "rascunho", "aguardando_envio", "enviada_banco", "em_analise_credito", "credito_aprovado",
      "credito_condicionado", "credito_recusado", "formularios", "aguardando_documentos",
      "checklist_documentacao", "cadastro_complementar", "dossie_completo", "envio_documentos_banco",
      "engenharia_vistoria", "vistoria_agendamento", "vistoria_concluida", "analise_juridica",
      "emissao_contrato", "contrato_emitido", "registrado", "erro_envio", "cancelada",
    ];
    for (const s of todos) {
      const n = COLUNAS_KANBAN.filter((c) => c.agrega.includes(s as never)).length;
      expect(n, s).toBe(1);
    }
    expect(colunaDoStatus("aguardando_envio")).toBe("rascunho");
    expect(colunaDoStatus("status_inventado")).toBeNull();
  });
});

describe("avaliarSoltura (arrastar com validação)", () => {
  it("mesma coluna não faz nada (inclusive status agregado)", () => {
    expect(avaliarSoltura("em_analise_credito", "enviada_banco", "Itaú")).toEqual({ tipo: "nada" });
  });

  it("etapa manual permitida move direto", () => {
    expect(avaliarSoltura("aguardando_documentos", "engenharia_vistoria", "Bradesco")).toEqual({
      tipo: "mover",
      destino: "engenharia_vistoria",
    });
    expect(avaliarSoltura("contrato_emitido", "registrado", "Itaú")).toEqual({
      tipo: "mover",
      destino: "registrado",
    });
  });

  it("pular etapa é recusado", () => {
    const r = avaliarSoltura("aguardando_documentos", "contrato_emitido", "Itaú");
    expect(r.tipo).toBe("recusada");
  });

  it("voltar etapa é recusado", () => {
    expect(avaliarSoltura("analise_juridica", "aguardando_documentos", "Itaú").tipo).toBe("recusada");
    expect(avaliarSoltura("registrado", "contrato_emitido", "Itaú").tipo).toBe("recusada");
  });

  it("formulários só no banco que tem a etapa", () => {
    expect(avaliarSoltura("credito_aprovado", "formularios", "Bradesco").tipo).toBe("recusada");
    expect(avaliarSoltura("credito_aprovado", "formularios", "Itaú").tipo).toBe("confirmar");
  });

  it("etapa que vem do banco pede confirmação", () => {
    const r = avaliarSoltura("enviada_banco", "credito_aprovado", "Santander");
    expect(r.tipo).toBe("confirmar");
  });

  it("cancelar pede motivo; proposta encerrada não cancela", () => {
    expect(avaliarSoltura("analise_juridica", "cancelada", "Itaú")).toEqual({ tipo: "cancelar" });
    expect(avaliarSoltura("registrado", "cancelada", "Itaú").tipo).toBe("recusada");
    expect(avaliarSoltura("credito_recusado", "cancelada", "Itaú").tipo).toBe("recusada");
  });

  it("status desconhecido é recusado", () => {
    expect(avaliarSoltura("hackeado", "registrado", null).tipo).toBe("recusada");
  });

  it("só arrasta quem tem para onde ir", () => {
    expect(podeArrastar("registrado")).toBe(false);
    expect(podeArrastar("cancelada")).toBe(false);
    expect(podeArrastar("contrato_emitido")).toBe(true);
  });

  it("ações rápidas oferecem só as próximas etapas manuais", () => {
    expect(proximasEtapasManuais("aguardando_documentos", "Itaú")).toEqual(["engenharia_vistoria"]);
    expect(proximasEtapasManuais("credito_aprovado", "Bradesco")).toEqual([
      "aguardando_documentos",
      "engenharia_vistoria",
    ]);
    expect(proximasEtapasManuais("rascunho", "Itaú")).toEqual([]);
  });
});

describe("dias parado e SLA configurável", () => {
  const agora = new Date("2026-10-26T12:00:00Z");
  const prazos = montarPrazos([
    { correspondente_id: null, etapa: "aguardando_documentos", dias_alerta: 5, dias_critico: 10 },
    { correspondente_id: "c1", etapa: "aguardando_documentos", dias_alerta: 2, dias_critico: 4 },
    { correspondente_id: null, etapa: "analise_juridica", dias_alerta: 7, dias_critico: 15 },
    // tortas: ignoradas
    { correspondente_id: "c1", etapa: "analise_juridica", dias_alerta: 9, dias_critico: 3 },
    { correspondente_id: null, etapa: "inventada", dias_alerta: 1, dias_critico: 2 },
    { correspondente_id: null, etapa: "em_analise_credito", dias_alerta: 1, dias_critico: 2 },
  ]);

  it("ajuste do correspondente vence o padrão; linha torta não entra", () => {
    expect(prazos.aguardando_documentos).toEqual({ dias_alerta: 2, dias_critico: 4 });
    expect(prazos.analise_juridica).toEqual({ dias_alerta: 7, dias_critico: 15 });
    expect(Object.keys(prazos).sort()).toEqual(["aguardando_documentos", "analise_juridica"]);
  });

  it("conta dias inteiros e não fica negativo", () => {
    expect(diasParado("2026-10-23T11:00:00Z", agora)).toBe(3);
    expect(diasParado("2026-10-30T11:00:00Z", agora)).toBe(0);
    expect(diasParado("2026-10-23 11:00:00+00", agora)).toBe(3);
    expect(diasParado(null, agora)).toBeNull();
    expect(diasParado("lixo", agora)).toBeNull();
  });

  it("nível pelo limite da coluna do status (status agregado usa a coluna)", () => {
    expect(nivelSla("aguardando_documentos", 1, prazos)).toBe("ok");
    expect(nivelSla("checklist_documentacao", 2, prazos)).toBe("alerta");
    expect(nivelSla("aguardando_documentos", 4, prazos)).toBe("critico");
    expect(nivelSla("registrado", 400, prazos)).toBe("sem");
    expect(nivelSla("engenharia_vistoria", 50, prazos)).toBe("sem"); // sem limite configurado
  });
});

describe("propostas dos assinantes", () => {
  it("toda situação do assinante tem coluna", () => {
    for (const s of SITUACOES_ASSINANTE) {
      expect(colunaDoStatusAssinante(s), s).not.toBeNull();
    }
    expect(colunaDoStatusAssinante("registrado")).toBe("registrado");
    expect(colunaDoStatusAssinante("contrato")).toBe("contrato_emitido");
    expect(colunaDoStatusAssinante("x")).toBeNull();
  });
});

describe("resumoColuna", () => {
  it("soma valores e ignora o que não é número", () => {
    expect(
      resumoColuna([
        { valor_financiamento: 100000 },
        { valor_financiamento: "250000.50" },
        { valor_financiamento: null },
        { valor_financiamento: "abc" },
      ]),
    ).toEqual({ quantidade: 4, soma: 350000.5 });
  });
});

import { describe, it, expect } from "vitest";
import {
  chaveDoBanco,
  fonteDoAndamento,
  nomeEtapaFormularios,
  temEtapaFormularios,
} from "./etapas-banco";
import { statusDaEtapa } from "@/lib/propostas/etapa-banco";
import { etapasDoBanco, indiceEtapa } from "@/components/propostas/pipeline-map";
import { statusProposta } from "@/components/propostas/status";
import {
  ORDEM_STATUS,
  transicaoPermitida,
  transicaoPermitidaNoBanco,
  transicoesDoBanco,
} from "@/lib/propostas/state-machine";

describe("Banco da proposta", () => {
  it("reconhece o banco pelo nome, com ou sem acento", () => {
    expect(chaveDoBanco("Itaú")).toBe("itau");
    expect(chaveDoBanco("BANCO ITAU S.A.")).toBe("itau");
    expect(chaveDoBanco("Santander")).toBe("santander");
    expect(chaveDoBanco("Bradesco")).toBe("bradesco");
    expect(chaveDoBanco("Caixa")).toBeNull();
    expect(chaveDoBanco(null)).toBeNull();
  });

  it("fonte do andamento: Bradesco pela HomeFin, Itaú e Santander pelo portal", () => {
    expect(fonteDoAndamento("Bradesco")).toBe("homefin");
    expect(fonteDoAndamento("Itaú")).toBe("portal_banco");
    expect(fonteDoAndamento("Santander")).toBe("portal_banco");
  });
});

describe("Etapa de formulários: o nome de cada portal", () => {
  it("Itaú e Santander têm a etapa; Bradesco não", () => {
    expect(temEtapaFormularios("Itaú")).toBe(true);
    expect(temEtapaFormularios("Santander")).toBe(true);
    expect(temEtapaFormularios("Bradesco")).toBe(false);
    expect(nomeEtapaFormularios("Itaú")).toBe("Formulários Digitais");
    expect(nomeEtapaFormularios("Santander")).toBe("Cadastro das Informações");
  });

  it("os nomes dos portais viram o status formularios", () => {
    expect(statusDaEtapa("Formulários Digitais")).toBe("formularios");
    expect(statusDaEtapa("Cadastro das Informações")).toBe("formularios");
    // Os vizinhos continuam onde estavam.
    expect(statusDaEtapa("Envio de Documentos - Mesa de entrada")).toBe("aguardando_documentos");
    expect(statusDaEtapa("Análise de Documentos e Avaliação do Imóvel")).toBe(
      "engenharia_vistoria",
    );
  });

  it("fica entre o crédito e os documentos, e o fluxo passa por ela", () => {
    const i = (s: (typeof ORDEM_STATUS)[number]) => ORDEM_STATUS.indexOf(s);
    expect(i("formularios")).toBeGreaterThan(i("credito_condicionado"));
    expect(i("formularios")).toBeLessThan(i("aguardando_documentos"));
    expect(transicaoPermitida("credito_aprovado", "formularios")).toBe(true);
    expect(transicaoPermitida("credito_condicionado", "formularios")).toBe(true);
    expect(transicaoPermitida("formularios", "aguardando_documentos")).toBe(true);
  });

  it("Bradesco não oferece nem aceita mover para formulários", () => {
    expect(transicoesDoBanco("credito_aprovado", "Bradesco")).not.toContain("formularios");
    expect(transicoesDoBanco("credito_aprovado", "Itaú")).toContain("formularios");
    expect(transicaoPermitidaNoBanco("credito_aprovado", "formularios", "Bradesco")).toBe(false);
    expect(transicaoPermitidaNoBanco("credito_aprovado", "formularios", "Santander")).toBe(true);
    // As demais transições do Bradesco seguem iguais.
    expect(transicaoPermitidaNoBanco("credito_aprovado", "aguardando_documentos", "Bradesco")).toBe(
      true,
    );
  });

  it("o rótulo do status sai com o nome do portal quando o banco é conhecido", () => {
    expect(statusProposta("formularios", "Itaú").label).toBe("Formulários Digitais");
    expect(statusProposta("formularios", "Santander").label).toBe("Cadastro das Informações");
    expect(statusProposta("formularios").label).toBe("Formulários do banco");
    expect(statusProposta("aguardando_documentos", "Itaú").label).toBe("Coleta de documentos");
  });
});

describe("Régua da ficha por banco", () => {
  const nomes = (banco: string | null, status?: string) =>
    etapasDoBanco(banco, status).map((e) => e.label);

  it("Itaú: 8 etapas, com Formulários Digitais antes de Documentos", () => {
    expect(nomes("Itaú")).toEqual([
      "Simulação",
      "Crédito",
      "Formulários Digitais",
      "Documentos",
      "Engenharia",
      "Análise Jurídica",
      "Contrato Emitido",
      "Registro",
    ]);
    expect(etapasDoBanco("Itaú").map((e) => e.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("Santander: Cadastro das Informações no mesmo lugar", () => {
    expect(nomes("Santander")[2]).toBe("Cadastro das Informações");
  });

  it("Bradesco: as 7 etapas de sempre", () => {
    expect(nomes("Bradesco")).toEqual([
      "Simulação",
      "Crédito",
      "Documentos",
      "Engenharia",
      "Análise Jurídica",
      "Contrato Emitido",
      "Registro",
    ]);
  });

  it("a etapa atual cai no lugar certo em cada régua", () => {
    expect(indiceEtapa("formularios", "Itaú")).toBe(2);
    expect(indiceEtapa("aguardando_documentos", "Itaú")).toBe(3);
    expect(indiceEtapa("aguardando_documentos", "Bradesco")).toBe(2);
    // Banco desconhecido mas proposta já em formulários: a etapa aparece.
    expect(indiceEtapa("formularios", null)).toBe(2);
  });
});

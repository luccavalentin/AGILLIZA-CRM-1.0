import { describe, expect, it } from "vitest";
import { nomeDoTipoDocumento, sugerirTipoDocumento, termosDoTipoDocumento } from "./tipos-banco";

describe("tipos de documento", () => {
  it("chave interna do checklist vira nome legível", () => {
    expect(nomeDoTipoDocumento("c_cert_ec")).toBe("Certidão de estado civil");
    expect(nomeDoTipoDocumento("vendedor2_v_doc_id")).toBe("Documento de identidade (RG ou CNH)");
    expect(nomeDoTipoDocumento("custom_abc")).toBe("Documento adicional");
    expect(nomeDoTipoDocumento("Laudo de vistoria")).toBe("Laudo de vistoria");
  });

  it("termos acham a vaga da HomeFin pelo nome dela", () => {
    expect(termosDoTipoDocumento("c_cert_ec")).toContain("certidao de casamento");
    expect(termosDoTipoDocumento("i_iptu")).toContain("iptu");
    // Nome legível do catálogo (anexo feito por pasta) também funciona.
    expect(termosDoTipoDocumento("CND condominial")).toContain("condominial");
  });

  it("sugere o tipo pelo nome do arquivo, respeitando a categoria", () => {
    expect(sugerirTipoDocumento("Certidão de Casamento.pdf", "comprador")).toBe(
      "Certidão de estado civil",
    );
    expect(sugerirTipoDocumento("RG frente e verso.jpg", "conjuge")).toBe(
      "Documento de identidade do cônjuge (RG, CPF ou CNH)",
    );
    expect(sugerirTipoDocumento("iptu 2026.pdf", "imovel")).toBe(
      "Capa do IPTU ou Certidão de Valor Venal",
    );
    expect(sugerirTipoDocumento("scan001.pdf", "comprador")).toBe("");
  });

  it("reconhece os documentos pedidos pelas vagas do banco", () => {
    expect(termosDoTipoDocumento("c_dps")).toContain("declaracao pessoal de saude");
    expect(termosDoTipoDocumento("Proposta de Financiamento Imobiliário assinada")).toContain(
      "proposta de financiamento",
    );
    expect(sugerirTipoDocumento("DPS assinada.pdf", "comprador")).toBe(
      "Declaração Pessoal de Saúde (DPS)",
    );
    expect(sugerirTipoDocumento("proposta banco.pdf", "conjuge")).toBe(
      "Proposta de Financiamento Imobiliário assinada pelo cônjuge",
    );
    expect(sugerirTipoDocumento("cpf.jpg", "comprador")).toBe("CPF");
  });
});

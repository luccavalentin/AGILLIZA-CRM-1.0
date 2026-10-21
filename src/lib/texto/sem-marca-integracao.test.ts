import { describe, expect, it } from "vitest";
import { semMarcaIntegracao } from "./sem-marca-integracao";

describe("semMarcaIntegracao", () => {
  it("troca o nome mantendo a preposição", () => {
    expect(semMarcaIntegracao("Enviado à HomeFin, aguardando a análise.")).toBe(
      "Enviado à integração bancária, aguardando a análise.",
    );
    expect(semMarcaIntegracao("Aprovado na HomeFin.")).toBe("Aprovado na integração bancária.");
    expect(semMarcaIntegracao("Recusado na análise da HomeFin: ilegível")).toBe(
      "Recusado na análise da integração bancária: ilegível",
    );
    expect(semMarcaIntegracao("aprovados pela HomeFin")).toBe("aprovados pela integração bancária");
  });

  it("não diferencia maiúsculas e aceita 'Home Fin'", () => {
    expect(semMarcaIntegracao("arquivo excluído da HOMEFIN")).toBe(
      "arquivo excluído da integração bancária",
    );
    expect(semMarcaIntegracao("enviado à Home Fin")).toBe("enviado à integração bancária");
    expect(semMarcaIntegracao("na homefin")).toBe("na integração bancária");
  });

  it("começo de frase vira maiúscula", () => {
    expect(semMarcaIntegracao("A HomeFin recusou a atualização.")).toBe(
      "A integração bancária recusou a atualização.",
    );
    expect(semMarcaIntegracao("HomeFin · integração")).toBe("Integração bancária · integração");
    expect(semMarcaIntegracao("Erro. HomeFin fora do ar")).toBe(
      "Erro. Integração bancária fora do ar",
    );
  });

  it("masculino vira feminino", () => {
    expect(semMarcaIntegracao("retorno do HomeFin")).toBe("retorno da integração bancária");
    expect(semMarcaIntegracao("Ao HomeFin foi enviado")).toBe("À integração bancária foi enviado");
    expect(semMarcaIntegracao("gravado no Homefin")).toBe("gravado na integração bancária");
  });

  it("casos curtos e parênteses", () => {
    expect(semMarcaIntegracao("Cancelamento confirmado no banco parceiro (HomeFin).")).toBe(
      "Cancelamento confirmado no banco parceiro.",
    );
    expect(semMarcaIntegracao("Com ID HomeFin")).toBe("Com ID");
    expect(semMarcaIntegracao("Recebido HomeFin")).toBe("Recebido na integração");
    expect(semMarcaIntegracao("indisponível na API HomeFin")).toBe(
      "indisponível na integração bancária",
    );
    expect(semMarcaIntegracao("[HomeFin] Falha no envio")).toBe("Falha no envio");
  });

  it("não mexe no que não tem o nome", () => {
    expect(semMarcaIntegracao("Documentos: 2 no banco.")).toBe("Documentos: 2 no banco.");
    expect(semMarcaIntegracao("")).toBe("");
    expect(semMarcaIntegracao(null)).toBeNull();
    expect(semMarcaIntegracao(undefined)).toBeUndefined();
  });
});

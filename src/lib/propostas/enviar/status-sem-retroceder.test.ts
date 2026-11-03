import { describe, it, expect } from "vitest";
import { statusSemRetrocederCredito } from "./helpers-retorno.server";

describe("Sincronização não desfaz o que a proposta já andou", () => {
  it("coleta de documentos não volta para crédito aprovado (PRO-000311)", () => {
    expect(statusSemRetrocederCredito("credito_aprovado", "aguardando_documentos")).toBe(
      "aguardando_documentos",
    );
    expect(statusSemRetrocederCredito("credito_condicionado", "engenharia_vistoria")).toBe(
      "engenharia_vistoria",
    );
    expect(statusSemRetrocederCredito("credito_aprovado", "registrado")).toBe("registrado");
    // Formulários do banco (Itaú/Santander) também já passou do crédito.
    expect(statusSemRetrocederCredito("credito_condicionado", "formularios")).toBe("formularios");
  });

  it("desfechos do banco continuam valendo depois do crédito", () => {
    expect(statusSemRetrocederCredito("credito_recusado", "aguardando_documentos")).toBe(
      "credito_recusado",
    );
    expect(statusSemRetrocederCredito("erro_envio", "analise_juridica")).toBe("erro_envio");
  });

  it("antes do crédito, o recálculo segue como sempre", () => {
    expect(statusSemRetrocederCredito("credito_aprovado", "em_analise_credito")).toBe(
      "credito_aprovado",
    );
    expect(statusSemRetrocederCredito("credito_condicionado", "credito_aprovado")).toBe(
      "credito_condicionado",
    );
    expect(statusSemRetrocederCredito(null, "aguardando_documentos")).toBeNull();
  });

  it("não devolve ao envio a proposta que já andou (PRO-000554, 30/10)", () => {
    // A HomeFin passou a devolver `tipoSituacao: "L"`, fora do contrato dela.
    // Sem mapeamento, o derivado vira `enviada_banco` — silêncio, não notícia.
    expect(statusSemRetrocederCredito("enviada_banco", "aguardando_documentos")).toBe(
      "aguardando_documentos",
    );
    expect(statusSemRetrocederCredito("enviada_banco", "analise_juridica")).toBe(
      "analise_juridica",
    );
    expect(statusSemRetrocederCredito("enviada_banco", "contrato_emitido")).toBe(
      "contrato_emitido",
    );
  });

  it("antes do crédito, enviada_banco continua valendo", () => {
    expect(statusSemRetrocederCredito("enviada_banco", "em_analise_credito")).toBe("enviada_banco");
    expect(statusSemRetrocederCredito("enviada_banco", null)).toBe("enviada_banco");
  });
});

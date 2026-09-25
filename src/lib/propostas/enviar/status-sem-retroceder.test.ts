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
});

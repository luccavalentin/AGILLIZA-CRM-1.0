import { describe, expect, it } from "vitest";
import { mensagemBancoLegivel } from "./mensagem-banco";

describe("mensagemBancoLegivel", () => {
  it("troca o JSON de contexto do Santander por uma orientação curta", () => {
    const bruto = `{"error":{"error@context":{"_ns_name":"a6a2","id":470472933,"bankIntegration.auditContext":{"oportunidade":{"idOportunidade":31508,"cep":null}}}}}`;
    expect(mensagemBancoLegivel(bruto, "Santander")).toBe(
      "Santander recusou o envio sem informar o motivo. Tente enviar de novo em alguns minutos; se continuar, acione a HomeFin.",
    );
  });

  it("extrai a frase do stack do provedor", () => {
    const bruto = `{"error":{"httpCode":500,"stack":"AppError STD-001: Nao foi possivel recuperar os dados solicitados: Favor inserir uma data de emissão do documento válida.\\n   at Foo (x.js:1)"}}`;
    expect(mensagemBancoLegivel(bruto)).toBe(
      "Favor inserir uma data de emissão do documento válida.",
    );
  });

  it("usa a mensagem do banco quando existe", () => {
    const bruto = `{"codigo":"103","mensagem":"Já existe proposta em análise para o cpf informado."}`;
    expect(mensagemBancoLegivel(bruto)).toBe("Já existe proposta em análise para o cpf informado.");
  });

  it("o placeholder genérico do Itaú vira orientação", () => {
    expect(mensagemBancoLegivel("Erro desconhecido na integração Itaú", "Itaú")).toContain(
      "Itaú recusou o envio sem informar o motivo",
    );
  });

  it("frase comum passa, longa é encurtada", () => {
    expect(mensagemBancoLegivel("CEP não encontrado.")).toBe("CEP não encontrado.");
    expect(mensagemBancoLegivel("a".repeat(500)).length).toBe(280);
    expect(mensagemBancoLegivel(null)).toBe("");
  });
});

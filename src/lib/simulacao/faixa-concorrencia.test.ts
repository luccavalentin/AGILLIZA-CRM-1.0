import { describe, it, expect } from "vitest";

/**
 * Espelha a classificação de faixa usada em `chamarIntegracao`.
 *
 * A regra existe porque o `GET /oportunidade/{id}` da reconciliação era 95%
 * de todo o tráfego e lotava as 3 vagas da fila única, deixando os POSTs de
 * envio esperando atrás de consultas de acompanhamento. Consulta e escrita
 * passaram a ter orçamentos separados.
 */
function faixaDe(method: string, endpoint: string): "leitura" | "escrita" {
  const ehConsultaDeAcompanhamento = method === "GET" && /^\/oportunidade\/[^/]+$/.test(endpoint);
  return ehConsultaDeAcompanhamento ? "leitura" : "escrita";
}

describe("faixa de concorrência da integração", () => {
  it("o polling de acompanhamento vai para a faixa de leitura", () => {
    expect(faixaDe("GET", "/oportunidade/27361")).toBe("leitura");
    expect(faixaDe("GET", "/oportunidade/28112")).toBe("leitura");
  });

  it("os envios que fazem o trabalho ficam na faixa de escrita", () => {
    expect(faixaDe("POST", "/oportunidade")).toBe("escrita");
    expect(faixaDe("POST", "/oportunidade/27361/simulacao")).toBe("escrita");
    expect(faixaDe("POST", "/oportunidade/27361/simulacao/89125/integracao")).toBe("escrita");
    expect(faixaDe("POST", "/oportunidade/27361/incluir-proposta-integracao")).toBe("escrita");
    expect(faixaDe("PUT", "/oportunidade/27361/participante/18543")).toBe("escrita");
  });

  it("GET de sub-recurso não é polling de oportunidade", () => {
    // Só a consulta da oportunidade em si entra na faixa de leitura; o
    // checklist de documentos é parte de um fluxo de trabalho.
    expect(faixaDe("GET", "/oportunidade/27361/documentos")).toBe("escrita");
  });

  it("PUT na própria oportunidade não é leitura", () => {
    expect(faixaDe("PUT", "/oportunidade/27361")).toBe("escrita");
  });
});

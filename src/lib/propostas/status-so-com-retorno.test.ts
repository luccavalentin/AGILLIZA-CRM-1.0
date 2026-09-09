import { describe, expect, it } from "vitest";
import { statusInternoBanco } from "./enviar/helpers-retorno.server";

/**
 * O status da proposta só pode avançar quando o BANCO se pronuncia.
 *
 * O envio gravava "enviada"/"em análise" mesmo sem desfecho no retorno, e a
 * tela ia de "Enviado p/ aprovação de crédito" para "Erro no envio" e daí para
 * o desfecho real — três estados para o mesmo fato, induzindo a leitura errada
 * da operação.
 */
function decidirGravacao(tipoSituacao: string, codigo: string | null = null) {
  const mapa = statusInternoBanco(tipoSituacao, false, codigo);
  const SEM_DESFECHO = new Set(["erro", "aguardando", "nao_enviado"]);
  const semDesfecho = !mapa.banco || SEM_DESFECHO.has(mapa.banco);
  return {
    status_banco: semDesfecho ? "aguardando" : mapa.banco,
    situacao_banco: semDesfecho ? "nao_enviado" : "derivada",
  };
}

describe("status no envio só avança com retorno do banco", () => {
  it('"N" é análise de crédito: o banco se pronunciou', () => {
    expect(decidirGravacao("N").status_banco).toBe("em_analise");
  });

  it('"A" e "R" são desfechos e valem na hora', () => {
    expect(decidirGravacao("A").status_banco).toBe("aprovada");
    expect(decidirGravacao("R").status_banco).toBe("recusada");
  });

  it('"E" não vira "enviada": fica aguardando até o desfecho real', () => {
    const r = decidirGravacao("E");
    expect(r.status_banco).toBe("aguardando");
    expect(r.situacao_banco).toBe("nao_enviado");
  });

  it('"P" (erro ao enviar) também não vira "enviada"', () => {
    expect(decidirGravacao("P").status_banco).toBe("aguardando");
  });

  it("retorno vazio não move a proposta", () => {
    const r = decidirGravacao("");
    expect(r.status_banco).toBe("aguardando");
    expect(r.situacao_banco).toBe("nao_enviado");
  });
});

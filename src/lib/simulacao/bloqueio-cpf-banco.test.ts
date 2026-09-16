import { describe, expect, it } from "vitest";
import {
  contarFalhasIndependentes,
  cpfBloqueadoNoBanco,
  ENCERRADA_POR_CPF_BLOQUEADO,
  ENCERRADA_POR_SEM_DESPACHO,
  LIMITE_FALHAS_SEM_DESPACHO,
  mensagemCpfBloqueado,
} from "./bloqueio-cpf-banco";

describe("freio por CPF quando o banco não despacha", () => {
  it("só bloqueia a partir do limite de encerramentos anteriores", () => {
    expect(cpfBloqueadoNoBanco(0)).toBe(false);
    expect(cpfBloqueadoNoBanco(LIMITE_FALHAS_SEM_DESPACHO - 1)).toBe(false);
    expect(cpfBloqueadoNoBanco(LIMITE_FALHAS_SEM_DESPACHO)).toBe(true);
    expect(cpfBloqueadoNoBanco(10)).toBe(true);
  });

  it("a mensagem diz que reenviar não resolve e aponta o caminho", () => {
    const msg = mensagemCpfBloqueado("Santander", 3);
    expect(msg).toContain("Santander");
    expect(msg).toContain("3 simulações");
    expect(msg).toMatch(/oportunidades diferentes/);
    expect(msg).toMatch(/reenviar não resolve/i);
    expect(msg).toMatch(/outro banco/i);
  });
});

describe("contarFalhasIndependentes", () => {
  const semDespacho = { _encerrada_por: ENCERRADA_POR_SEM_DESPACHO };

  it("tentativas na mesma oportunidade são uma falha só (caso de 16/09)", () => {
    const presas = Array.from({ length: 21 }, (_, i) => ({
      id: `l${i}`,
      raw_response: semDespacho,
      homefin_id_oportunidade: "31141",
    }));
    expect(contarFalhasIndependentes(presas)).toBe(1);
    expect(cpfBloqueadoNoBanco(contarFalhasIndependentes(presas))).toBe(false);
  });

  it("oportunidades diferentes falhando seguem travando o CPF", () => {
    const linhas = [
      { id: "a", raw_response: semDespacho, homefin_id_oportunidade: "100" },
      { id: "b", raw_response: semDespacho, homefin_id_oportunidade: "101" },
    ];
    expect(cpfBloqueadoNoBanco(contarFalhasIndependentes(linhas))).toBe(true);
  });

  it("encerramento feito pelo próprio freio não conta como prova nova", () => {
    const linhas = [
      { id: "a", raw_response: semDespacho, homefin_id_oportunidade: "100" },
      {
        id: "b",
        raw_response: { _encerrada_por: ENCERRADA_POR_CPF_BLOQUEADO },
        homefin_id_oportunidade: "101",
      },
      {
        id: "c",
        raw_response: { _encerrada_por: ENCERRADA_POR_CPF_BLOQUEADO },
        homefin_id_oportunidade: "102",
      },
    ];
    expect(contarFalhasIndependentes(linhas)).toBe(1);
  });

  it("linha sem oportunidade conta sozinha e erros de outro tipo são ignorados", () => {
    const linhas = [
      { id: "a", raw_response: semDespacho, homefin_id_oportunidade: null },
      { id: "b", raw_response: semDespacho, homefin_id_oportunidade: null },
      { id: "c", raw_response: { _encerrada_por: "outro" }, homefin_id_oportunidade: "9" },
      { id: "d", raw_response: null, homefin_id_oportunidade: "9" },
    ];
    expect(contarFalhasIndependentes(linhas)).toBe(2);
  });
});

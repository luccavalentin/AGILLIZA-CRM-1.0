import { describe, expect, it } from "vitest";
import {
  cpfBloqueadoNoBanco,
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
    expect(msg).toMatch(/reenviar não resolve/i);
    expect(msg).toMatch(/outro banco/i);
  });
});

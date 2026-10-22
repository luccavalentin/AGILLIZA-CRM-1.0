import { describe, expect, it } from "vitest";
import {
  bancoDoRemetente,
  extrairCodigo,
  htmlParaTexto,
  palavraDeCodigo,
  trechoDoCorpo,
} from "./detectar";

describe("palavraDeCodigo", () => {
  it("reconhece código em qualquer variação e sem acento", () => {
    expect(palavraDeCodigo("Seu Código de acesso", "")).toBe("codigo");
    expect(palavraDeCodigo("Verificação", "")).toBe("verificacao");
    expect(palavraDeCodigo("", "Use o token abaixo")).toBe("token");
    expect(palavraDeCodigo("Login 2FA", "")).toBe("2fa");
  });
  it("ignora e-mail comum", () => {
    expect(palavraDeCodigo("Proposta aprovada", "Parabéns pela aprovação do crédito")).toBeNull();
  });
});

describe("extrairCodigo", () => {
  it("acha o código de 6 dígitos", () => {
    expect(extrairCodigo("Seu código", "Use o código 482917 para acessar o portal.")).toBe("482917");
  });
  it("junta código com espaço ou hífen", () => {
    expect(extrairCodigo("", "Código de verificação: 482 917")).toBe("482917");
    expect(extrairCodigo("", "Token: 4829-17")).toBe("482917");
  });
  it("não confunde ano, valor, data nem hora", () => {
    const corpo = "Em 22/10/2026 às 10:45, valor R$ 1500. Seu código é 7731 e vale até 2026.";
    expect(extrairCodigo("Acesso", corpo)).toBe("7731");
  });
  it("prefere o número perto da palavra código", () => {
    const corpo = "Pedido 55443322 recebido. O código de acesso é 908172.";
    expect(extrairCodigo("", corpo)).toBe("908172");
  });
  it("sem número devolve null", () => {
    expect(extrairCodigo("Código", "Clique no link para confirmar o acesso.")).toBeNull();
  });
});

describe("bancoDoRemetente", () => {
  it("pelo domínio, inclusive subdomínio", () => {
    expect(bancoDoRemetente("naoresponda@itau.com.br", null)).toBe("Itaú");
    expect(bancoDoRemetente("avisos@mail.bradesco.com.br", null)).toBe("Bradesco");
    expect(bancoDoRemetente("no-reply@inter.co", null)).toBe("Banco Inter");
  });
  it("pelo nome quando o domínio não é conhecido", () => {
    expect(bancoDoRemetente("x@envios.exemplo.com", "Santander Brasil")).toBe("Santander");
  });
  it("desconhecido devolve null", () => {
    expect(bancoDoRemetente("contato@exemplo.com", "Exemplo")).toBeNull();
  });
});

describe("htmlParaTexto e trechoDoCorpo", () => {
  it("tira marcação e estilos", () => {
    const html = "<style>p{color:red}</style><p>Seu <b>código</b>:&nbsp;123456</p>";
    expect(htmlParaTexto(html)).toBe("Seu código : 123456");
  });
  it("corta o trecho perto do código", () => {
    const corpo = `${"a ".repeat(200)}Seu código é 123456 para o Portal PJ. ${"b ".repeat(200)}`;
    const t = trechoDoCorpo(corpo, "123456", 60);
    expect(t).toContain("123456");
    expect(t.startsWith("…")).toBe(true);
  });
});

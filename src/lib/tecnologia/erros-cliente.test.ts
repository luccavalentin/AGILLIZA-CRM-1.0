import { describe, expect, it } from "vitest";
import {
  criarFreio,
  limparTexto,
  linhaDaPilha,
  perfilDaRota,
  resumirErro,
  resumirNavegador,
  rotaSemDado,
} from "./erros-cliente";

describe("limparTexto", () => {
  it("tira e-mail, CPF, telefone, id, query string, texto entre aspas e token", () => {
    const t = limparTexto(
      'Falha maria.silva@gmail.com CPF 123.456.789-09 (11) 98765-4321 id 0b5f2a8e-1c2d-4e3f-9a8b-7c6d5e4f3a2b "Maria Silva" /x?cpf=123&t=abc eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    );
    expect(t).not.toMatch(/@|maria|\d{4}|cpf=|eyJ/i);
    expect(t).toBe('Falha <email> CPF <n> <tel> id <id> "…" /x <x>');
  });

  it("mantém o que ajuda a diagnosticar", () => {
    expect(limparTexto("Cannot read properties of undefined (reading 'nome')")).toBe(
      "Cannot read properties of undefined (reading 'nome')",
    );
    expect(limparTexto("Request failed with status code 500")).toBe(
      "Request failed with status code 500",
    );
  });

  it("corta no tamanho e junta espaços e quebras", () => {
    expect(limparTexto("a\n\n  b\t c")).toBe("a b c");
    expect(limparTexto("x ".repeat(5000)).length).toBeLessThanOrEqual(300);
  });
});

describe("linhaDaPilha", () => {
  it("pega a primeira linha de onde quebrou, sem domínio nem query", () => {
    expect(
      linhaDaPilha(
        "TypeError: x\n    at salvar (https://app.agilliza.com.br/assets/app-1a2b.js?v=9:12:34)\n    at outro (x.js:1:1)",
      ),
    ).toBe("at salvar (/assets/app-1a2b.js:12:34)");
  });
  it("entende o formato do Safari/Firefox", () => {
    expect(linhaDaPilha("salvar@https://h.com/a.js:3:4\nb@x")).toBe("salvar@/a.js:3:4");
  });
  it("sem pilha, vazio", () => {
    expect(linhaDaPilha(undefined)).toBe("");
    expect(linhaDaPilha("só a mensagem")).toBe("");
  });
});

describe("rotaSemDado", () => {
  it("normaliza id, número e token, e descarta query", () => {
    expect(rotaSemDado("/crm/clientes_/0b5f2a8e-1c2d-4e3f-9a8b-7c6d5e4f3a2b?cpf=1")).toBe(
      "/crm/clientes_/:id",
    );
    expect(rotaSemDado("/operacional/propostas/123456")).toBe("/operacional/propostas/:n");
    expect(rotaSemDado("https://x.com/a/" + "b".repeat(30))).toBe("/a/:x");
    expect(rotaSemDado("")).toBe("/");
  });
});

describe("resumirNavegador", () => {
  it("só família e versão principal", () => {
    expect(
      resumirNavegador(
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36",
      ),
    ).toEqual({ navegador: "Chrome 129", sistemaOp: "Android" });
    expect(
      resumirNavegador(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ navegador: "Safari 17", sistemaOp: "iOS" });
    expect(resumirNavegador("Mozilla/5.0 (Windows NT 10.0) Edg/130.0").navegador).toBe("Edge 130");
  });
});

describe("perfilDaRota", () => {
  it("pela área do sistema", () => {
    expect(perfilDaRota("/cliente/visao-geral")).toBe("cliente");
    expect(perfilDaRota("/parceiro/propostas")).toBe("parceiro");
    expect(perfilDaRota("/auth")).toBe("anonimo");
    expect(perfilDaRota("/crm/clientes")).toBe("equipe");
  });
});

describe("resumirErro", () => {
  it("resume um Error", () => {
    const e = new TypeError("Falha com joao@x.com");
    const r = resumirErro(e, "/crm/clientes_/0b5f2a8e-1c2d-4e3f-9a8b-7c6d5e4f3a2b");
    expect(r?.mensagem).toBe("Falha com <email>");
    expect(r?.tipo).toBe("TypeError");
    expect(r?.rota).toBe("/crm/clientes_/:id");
  });
  it("ignora versão antiga, extensão e ruído", () => {
    expect(
      resumirErro(new Error("Failed to fetch dynamically imported module: x"), "/"),
    ).toBeNull();
    expect(
      resumirErro(new Error("ResizeObserver loop completed with undelivered notifications."), "/"),
    ).toBeNull();
    expect(resumirErro("Script error.", "/")).toBeNull();
    const ext = new Error("boom");
    ext.stack = "Error: boom\n    at x (chrome-extension://abc/c.js:1:1)";
    expect(resumirErro(ext, "/")).toBeNull();
    expect(resumirErro("   ", "/")).toBeNull();
  });
  it("aceita rejeição com texto ou objeto qualquer", () => {
    expect(resumirErro("falhou 12345678", "/")?.mensagem).toBe("falhou <n>");
    expect(resumirErro({ message: "objeto" }, "/")?.mensagem).toBe("objeto");
  });
});

describe("criarFreio", () => {
  it("deduplica o mesmo erro por 5 minutos", () => {
    const f = criarFreio();
    expect(f("a", 0)).toBe(true);
    expect(f("a", 60_000)).toBe(false);
    expect(f("a", 5 * 60_000 + 1)).toBe(true);
  });
  it("amostra depois dos primeiros envios e respeita o teto por hora", () => {
    let sorteio = 0.9;
    const f = criarFreio({
      semAmostraAte: 2,
      amostra: 0.25,
      tetoPorHora: 4,
      sortear: () => sorteio,
    });
    expect(f("a", 0)).toBe(true);
    expect(f("b", 1)).toBe(true);
    expect(f("c", 2)).toBe(false); // fora da amostra
    sorteio = 0.1;
    expect(f("d", 3)).toBe(true);
    expect(f("e", 4)).toBe(true);
    expect(f("f", 5)).toBe(false); // teto de 4 por hora
    expect(f("g", 3_600_010)).toBe(true); // nova hora
  });
});

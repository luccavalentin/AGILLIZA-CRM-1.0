import { describe, expect, it } from "vitest";
import {
  avaliarCaptura,
  destacarCodigo,
  ipInterno,
  trocaExigeSenha,
  type RegraFiltro,
} from "./filtros";
import { caixaSchema } from "./codigos.functions";

const email = (p: Partial<Parameters<typeof avaliarCaptura>[0]> = {}) => ({
  assunto: "Seu código de acesso",
  corpo: "Use 482917 para entrar.",
  remetenteEmail: "nao-responda@itau.com.br",
  remetenteNome: "Itaú",
  ...p,
});

describe("avaliarCaptura — filtro de palavras por caixa", () => {
  it("sem regras, captura e-mail de código pelas palavras padrão", () => {
    const r = avaliarCaptura(email(), [], true);
    expect(r.capturar).toBe(true);
    expect(r.ehCodigo).toBe(true);
    expect(r.motivo).toMatch(/palavra de código/);
  });

  it("sem regras e com as palavras padrão desligadas, não captura nada", () => {
    expect(avaliarCaptura(email(), [], false).capturar).toBe(false);
  });

  it("e-mail comum (sem palavra de código) não entra sem regra", () => {
    const r = avaliarCaptura(email({ assunto: "Boleto de outubro", corpo: "Segue o boleto 12345678." }), [], true);
    expect(r.capturar).toBe(false);
  });

  it("'contém' captura mesmo sem palavra de código, ignorando acento e caixa", () => {
    const regras: RegraFiltro[] = [{ operador: "contem", campo: "assunto", termo: "BOLETO" }];
    const r = avaliarCaptura(email({ assunto: "Bolêto de outubro", corpo: "nada" }), regras, true);
    expect(r.capturar).toBe(true);
    expect(r.ehCodigo).toBe(false);
    expect(r.motivo).toBe('assunto contém "BOLETO"');
  });

  it("'contém' no campo errado não casa (assunto x corpo)", () => {
    const regras: RegraFiltro[] = [{ operador: "contem", campo: "corpo", termo: "boleto" }];
    expect(avaliarCaptura(email({ assunto: "boleto", corpo: "x" }), regras, false).capturar).toBe(false);
  });

  it("'não contém' barra mesmo o e-mail de código (exclusão vence)", () => {
    const regras: RegraFiltro[] = [
      { operador: "contem", campo: "qualquer", termo: "código" },
      { operador: "nao_contem", campo: "remetente", termo: "itau.com.br" },
    ];
    const r = avaliarCaptura(email(), regras, true);
    expect(r.capturar).toBe(false);
    expect(r.motivo).toMatch(/^ignorado: remetente não contém/);
  });

  it("remetente casa pelo nome ou pelo endereço", () => {
    const regras: RegraFiltro[] = [{ operador: "contem", campo: "remetente", termo: "Caixa Econômica" }];
    const r = avaliarCaptura(
      email({ assunto: "Aviso", corpo: "x", remetenteNome: "CAIXA ECONOMICA FEDERAL", remetenteEmail: "a@caixa.gov.br" }),
      regras,
      false,
    );
    expect(r.capturar).toBe(true);
  });

  it("regra desativada não vale e termo curto demais é ignorado", () => {
    const regras: RegraFiltro[] = [
      { operador: "nao_contem", campo: "qualquer", termo: "itaú", ativo: false },
      { operador: "nao_contem", campo: "qualquer", termo: " a " },
    ];
    expect(avaliarCaptura(email(), regras, true).capturar).toBe(true);
  });

  it("termo com espaços extras e quebras de linha no texto ainda casa", () => {
    const regras: RegraFiltro[] = [{ operador: "contem", campo: "corpo", termo: "  segunda   via " }];
    const r = avaliarCaptura(email({ assunto: "x", corpo: "Sua segunda\n\nvia chegou" }), regras, false);
    expect(r.capturar).toBe(true);
  });
});

describe("destacarCodigo", () => {
  it("marca o código no trecho, inclusive escrito com espaço ou hífen", () => {
    expect(destacarCodigo("Use 482 917 agora", "482917")).toEqual([
      { texto: "Use ", codigo: false },
      { texto: "482 917", codigo: true },
      { texto: " agora", codigo: false },
    ]);
    expect(destacarCodigo("código: 482-917.", "482917").filter((p) => p.codigo)).toEqual([
      { texto: "482-917", codigo: true },
    ]);
  });

  it("não marca número maior que contém o código", () => {
    expect(destacarCodigo("conta 14829170", "482917").some((p) => p.codigo)).toBe(false);
  });

  it("sem código (ou código curto) devolve o texto inteiro sem marca", () => {
    expect(destacarCodigo("texto", null)).toEqual([{ texto: "texto", codigo: false }]);
    expect(destacarCodigo("abc 12 def", "12")).toEqual([{ texto: "abc 12 def", codigo: false }]);
    expect(destacarCodigo("", "123456")).toEqual([]);
  });

  it("código com caractere de expressão regular não quebra (só dígitos contam)", () => {
    expect(() => destacarCodigo("x", "12.34(56")).not.toThrow();
  });
});

describe("ipInterno — senha nunca vai para rede interna", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.10", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "[::1]"])(
    "%s é interno",
    (ip) => expect(ipInterno(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "200.147.67.142", "172.32.0.1", "2804:14c::1"])("%s é público", (ip) =>
    expect(ipInterno(ip)).toBe(false),
  );
  it("formato desconhecido é tratado como interno", () => expect(ipInterno("abc")).toBe(true));
});

describe("trocaExigeSenha", () => {
  const atual = { email: "a@x.com.br", usuario: null, imap_host: "imap.x.com.br", imap_port: 993, imap_ssl: true };
  it("mudar nome ou pasta não exige a senha", () => {
    expect(trocaExigeSenha(atual, { ...atual })).toBe(false);
  });
  it.each([
    ["servidor", { imap_host: "imap.atacante.com" }],
    ["porta", { imap_port: 143 }],
    ["e-mail", { email: "b@x.com.br" }],
    ["usuário", { usuario: "outro" }],
    ["SSL desligado", { imap_ssl: false }],
  ])("trocar %s exige a senha de novo", (_r, mudanca) => {
    expect(trocaExigeSenha(atual, { ...atual, ...mudanca })).toBe(true);
  });
  it("ligar o SSL não exige a senha", () => {
    expect(trocaExigeSenha({ ...atual, imap_ssl: false }, { ...atual, imap_ssl: true })).toBe(false);
  });
});

describe("caixaSchema — entrada torta", () => {
  const base = {
    email: "Equipe@Agilliza.com.br",
    imap_host: "IMAP.uhserver.com",
    imap_port: 993,
    pasta: "INBOX",
    ativo: true,
  };
  it("normaliza e-mail e servidor e aceita o mínimo", () => {
    const r = caixaSchema.parse(base);
    expect(r.email).toBe("equipe@agilliza.com.br");
    expect(r.imap_host).toBe("imap.uhserver.com");
    expect(r.imap_ssl).toBe(true);
    expect(r.filtros).toEqual([]);
  });
  it.each([
    ["servidor IP", { imap_host: "127.0.0.1" }],
    ["servidor sem domínio", { imap_host: "localhost" }],
    ["porta 0", { imap_port: 0 }],
    ["pasta vazia", { pasta: "  " }],
    ["pasta com aspas", { pasta: 'INBOX" x' }],
    ["e-mail inválido", { email: "sem-arroba" }],
  ])("recusa %s", (_r, mudanca) => {
    expect(() => caixaSchema.parse({ ...base, ...mudanca })).toThrow();
  });
  it("recusa mais de 50 regras e termo de 1 letra", () => {
    const regra = { operador: "contem", campo: "assunto", termo: "ab" };
    expect(() => caixaSchema.parse({ ...base, filtros: Array(51).fill(regra) })).toThrow();
    expect(() => caixaSchema.parse({ ...base, filtros: [{ ...regra, termo: "a" }] })).toThrow();
    expect(() => caixaSchema.parse({ ...base, filtros: [{ ...regra, operador: "igual" }] })).toThrow();
  });
});

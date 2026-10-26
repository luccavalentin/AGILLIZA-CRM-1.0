import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  documentoValido,
  estadoDoAcesso,
  formatarCelular,
  normalizarCreci,
} from "./vinculados-regras";
import { ESQUEMA_CONVERTER, ESQUEMA_DESVINCULAR, ESQUEMA_NOVO_VINCULADO } from "./vinculados.functions";

const NOVO = {
  tipo: "corretor" as const,
  nome: "Vera Vinculada",
  documento: "935.411.347-80",
  creci: "f 12345",
  creciUf: "sp",
  email: "Vera@Exemplo.com",
  celular: "(11) 97777-0000",
  carteira: null,
  motivo: "Corretora da base",
};

describe("vinculados: documento, CRECI e celular", () => {
  it("aceita CPF, CNPJ e CNPJ alfanumérico válidos", () => {
    expect(documentoValido("935.411.347-80")).toBe(true);
    expect(documentoValido("45.723.174/0001-10")).toBe(true);
    expect(documentoValido("12.ABC.345/01DE-35")).toBe(true);
  });

  it("recusa dígito errado, repetidos e tamanho torto", () => {
    expect(documentoValido("935.411.347-81")).toBe(false);
    expect(documentoValido("111.111.111-11")).toBe(false);
    expect(documentoValido("45.723.174/0001-11")).toBe(false);
    expect(documentoValido("1234")).toBe(false);
    expect(documentoValido("")).toBe(false);
    expect(documentoValido(null)).toBe(false);
  });

  it("CRECI em maiúsculas e celular formatado", () => {
    expect(normalizarCreci(" f 12345 ")).toBe("F12345");
    expect(formatarCelular("11977770000")).toBe("(11) 97777-0000");
    expect(formatarCelular("1133334444")).toBe("(11) 3333-4444");
  });

  it("o selo do acesso diz onde a pessoa está", () => {
    expect(estadoDoAcesso({ status: "ativo", acesso_criado: true, convite_valido: false })).toBe("ativo");
    expect(estadoDoAcesso({ status: "ativo", acesso_criado: false, convite_valido: true })).toBe("convite_enviado");
    expect(estadoDoAcesso({ status: "ativo", acesso_criado: false, convite_valido: false })).toBe("convite_vencido");
    expect(estadoDoAcesso({ status: "suspenso", acesso_criado: true, convite_valido: false })).toBe("suspenso");
    expect(estadoDoAcesso({ status: "cancelado", acesso_criado: true, convite_valido: false })).toBe("encerrado");
  });
});

describe("vinculados: o que o servidor aceita", () => {
  it("cadastro completo passa, com e-mail em minúsculas", () => {
    const r = ESQUEMA_NOVO_VINCULADO.parse(NOVO);
    expect(r.email).toBe("vera@exemplo.com");
    expect(r.creciUf).toBe("SP");
  });

  it("corretor sem CRECI, CRECI sem UF, CPF inválido e celular sem DDD são recusados", () => {
    expect(ESQUEMA_NOVO_VINCULADO.safeParse({ ...NOVO, creci: "" }).success).toBe(false);
    expect(ESQUEMA_NOVO_VINCULADO.safeParse({ ...NOVO, creciUf: "" }).success).toBe(false);
    expect(ESQUEMA_NOVO_VINCULADO.safeParse({ ...NOVO, documento: "123.456.789-00" }).success).toBe(false);
    expect(ESQUEMA_NOVO_VINCULADO.safeParse({ ...NOVO, celular: "97777-0000" }).success).toBe(false);
    expect(ESQUEMA_NOVO_VINCULADO.safeParse({ ...NOVO, motivo: "oi" }).success).toBe(false);
  });

  it("parceiro não precisa de CRECI; imobiliária não é vinculada", () => {
    expect(ESQUEMA_NOVO_VINCULADO.safeParse({ ...NOVO, tipo: "parceiro", creci: "", creciUf: "" }).success).toBe(true);
    expect(ESQUEMA_NOVO_VINCULADO.safeParse({ ...NOVO, tipo: "imobiliaria" }).success).toBe(false);
  });

  it("desvincular para assinante exige plano; encerrar não", () => {
    const id = "01a17664-3d56-7a66-b833-6026450272d2";
    expect(ESQUEMA_DESVINCULAR.safeParse({ id, destino: "assinante", motivo: "virou assinante" }).success).toBe(false);
    expect(
      ESQUEMA_DESVINCULAR.safeParse({ id, destino: "assinante", planoId: id, diasTeste: 400, motivo: "virou assinante" })
        .success,
    ).toBe(false);
    expect(ESQUEMA_DESVINCULAR.safeParse({ id, destino: "encerrar", motivo: "parceria encerrada" }).success).toBe(true);
  });

  it("conversão do parceiro: documento e celular opcionais, mas válidos quando vêm", () => {
    const authUid = "a8a8a8a8-0000-4000-8000-000000000001";
    expect(ESQUEMA_CONVERTER.safeParse({ authUid, tipo: "corretor", motivo: "migração do portal" }).success).toBe(true);
    expect(
      ESQUEMA_CONVERTER.safeParse({ authUid, tipo: "corretor", documento: "123", motivo: "migração do portal" }).success,
    ).toBe(false);
  });
});

describe("vinculados: toda server function tem a guarda certa", () => {
  const fonte = readFileSync(join(__dirname, "vinculados.functions.ts"), "utf8");
  const blocos = [...fonte.matchAll(/export const (\w+) = createServerFn\(\{ method: "(GET|POST)" \}\)([\s\S]*?)\.handler/g)];

  it("encontra as funções", () => {
    expect(blocos.length).toBeGreaterThanOrEqual(9);
  });

  it("todas pedem saas.licencas; toda escrita pede edit", () => {
    for (const [, nome, metodo, cab] of blocos) {
      expect(cab, nome).toContain('exigirPermissao(["saas.licencas"');
      if (metodo === "POST") expect(cab, nome).toContain('"edit"');
    }
  });

  it("a conversão lê nome e e-mail no banco, não da tela", () => {
    const conv = blocos.find((b) => b[1] === "converterParceiroEmVinculado")!;
    expect(conv[3]).not.toMatch(/nome:|email:/);
  });
});

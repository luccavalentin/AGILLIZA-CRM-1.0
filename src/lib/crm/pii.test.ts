import { describe, expect, it } from "vitest";
import { CAMPOS_PII_CLIENTE, CAMPOS_PII_VENDEDOR, mascararCamposPii, temPiiCliente } from "./pii";
import { rotuloStatusLeitura } from "./scan-ia-tipos";

describe("mascararCamposPii", () => {
  it("mascara CPF, RG e documentos do cônjuge e preserva o resto", () => {
    const cli = mascararCamposPii(
      {
        nome: "Maria",
        mae: "Ana",
        documento: "12345678909",
        numero_documento: "12345678909",
        conjuge_cpf: "98765432100",
        conjuge_numero_documento: null,
      },
      CAMPOS_PII_CLIENTE,
    );
    expect(cli.documento).toBe("***.***.789-**");
    expect(cli.numero_documento).toBe("***.***.789-**");
    expect(cli.conjuge_cpf).toBe("***.***.321-**");
    expect(cli.conjuge_numero_documento).toBeNull();
    expect(cli.nome).toBe("Maria");
    expect(cli.mae).toBe("Ana");
  });

  it("mascara CNPJ do vendedor", () => {
    const v = mascararCamposPii({ documento: "11222333000181" }, CAMPOS_PII_VENDEDOR);
    expect(v.documento).toBe("**.***.***/0001-**");
  });
});

describe("temPiiCliente", () => {
  const fake = (papel: boolean, pii: boolean) => ({
    rpc: async (fn: string) => ({ data: fn === "has_any_role" ? papel : pii }),
  });

  it("admin/correspondente vê sem consultar a matriz", async () => {
    expect(await temPiiCliente(fake(true, false), "u")).toBe(true);
  });

  it("demais dependem de pii:view", async () => {
    expect(await temPiiCliente(fake(false, true), "u")).toBe(true);
    expect(await temPiiCliente(fake(false, false), "u")).toBe(false);
  });
});

describe("rotuloStatusLeitura", () => {
  it("acentua os status gravados sem acento", () => {
    expect(rotuloStatusLeitura("concluida")).toBe("Concluída");
    expect(rotuloStatusLeitura("aplicada")).toBe("Aplicada");
    expect(rotuloStatusLeitura(null)).toBe("—");
  });
});

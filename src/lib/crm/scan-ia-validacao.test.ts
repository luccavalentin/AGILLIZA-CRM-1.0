import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  confiancaAjustada,
  cpfValido,
  dataReal,
  normalizarOrgaoEmissor,
  normalizarUf,
  validarCampo,
} from "./scan-ia-validacao";
import { consolidarCampos, montarPatchCliente, type CampoDeDocumento } from "./scan-ia-consolidar";

const HOJE = new Date("2026-10-26T12:00:00Z");

describe("Scan IA — regras determinísticas", () => {
  it("CPF e CNPJ pelo dígito verificador", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-80")).toBe(false);
    expect(validarCampo("cpf_cnpj", "529.982.247-25")).toEqual({ valido: true, motivo: null, normalizado: "52998224725" });
    expect(validarCampo("cpf_conjuge", "123.456.789-00").valido).toBe(false);
    expect(validarCampo("cpf_cnpj", "12345").motivo).toMatch(/11 ou 14/);
  });

  it("datas: calendário real, nascimento plausível, expedição não futura", () => {
    expect(dataReal("31/02/2000")).toBeNull();
    expect(dataReal("29/02/2024")).toBe("2024-02-29");
    expect(validarCampo("data_nascimento", "12/03/1985", HOJE).normalizado).toBe("1985-03-12");
    expect(validarCampo("data_nascimento", "12/03/2030", HOJE).motivo).toMatch(/futuro/);
    expect(validarCampo("data_nascimento", "12/03/1890", HOJE).motivo).toMatch(/110/);
    expect(validarCampo("data_expedicao", "01/01/2027", HOJE).motivo).toMatch(/futuro/);
    expect(validarCampo("data_expedicao", "ontem", HOJE).valido).toBe(false);
  });

  it("UF e órgão emissor", () => {
    expect(normalizarUf("sp")).toBe("SP");
    expect(normalizarUf("São Paulo")).toBe("SP");
    expect(normalizarUf("XX")).toBeNull();
    expect(normalizarOrgaoEmissor("SSP/SP")).toBe("SSP/SP");
    expect(normalizarOrgaoEmissor("ssp-sp")).toBe("SSP/SP");
    expect(normalizarOrgaoEmissor("SSPSP")).toBe("SSP/SP");
    expect(normalizarOrgaoEmissor("Secretaria de Segurança Pública")).toBe("SSP");
    expect(normalizarOrgaoEmissor("DETRAN RJ")).toBe("DETRAN/RJ");
    expect(normalizarOrgaoEmissor("SSP/ZZ")).toBeNull();
    expect(normalizarOrgaoEmissor("BANANA")).toBeNull();
    expect(validarCampo("uf_expedicao", "Minas Gerais").normalizado).toBe("MG");
  });

  it("CEP, e-mail, telefone, valores e nomes", () => {
    expect(validarCampo("endereco_cep", "01310-100").normalizado).toBe("01310100");
    expect(validarCampo("endereco_cep", "0131").valido).toBe(false);
    expect(validarCampo("email", "Fulano@Exemplo.com").normalizado).toBe("fulano@exemplo.com");
    expect(validarCampo("email", "fulano@").valido).toBe(false);
    expect(validarCampo("telefone", "+55 (11) 98888-7777").normalizado).toBe("11988887777");
    expect(validarCampo("renda_mensal", "R$ 12.345,67").normalizado).toBe("12345.67");
    expect(validarCampo("renda_mensal", "R$ 0,00").valido).toBe(false);
    expect(validarCampo("nome_completo", "Maria").valido).toBe(false);
    expect(validarCampo("nome_completo", "Maria 2 Silva").valido).toBe(false);
    expect(validarCampo("nome_completo", "Maria  da Silva").normalizado).toBe("Maria da Silva");
    expect(validarCampo("profissao", "Engenheira").valido).toBe(true);
  });

  it("valor reprovado nunca passa de 'revisar'", () => {
    expect(confiancaAjustada(0.99, { valido: false, motivo: "x", normalizado: null })).toBe(0.3);
    expect(confiancaAjustada(0.95, { valido: true, motivo: null, normalizado: null })).toBe(0.95);
    expect(confiancaAjustada(Number.NaN, { valido: true, motivo: null, normalizado: null })).toBe(0);
  });
});

describe("Scan IA — vários documentos num cadastro", () => {
  const campo = (p: Partial<CampoDeDocumento>): CampoDeDocumento => ({
    campo_id: crypto.randomUUID(),
    leitura_id: "l",
    tipo_documento: "rg",
    campo: "nome_completo",
    valor: "",
    confianca: 0.9,
    valido: true,
    motivo_validacao: null,
    ...p,
  });

  it("escolhe o válido, depois o documento mais indicado, depois a confiança; marca divergência", () => {
    const r = consolidarCampos([
      campo({ campo: "cpf_cnpj", valor: "529.982.247-24", valido: false, confianca: 0.99, tipo_documento: "cnh" }),
      campo({ campo: "cpf_cnpj", valor: "529.982.247-25", confianca: 0.7, tipo_documento: "rg" }),
      campo({ campo: "endereco_logradouro", valor: "Rua A, 10", tipo_documento: "comprovante_renda", confianca: 0.99 }),
      campo({ campo: "endereco_logradouro", valor: "Rua B, 20", tipo_documento: "comprovante_residencia", confianca: 0.8 }),
      campo({ campo: "nome_completo", valor: "MARIA DA SILVA", tipo_documento: "rg" }),
      campo({ campo: "nome_completo", valor: "Maria da Silva", tipo_documento: "comprovante_renda" }),
    ]);
    const por = Object.fromEntries(r.map((c) => [c.campo, c]));
    expect(por.cpf_cnpj!.escolhido.valor).toBe("529.982.247-25");
    expect(por.cpf_cnpj!.divergente).toBe(true);
    expect(por.endereco_logradouro!.escolhido.valor).toBe("Rua B, 20");
    expect(por.nome_completo!.divergente).toBe(false); // mesma coisa, só caixa diferente
  });

  it("montarPatchCliente: conflito só substitui com escolha, matrícula mesclada, sem destino descartado", () => {
    const cliente = { nome: "Maria da Silva", estado_civil: "solteiro", imovel_matricula: { cartorio_nome: "1º RI" } };
    const r = montarPatchCliente(
      [
        { campo: "nome_completo", valor: "Maria Souza", confianca: 0.9, aplicar: true },
        { campo: "estado_civil", valor: "Casada", confianca: 0.9, aplicar: true, escolha: "substituir" },
        { campo: "numero_matricula", valor: "12.345", confianca: 0.9, aplicar: true },
        { campo: "endereco_cep", valor: "01310-100", confianca: 0.9, aplicar: true },
        { campo: "data_casamento", valor: "01/01/2020", confianca: 0.9, aplicar: true },
        { campo: "profissao", valor: "Engenheira", confianca: 0.9, aplicar: false },
      ],
      cliente,
      null,
    );
    expect(r.patch).toEqual({
      estado_civil: "casado",
      imovel_matricula: { cartorio_nome: "1º RI", numero_matricula: "12.345" },
    });
    expect(r.enderecoPatch).toEqual({ cep: "01310100" });
    expect(r.descartados.map((d) => [d.campo, d.motivo])).toEqual([
      ["nome_completo", "conflito_mantido"],
      ["data_casamento", "Campo sem destino no cadastro."],
      ["profissao", "nao_marcado"],
    ]);
  });
});

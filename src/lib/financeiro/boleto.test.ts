import { describe, expect, it } from "vitest";
import {
  alertasDoRascunho,
  analisarBoleto,
  conferirBeneficiario,
  dadosDoTexto,
  encontrarCodigosNoTexto,
  formatarLinhaDigitavel,
  modulo10,
  modulo11Arrecadacao,
  modulo11Bancario,
  vencimentoDoFator,
} from "./boleto";

// Exemplo publicado pelo Banco do Brasil (campos 1–3 com DV módulo 10 conferidos à mão).
const LINHA_BB = "00190.50095 40144.816069 06809.350314 3 37370000000100";
const BARRAS_BB = "00193373700000001000500940144816060680935031";

/** Monta um código de barras bancário válido (DV geral calculado) — usado só nos testes. */
function barrasBancario(banco: string, fator: number, centavos: number, livre: string): string {
  const sem = banco + "9" + String(fator).padStart(4, "0") + String(centavos).padStart(10, "0") + livre;
  return sem.slice(0, 4) + modulo11Bancario(sem) + sem.slice(4);
}

/** Monta um código de arrecadação válido (identificador 8 = valor efetivo, módulo 11). */
function barrasArrecadacao(segmento: string, centavos: number, resto: string, id = "8"): string {
  const sem = "8" + segmento + id + String(centavos).padStart(11, "0") + resto;
  const mod = id === "6" || id === "7" ? modulo10 : modulo11Arrecadacao;
  return sem.slice(0, 3) + mod(sem) + sem.slice(3);
}

describe("módulos FEBRABAN", () => {
  it("módulo 10 dos campos da linha do exemplo do BB", () => {
    expect(modulo10("001905009")).toBe(5);
    expect(modulo10("4014481606")).toBe(9);
    expect(modulo10("0680935031")).toBe(4);
  });
  it("módulo 11 bancário nunca devolve 0", () => {
    for (let i = 0; i < 500; i++) {
      const n = String(Math.floor(Math.random() * 1e15)).padStart(43, "7");
      const dv = modulo11Bancario(n);
      expect(dv).toBeGreaterThanOrEqual(1);
      expect(dv).toBeLessThanOrEqual(9);
    }
  });
});

describe("boleto bancário", () => {
  it("linha digitável do exemplo do BB confere e vira o código de barras", () => {
    const a = analisarBoleto(LINHA_BB, new Date(2007, 11, 1));
    expect(a.erros).toEqual([]);
    expect(a.valido).toBe(true);
    expect(a.tipo).toBe("bancario");
    expect(a.codigoBarras).toBe(BARRAS_BB);
    expect(a.banco).toBe("001");
    expect(a.valor).toBe(1);
    expect(a.vencimento).toBe("2007-12-31");
  });

  it("código de barras vira a mesma linha digitável", () => {
    const a = analisarBoleto(BARRAS_BB, new Date(2007, 11, 1));
    expect(a.valido).toBe(true);
    expect(a.linhaDigitavel).toBe(LINHA_BB.replace(/\D/g, ""));
  });

  it("qualquer dígito trocado é detectado", () => {
    const d = LINHA_BB.replace(/\D/g, "");
    for (let i = 0; i < d.length; i++) {
      const trocado = d.slice(0, i) + ((Number(d[i]) + 1) % 10) + d.slice(i + 1);
      expect(analisarBoleto(trocado).valido, `posição ${i}`).toBe(false);
    }
  });

  it("fator do novo ciclo (a partir de 22/02/2025) e valor", () => {
    const codigo = barrasBancario("341", 1000 + 600, 123456, "1".repeat(25));
    const a = analisarBoleto(codigo, new Date(2026, 9, 26));
    expect(a.valido).toBe(true);
    expect(a.valor).toBe(1234.56);
    expect(a.vencimento).toBe("2026-10-15"); // 22/02/2025 + 600 dias
    // e a linha gerada a partir do código passa na própria validação
    expect(analisarBoleto(a.linhaDigitavel!, new Date(2026, 9, 26)).valido).toBe(true);
  });

  it("fator 0000 e valor zero viram avisos (rascunho pede para completar)", () => {
    const a = analisarBoleto(barrasBancario("237", 0, 0, "9".repeat(25)));
    expect(a.valido).toBe(true);
    expect(a.vencimento).toBeNull();
    expect(a.valor).toBeNull();
    expect(a.avisos.length).toBe(2);
  });

  it("quantidade errada de dígitos explica o que falta", () => {
    const a = analisarBoleto("123");
    expect(a.valido).toBe(false);
    expect(a.erros[0]).toMatch(/47/);
    expect(analisarBoleto("").erros[0]).toMatch(/Informe/);
  });

  it("formata a linha com a pontuação de sempre", () => {
    expect(formatarLinhaDigitavel(LINHA_BB.replace(/\D/g, ""))).toBe(LINHA_BB);
  });
});

describe("vencimento pelo fator", () => {
  it("ciclo antigo e novo, escolhendo o mais próximo da referência", () => {
    expect(vencimentoDoFator(1000, new Date(2000, 6, 3))).toBe("2000-07-03");
    expect(vencimentoDoFator(9999, new Date(2025, 1, 1))).toBe("2025-02-21");
    expect(vencimentoDoFator(1000, new Date(2025, 2, 1))).toBe("2025-02-22");
    expect(vencimentoDoFator(0)).toBeNull();
  });
});

describe("arrecadação", () => {
  it("código e linha de 48 com DV por bloco", () => {
    const codigo = barrasArrecadacao("3", 15790, "0001" + "2".repeat(25));
    const a = analisarBoleto(codigo);
    expect(a.valido).toBe(true);
    expect(a.tipo).toBe("arrecadacao");
    expect(a.valor).toBe(157.9);
    expect(a.vencimento).toBeNull();
    expect(a.linhaDigitavel).toHaveLength(48);
    const deNovo = analisarBoleto(a.linhaDigitavel!);
    expect(deNovo.valido).toBe(true);
    expect(deNovo.codigoBarras).toBe(codigo);
  });

  it("módulo 10 (identificador 6) e bloco adulterado", () => {
    const codigo = barrasArrecadacao("2", 9999, "0123" + "4".repeat(25), "6");
    const a = analisarBoleto(codigo);
    expect(a.valido).toBe(true);
    const linha = a.linhaDigitavel!;
    const trocada = linha.slice(0, 13) + ((Number(linha[13]) + 3) % 10) + linha.slice(14);
    const b = analisarBoleto(trocada);
    expect(b.valido).toBe(false);
    expect(b.erros.join(" ")).toMatch(/bloco 2/);
  });

  it("linha de 48 que não começa com 8 é recusada", () => {
    expect(analisarBoleto("1".repeat(48)).valido).toBe(false);
  });
});

describe("leitura do texto do PDF", () => {
  const texto = `
    BANCO DO BRASIL | 001-9 | ${LINHA_BB}
    Beneficiário: ACME SERVICOS LTDA CNPJ 12.345.678/0001-95 Agência 1234
    Vencimento: 31/12/2007   Valor do documento R$ 1,00
    Pagador: Correspondente Exemplo`;

  it("acha a linha digitável válida no meio do texto", () => {
    const achados = encontrarCodigosNoTexto(texto, new Date(2007, 11, 1));
    expect(achados).toHaveLength(1);
    expect(achados[0].codigoBarras).toBe(BARRAS_BB);
  });

  it("extrai beneficiário, documento, vencimento e valor escritos", () => {
    const d = dadosDoTexto(texto);
    expect(d.beneficiario).toBe("ACME SERVICOS LTDA");
    expect(d.documento).toBe("12345678000195");
    expect(d.vencimento).toBe("2007-12-31");
    expect(d.valor).toBe(1);
  });

  it("número qualquer (telefone, CEP) não vira boleto", () => {
    expect(encontrarCodigosNoTexto("Tel 11 99999-0000 CEP 01001-000 pedido 123456789012345678901234567890123456789012345")).toEqual([]);
  });
});

describe("conferências do rascunho", () => {
  it("beneficiário x fornecedor: documento manda, depois o nome", () => {
    expect(conferirBeneficiario({ documento: "12345678000195" }, { documento: "12.345.678/0001-95" })).toBe("confere");
    expect(conferirBeneficiario({ documento: "12345678000195" }, { documento: "99999999000199" })).toBe("diverge");
    expect(conferirBeneficiario({ beneficiario: "ACME Serviços Ltda" }, { nome: "Acme Servicos" })).toBe("confere");
    expect(conferirBeneficiario({ beneficiario: "Outra Empresa SA" }, { nome: "Acme" })).toBe("diverge");
    expect(conferirBeneficiario({}, null)).toBe("sem_dados");
  });

  it("vencido e divergência entre código e documento", () => {
    const a = analisarBoleto(LINHA_BB, new Date(2007, 11, 1));
    const r = alertasDoRascunho(a, { beneficiario: null, documento: null, vencimento: "2007-12-30", valor: 2 }, "2026-10-26");
    expect(r.vencido).toBe(true);
    expect(r.divergencias).toHaveLength(2);
  });
});

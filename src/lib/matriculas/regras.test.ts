import { describe, expect, it } from "vitest";
import {
  acoesDisponiveis,
  custoValido,
  erroDoArquivo,
  nomeDoSolicitante,
  nomeSeguro,
  resumir,
  rotuloOrigem,
  type LinhaMatricula,
} from "./regras";

const linha = (p: Partial<LinhaMatricula> = {}): LinhaMatricula => ({
  status: "pedida",
  solicitante: "Imobiliária Alfa — Ana",
  corretor: "Ana",
  solicitante_tipo: "assinante",
  solicitante_conta_nome: "Imobiliária Alfa",
  analista_id: null,
  valor: 0,
  reembolsado: false,
  ...p,
});

describe("quem pediu", () => {
  it("assinante aparece pela conta", () => {
    expect(nomeDoSolicitante(linha())).toBe("Imobiliária Alfa");
    expect(rotuloOrigem(linha())).toBe("Assinante: Imobiliária Alfa");
  });
  it("registro antigo: quem pediu estava em 'corretor'", () => {
    expect(nomeDoSolicitante(linha({ solicitante_tipo: "externo", solicitante: "Operador", corretor: "João" }))).toBe("João");
    expect(nomeDoSolicitante(linha({ solicitante_tipo: "externo", solicitante: "Maria", corretor: " " }))).toBe("Maria");
  });
  it("usuário do Agilliza aparece pelo nome", () => {
    expect(nomeDoSolicitante(linha({ solicitante_tipo: "usuario", solicitante: "Parceiro X", corretor: null }))).toBe("Parceiro X");
  });
});

describe("ações por situação", () => {
  it("sem permissão de editar, nenhuma ação", () => {
    expect(acoesDisponiveis(linha(), "eu", false)).toEqual([]);
  });
  it("pedido livre: assumir, aguardar recarga, concluir, cancelar", () => {
    expect(acoesDisponiveis(linha(), "eu", true)).toEqual(["assumir", "aguardar_recarga", "concluir", "cancelar"]);
  });
  it("pedido de outro analista: só cancelar", () => {
    expect(acoesDisponiveis(linha({ status: "em_andamento", analista_id: "outro" }), "eu", true)).toEqual(["cancelar"]);
  });
  it("meu pedido em andamento: não oferece assumir de novo", () => {
    expect(acoesDisponiveis(linha({ status: "em_andamento", analista_id: "eu" }), "eu", true)).toEqual([
      "aguardar_recarga",
      "concluir",
      "cancelar",
    ]);
  });
  it("concluída: marcar paga ou desfazer; cancelada: nada", () => {
    expect(acoesDisponiveis(linha({ status: "concluida", valor: 60 }), "eu", true)).toEqual(["marcar_paga"]);
    expect(acoesDisponiveis(linha({ status: "concluida", valor: 60, reembolsado: true }), "eu", true)).toEqual([
      "desfazer_pagamento",
    ]);
    expect(acoesDisponiveis(linha({ status: "cancelada" }), "eu", true)).toEqual([]);
  });
});

describe("resumo", () => {
  it("conta abertos e separa a receber do recebido (só concluídas)", () => {
    const r = resumir([
      linha(),
      linha({ status: "aguardando_recarga" }),
      linha({ status: "concluida", valor: 60.1 }),
      linha({ status: "concluida", valor: 0.2 }),
      linha({ status: "concluida", valor: 40, reembolsado: true }),
      linha({ status: "cancelada", valor: 99 }),
    ]);
    expect(r).toEqual({ abertos: 2, aguardandoRecarga: 1, aReceber: 60.3, recebido: 40 });
  });
});

describe("entrada torta", () => {
  it("arquivo: só PDF/imagem até 20 MB", () => {
    expect(erroDoArquivo({ type: "application/pdf", size: 1000, name: "m.pdf" })).toBeNull();
    expect(erroDoArquivo({ type: "image/png; charset=binary", size: 1000, name: "m.png" })).toBeNull();
    expect(erroDoArquivo({ type: "application/x-msdownload", size: 10, name: "m.exe" })).toMatch(/PDF/);
    expect(erroDoArquivo({ type: "text/html", size: 10, name: "m.pdf" })).toMatch(/PDF/);
    expect(erroDoArquivo({ type: "application/pdf", size: 0, name: "m.pdf" })).toMatch(/vazio/);
    expect(erroDoArquivo({ type: "application/pdf", size: 21 * 1024 * 1024, name: "m.pdf" })).toMatch(/20 MB/);
  });
  it("nome do arquivo não sobe de pasta nem leva acento", () => {
    expect(nomeSeguro("../../etc/passwd")).toBe("etc-passwd");
    expect(nomeSeguro("Matrícula nº 12.pdf")).toBe("Matricula-n-12.pdf");
    expect(nomeSeguro("////")).toBe("arquivo");
    expect(nomeSeguro("a".repeat(200) + ".pdf").length).toBeLessThanOrEqual(80);
  });
  it("custo: positivo, até R$ 100 mil, com vírgula", () => {
    expect(custoValido("62,90")).toBe(62.9);
    expect(custoValido("1.234,56")).toBe(1234.56);
    expect(custoValido("0")).toBeNull();
    expect(custoValido("-5")).toBeNull();
    expect(custoValido("abc")).toBeNull();
    expect(custoValido("100.000,01")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  bancoPermiteCarta,
  camposEmBrancoCarta,
  camposIniciaisCarta,
  camposParaPdf,
  mascaraData,
  NAO_SE_APLICA,
  parecerDaCarta,
  proponentesDaCarta,
} from "./dados";

describe("parecerDaCarta", () => {
  it("Bradesco nunca sai aprovado — só pré-aprovado", () => {
    expect(parecerDaCarta({ nome_banco: "Bradesco", status_banco: "aprovada" })?.curto).toBe(
      "PRÉ-APROVADO",
    );
    expect(
      parecerDaCarta({ nome_banco: "BRADESCO S.A.", status_banco: "condicionado" })?.curto,
    ).toBe("PRÉ-APROVADO");
    expect(parecerDaCarta({ nome_banco: "Bradesco", status_banco: "aprovada" })?.capa).not.toMatch(
      /(^|\s)APROVAD/,
    );
  });

  it("outros bancos seguem o status real", () => {
    expect(parecerDaCarta({ nome_banco: "Itaú", status_banco: "aprovada" })?.curto).toBe(
      "APROVADO",
    );
    expect(parecerDaCarta({ nome_banco: "Santander", status_banco: "condicionado" })?.curto).toBe(
      "APROVADO COM CONDIÇÕES",
    );
  });

  it("sem aprovação não há carta", () => {
    for (const status of ["em_analise", "recusada", "erro", "", null]) {
      expect(parecerDaCarta({ nome_banco: "Itaú", status_banco: status })).toBeNull();
      expect(bancoPermiteCarta({ status_banco: status })).toBe(false);
    }
  });
});

describe("proponentesDaCarta", () => {
  const proposta = { cpf_cnpj: "36601109819", nome_cliente: "Diego" };

  it("titular pelo CPF da proposta e cônjuge como 2º proponente", () => {
    const envolvidos = [
      { id: "b", nome: "Thaís", cpf_cnpj: "38743576869", conjuge_de: "a" },
      { id: "a", nome: "Diego de Jesus", cpf_cnpj: "36601109819" },
    ];
    const { p1, p2 } = proponentesDaCarta(proposta, envolvidos);
    expect(p1).toEqual({ nome: "Diego de Jesus", cpf: "366.011.098-19" });
    expect(p2).toEqual({ nome: "Thaís", cpf: "387.435.768-69" });
  });

  it("sem outros participantes não há 2º proponente", () => {
    const { p2 } = proponentesDaCarta(proposta, [
      { id: "a", nome: "Diego", cpf_cnpj: "36601109819" },
    ]);
    expect(p2).toBeNull();
  });
});

describe("camposIniciaisCarta", () => {
  const base = {
    proposta: {
      numero_proposta: "PRO-000399",
      cpf_cnpj: "36601109819",
      nome_cliente: "Cleitom",
      produto: "financiamento_imobiliario",
      valor_imovel: 600000,
      valor_financiamento: 450000,
      renda_total: 46000,
      prazo: 373,
      sistema_amortizacao: "P",
      utiliza_fgts: false,
    },
    banco: {
      nome_banco: "Bradesco",
      status_banco: "aprovada",
      numero_proposta_banco: "5526325",
      valor_parcela: 5303.59,
      codigo_indexador: "TR",
      sistema_amortizacao_banco: "P",
      taxa_juros_ano: 13.85,
      agencia: "0145",
    },
    envolvidos: [{ id: "a", nome: "Cleitom de Oliveira", cpf_cnpj: "36601109819" }],
    hoje: new Date(2026, 8, 16),
  };

  it("preenche o que o sistema já tem", () => {
    const c = camposIniciaisCarta(base);
    expect(c.numeroAnalise).toBe("5526325");
    expect(c.data).toBe("16/09/2026");
    expect(c.primeiraParcela).toMatch(/5\.303,59/);
    expect(c.sistemaAmortizacao).toBe("PRICE");
    expect(c.prazo).toBe("373 meses");
    expect(c.indexador).toBe("TR");
    expect(c.agencia).toBe("0145");
    expect(c.proponente2Nome).toBe(NAO_SE_APLICA);
    expect(c.fgtsAprovado).toBe(NAO_SE_APLICA);
    expect(c.vencimento).toBe("16/10/2026");
  });

  it("normaliza o indexador por extenso do Itaú", () => {
    const c = camposIniciaisCarta({
      ...base,
      banco: { ...base.banco, nome_banco: "Itaú", codigo_indexador: "Taxa Referencial" },
    });
    expect(c.indexador).toBe("TR");
  });

  it("nada é obrigatório: em branco sai como Não se aplica", () => {
    const c = { ...camposIniciaisCarta(base), construtora: "", unidade: "  ", observacoes: "" };
    expect(camposEmBrancoCarta(c)).toEqual([
      "Subsídio apurado",
      "Construtora",
      "Empreendimento",
      "Unidade",
    ]);
    const pdf = camposParaPdf(c);
    expect(pdf.construtora).toBe(NAO_SE_APLICA);
    expect(pdf.unidade).toBe(NAO_SE_APLICA);
    expect(pdf.agencia).toBe("0145");
    // Texto livre não vira "Não se aplica".
    expect(pdf.observacoes).toBe("");
  });

  it("máscara da data de vencimento", () => {
    expect(mascaraData("30062026")).toBe("30/06/2026");
    expect(mascaraData("3006")).toBe("30/06");
    expect(mascaraData("30/06/2026x9")).toBe("30/06/2026");
  });
});

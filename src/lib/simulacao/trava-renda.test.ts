import { describe, expect, it } from "vitest";
import { calcularSimulacao } from "./simulacao-rapida";
import { avaliarRendaMinima } from "./renda";
import {
  avaliarTravaRenda,
  mensagemRendaInsuficiente,
  mensagemRendaNoLimite,
  rendaEnviadaAoBanco,
  travaRendaDaSimulacao,
  travaRendaDoFormulario,
} from "./trava-renda";
import { humanizarErroBanco, humanizarRespostaErro } from "./bank-error-humanizer";

/*
 * Trava de renda (pedido do dono, 26/10/2026): a simulação ia ao banco com
 * renda abaixo da necessária para SAC e PRICE e voltava erro. Abaixo do limite
 * seco trava; entre o seco e a margem, aviso; acima da margem, nada.
 */

/** O Intl separa "R$" do número com espaço não separável. */
const semNbsp = (t: string | null | undefined) => String(t ?? "").replace(/ /g, " ");

const form = (mudar: Record<string, unknown> = {}) => ({
  tipo_pessoa: "PF",
  sistema_amortizacao: "S",
  renda_total: 50_000,
  renda_price: 0,
  estado_civil: "solteiro",
  nome_conjuge: "",
  cpf_conjuge: "",
  compoe_renda_conjuge: false,
  renda_conjuge: 0,
  participantes: [] as any[],
  valor_financiamento: 400_000,
  valor_imovel: 500_000,
  prazo: 360,
  prazo_2: null,
  bancos_ids: ["itau"],
  bancos_sac_ids: [] as string[],
  bancos_price_ids: [] as string[],
  ...mudar,
});

const min = (sistema: "S" | "P", prazo = 360) =>
  avaliarRendaMinima({
    valor_financiamento: 400_000,
    valor_imovel: 500_000,
    prazo_meses: prazo,
    taxa_ano: 0.1199,
    sistema,
  })!.rendaMinima;

describe("1ª parcela e renda mínima", () => {
  it("SAC: 1ª parcela = amortização + juros; PRICE: parcela fixa, menor", () => {
    const i = Math.pow(1.1199, 1 / 12) - 1;
    const sac = calcularSimulacao({ valor_financiamento: 400_000, prazo_meses: 360, taxa_ano: 0.1199, sistema: "S" });
    const price = calcularSimulacao({ valor_financiamento: 400_000, prazo_meses: 360, taxa_ano: 0.1199, sistema: "P" });
    expect(sac.primeira_parcela).toBeCloseTo(400_000 / 360 + 400_000 * i, 1);
    expect(price.primeira_parcela).toBeLessThan(sac.primeira_parcela);
  });

  it("400 mil em 360 meses: SAC 22 mil, PRICE 40 mil (os mesmos números do Corretor)", () => {
    expect(min("S")).toBe(22_000);
    expect(min("P")).toBe(40_000);
  });
});

describe("rendaEnviadaAoBanco (igual ao rendaTotal do envio)", () => {
  it("soma cônjuge que compõe (casado e identificado) e participantes que compõem", () => {
    const f = form({
      renda_total: 10_000,
      estado_civil: "casado",
      nome_conjuge: "Carlos",
      compoe_renda_conjuge: true,
      renda_conjuge: 7_000,
      participantes: [
        { compoe_renda: true, renda: 5_000 },
        { compoe_renda: false, renda: 9_000 },
      ],
    });
    expect(rendaEnviadaAoBanco(f)).toBe(22_000);
  });

  it("cônjuge compondo sem renda entra com o padrão do cadastro; solteiro não soma cônjuge", () => {
    const casado = form({ renda_total: 10_000, estado_civil: "CA", nome_conjuge: "C", compoe_renda_conjuge: true, renda_conjuge: 0 });
    expect(rendaEnviadaAoBanco(casado)).toBeGreaterThan(10_000);
    const solteiro = form({ renda_total: 10_000, nome_conjuge: "C", compoe_renda_conjuge: true, renda_conjuge: 7_000 });
    expect(rendaEnviadaAoBanco(solteiro)).toBe(10_000);
  });
});

const seca = (sistema: "S" | "P", prazo = 360) =>
  avaliarTravaRenda({
    sistemas: [{ sistema, renda: 0 }],
    prazos: [prazo],
    valor_financiamento: 400_000,
    valor_imovel: 500_000,
  })[0]!.seca;

describe("limite seco (trava) e limite com margem (aviso)", () => {
  it("limite seco = prestação sobre 30% (SAC) / 15% (PRICE), sem margem — igual ao Corretor", () => {
    expect(seca("S")).toBe(16_968.75);
    expect(seca("P")).toBe(27_405.56);
    expect(min("S")).toBeGreaterThan(seca("S"));
    expect(min("P")).toBeGreaterThan(seca("P"));
  });

  it("exatamente no limite seco: envia, com aviso; R$ 1 abaixo: trava", () => {
    const na = travaRendaDoFormulario(form({ renda_total: seca("S") }));
    expect(na.mensagem).toBeNull();
    expect(na.aviso).not.toBeNull();
    const abaixo = travaRendaDoFormulario(form({ renda_total: seca("S") - 1 }));
    expect(abaixo.mensagem).not.toBeNull();
    expect(abaixo.aviso).toBeNull();
  });

  it("faixa do aviso (entre o seco e a margem): aviso amarelo, sem trava", () => {
    const t = travaRendaDoFormulario(form({ renda_total: 20_000 }));
    expect(t.mensagem).toBeNull();
    expect(t.campo).toBeNull();
    expect(t.aviso).toBe(
      "A renda está no limite para SAC: o banco pode recusar. Para aumentar a chance, some a renda de um segundo proponente, aumente a entrada ou o prazo.",
    );
  });

  it("na margem ou acima: nada a mostrar", () => {
    for (const r of [min("S"), min("S") + 5_000]) {
      const t = travaRendaDoFormulario(form({ renda_total: r }));
      expect(t.mensagem).toBeNull();
      expect(t.aviso).toBeNull();
    }
  });

  it("Ambos: o aviso cita só o sistema no limite; o que trava não entra no aviso", () => {
    const ambos = (rs: number, rp: number) =>
      travaRendaDoFormulario(
        form({ sistema_amortizacao: "B", renda_total: rs, renda_price: rp, bancos_sac_ids: ["itau"], bancos_price_ids: ["bradesco"] }),
      );
    expect(ambos(20_000, 30_000).aviso).toContain("no limite para SAC e PRICE");
    expect(ambos(30_000, 30_000).aviso).toContain("no limite para PRICE:");
    const travaPrice = ambos(20_000, 20_000);
    expect(travaPrice.aviso).toContain("no limite para SAC:");
    expect(travaPrice.mensagem).toContain("abaixo da mínima para PRICE");
    expect(mensagemRendaNoLimite([])).toBeNull();
  });
});

describe("travaRendaDoFormulario", () => {
  it("abaixo do seco: trava com a renda, a mínima e o que fazer", () => {
    const t = travaRendaDoFormulario(form({ renda_total: 15_000 }));
    expect(t.campo).toBe("renda_total");
    expect(semNbsp(t.mensagem)).toBe(
      "A renda informada (R$ 15.000,00) está abaixo da mínima para SAC (R$ 16.968,75). Aumente a renda (some a de um segundo proponente), aumente a entrada ou o prazo.",
    );
  });

  it("composição de renda resolve: titular 10 mil + cônjuge 7 mil cobre o SAC", () => {
    const f = form({ renda_total: 10_000, estado_civil: "casado", nome_conjuge: "C", compoe_renda_conjuge: true, renda_conjuge: 7_000 });
    expect(travaRendaDoFormulario(f).mensagem).toBeNull();
    expect(travaRendaDoFormulario({ ...f, compoe_renda_conjuge: false }).mensagem).not.toBeNull();
  });

  it("PRICE simples usa o seco do PRICE", () => {
    const t = travaRendaDoFormulario(form({ sistema_amortizacao: "P", renda_total: 25_000 }));
    expect(semNbsp(t.mensagem)).toContain("abaixo da mínima para PRICE (R$ 27.405,56)");
  });

  it("Ambos: só o PRICE não cabe — destaca a renda PRICE e explica que o SAC pode ir sozinho", () => {
    const t = travaRendaDoFormulario(
      form({ sistema_amortizacao: "B", renda_total: 25_000, renda_price: 25_000, bancos_sac_ids: ["itau"], bancos_price_ids: ["bradesco"] }),
    );
    expect(t.campo).toBe("renda_price");
    expect(semNbsp(t.mensagem)).toContain("A renda cobre o SAC: tire os bancos PRICE para enviar só SAC.");
    // Sem os bancos PRICE, passa.
    expect(
      travaRendaDoFormulario(form({ sistema_amortizacao: "B", renda_total: 25_000, renda_price: 25_000, bancos_sac_ids: ["itau"] })).mensagem,
    ).toBeNull();
  });

  it("Ambos com os dois abaixo e rendas diferentes: cita cada renda", () => {
    const t = travaRendaDoFormulario(
      form({ sistema_amortizacao: "B", renda_total: 10_000, renda_price: 12_000, bancos_sac_ids: ["itau"], bancos_price_ids: ["bradesco"] }),
    );
    expect(t.campo).toBe("renda_total");
    expect(semNbsp(t.mensagem)).toBe(
      "A renda informada para SAC (R$ 10.000,00) está abaixo da mínima (R$ 16.968,75). A renda informada para PRICE (R$ 12.000,00) está abaixo da mínima (R$ 27.405,56). Aumente a renda (some a de um segundo proponente), aumente a entrada ou o prazo.",
    );
  });

  it("segundo prazo mais curto também é conferido e aparece na mensagem", () => {
    const t = travaRendaDoFormulario(form({ renda_total: 17_000, prazo_2: 300 }));
    expect(semNbsp(t.mensagem)).toContain("SAC em 300 meses (R$ 17.709,49)");
  });

  it("renda vazia e PJ ficam fora (pendência de campo e fluxo bloqueado à parte)", () => {
    expect(travaRendaDoFormulario(form({ renda_total: 0 })).mensagem).toBeNull();
    expect(travaRendaDoFormulario(form({ tipo_pessoa: "PJ", renda_total: 1 })).mensagem).toBeNull();
  });
});

describe("travaRendaDaSimulacao (servidor)", () => {
  it("simulação gravada abaixo do seco é barrada antes da integração; no seco, segue", () => {
    expect(
      semNbsp(travaRendaDaSimulacao({ ...form({ renda_total: "16967.75" }), sistema_amortizacao: "S" })),
    ).toContain("abaixo da mínima para SAC");
    expect(travaRendaDaSimulacao({ ...form({ renda_total: "16968.75" }), sistema_amortizacao: "S" })).toBeNull();
  });

  it("simulação PRICE do modo Ambos usa a sua própria renda_total", () => {
    expect(travaRendaDaSimulacao({ ...form({ renda_total: 27_404.56 }), sistema_amortizacao: "P" })).not.toBeNull();
    expect(travaRendaDaSimulacao({ ...form({ renda_total: 27_405.56 }), sistema_amortizacao: "P" })).toBeNull();
  });

  it("mensagemRendaInsuficiente: nada faltando, nada a dizer", () => {
    const av = avaliarTravaRenda({ sistemas: [{ sistema: "S", renda: 99_000 }], prazos: [360], valor_financiamento: 400_000, valor_imovel: 500_000 });
    expect(mensagemRendaInsuficiente(av)).toBeNull();
  });
});

describe("erro de renda devolvido pelo banco vira mensagem com o que fazer", () => {
  it("código RENDA_INSUFICIENTE", () => {
    expect(humanizarRespostaErro({ error: { code: "RENDA_INSUFICIENTE" } }, 422)).toMatch(
      /Renda insuficiente.*aumente a entrada ou o prazo/,
    );
  });

  it("Bradesco 119", () => {
    const msg = humanizarRespostaErro(
      { error: { code: "INT-006", message: 'Simulação Bradesco falhou: {"codigo":"119","mensagem":""}' } },
      400,
    );
    expect(msg).toMatch(/abaixo da renda mínima exigida pelo banco\. Aumente a renda/);
  });

  it("texto livre do banco sobre capacidade de pagamento / comprometimento", () => {
    const a = humanizarRespostaErro(
      { error: { code: "INT-006", message: 'Simulação Santander falhou: {"codigo":"77","mensagem":"Capacidade de pagamento insuficiente"}' } },
      400,
    );
    expect(a).toMatch(/^O banco recusou por renda/);
    expect(a).toContain("Motivo do banco: Capacidade de pagamento insuficiente");
    const b = humanizarRespostaErro({ error: { message: "Parcela excede 30% da renda do proponente" } }, 400);
    expect(b).toMatch(/^O banco recusou por renda/);
    expect(humanizarErroBanco(null, "Renda insuficiente para o valor")).toMatch(/^O banco recusou por renda/);
  });

  it("erro que não é de renda continua com a tradução de antes", () => {
    expect(humanizarRespostaErro({ error: { code: "TIMEOUT" } }, 400)).toBe(
      "O banco não respondeu no tempo esperado. Tente reenviar.",
    );
  });
});

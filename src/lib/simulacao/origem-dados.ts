/**
 * Origem dos valores gravados em `simulacao_bancos`.
 *
 * Quando a IF não devolve `valorFinanciamentoBanco*` / `prazoPagamentoBanco*`,
 * mantemos internamente o valor SOLICITADO como fallback (relatórios, PDFs),
 * mas a interface NÃO pode exibi-lo como se fosse resposta do banco.
 * Por isso marcamos a origem em `raw_response._origem_dados`.
 */
export type CampoComOrigem = "valor_financiamento_max" | "prazo_pagamento_max";

export type OrigemDados = Partial<Record<CampoComOrigem, "banco" | "solicitado">>;

/** Monta a marcação de origem a partir do payload cru devolvido pela API. */
export function marcarOrigemDados(dadosApi: any): OrigemDados {
  return {
    valor_financiamento_max:
      dadosApi?.valorFinanciamentoBancoMax != null || dadosApi?.valorFinanciamentoBanco != null
        ? "banco"
        : "solicitado",
    prazo_pagamento_max:
      dadosApi?.prazoPagamentoBancoMax != null || dadosApi?.prazoPagamentoBanco != null
        ? "banco"
        : "solicitado",
  };
}

/**
 * `true` quando o valor exibido veio efetivamente do banco.
 * Registros antigos (sem marcação) são inferidos do próprio `raw_response`.
 */
export function bancoInformou(banco: any, campo: CampoComOrigem): boolean {
  const raw = banco?.raw_response as any;
  const marca = raw?._origem_dados?.[campo];
  if (marca) return marca === "banco";
  if (!raw || typeof raw !== "object") return true; // sem retorno: não mascara legado
  if (campo === "prazo_pagamento_max") {
    return raw.prazoPagamentoBancoMax != null || raw.prazoPagamentoBanco != null;
  }
  return raw.valorFinanciamentoBancoMax != null || raw.valorFinanciamentoBanco != null;
}

/** Valor a exibir: `null` quando o banco não informou (a tela mostra "—"). */
export function valorInformadoPeloBanco<T>(banco: any, campo: CampoComOrigem, valor: T): T | null {
  return bancoInformou(banco, campo) ? valor : null;
}

/**
 * Total financiado EFETIVAMENTE devolvido pela IF. Nunca cai para o valor
 * solicitado na operação — se o banco não informou, devolve `null` e a tela
 * mostra "—" ("não informado pelo banco").
 */
export function totalFinanciadoBanco(banco: any): number | null {
  const raw = banco?.raw_response as any;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const despesas = num(raw?.valorDespesasFinanciadas) ?? 0;

  if (raw && typeof raw === "object") {
    // `valorTotalFinanciamento` JÁ É o total com as despesas embutidas — some
    // as despesas nele e elas contam duas vezes. Antes ele dividia a mesma
    // cadeia de fallback com campos que são BASE (sem despesas), e o resultado
    // dependia de qual campo o banco tivesse preenchido:
    //
    //   Bradesco  base 130.000 + 39.000 = 169.000  → certo por acaso
    //   Itaú      total 169.000 + 39.000 = 208.000  → despesa dobrada
    //   Santander total 130.000 + 39.000 = 169.000  → exibia o valor que
    //             PEDIMOS, escondendo que o banco calculou sobre 130.000
    //
    // O caso do Santander era o mais grave: a tela mostrava 169.000 ao lado de
    // uma parcela de R$ 1.628,64, que é de 130.000 — os dois números lado a
    // lado, um contradizendo o outro, e o erro de exibição mascarando um
    // problema real do provedor.
    const total = num(raw.valorTotalFinanciamento);
    if (total != null) return total;

    // Sem o total, o que resta é a base — aí sim as despesas entram.
    const base = num(raw.valorFinanciamentoBancoMax) ?? num(raw.valorFinanciamentoBanco);
    if (base != null) return base + despesas;
  }

  // Sem retorno bruto (registros legados): usa o campo apenas se marcado como
  // resposta do banco. Aqui o campo é base, então a soma continua valendo.
  if (bancoInformou(banco, "valor_financiamento_max")) {
    const vBase = num(banco?.valor_financiamento_max);
    if (vBase != null) return vBase + despesas;
  }
  return null;
}

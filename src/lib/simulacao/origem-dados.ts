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

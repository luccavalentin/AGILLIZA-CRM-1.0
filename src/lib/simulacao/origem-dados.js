/** Monta a marcação de origem a partir do payload cru devolvido pela API. */
export function marcarOrigemDados(dadosApi) {
    return {
        valor_financiamento_max: dadosApi?.valorFinanciamentoBancoMax != null || dadosApi?.valorFinanciamentoBanco != null
            ? "banco"
            : "solicitado",
        prazo_pagamento_max: dadosApi?.prazoPagamentoBancoMax != null || dadosApi?.prazoPagamentoBanco != null
            ? "banco"
            : "solicitado",
    };
}
/**
 * `true` quando o valor exibido veio efetivamente do banco.
 * Registros antigos (sem marcação) são inferidos do próprio `raw_response`.
 */
export function bancoInformou(banco, campo) {
    const raw = banco?.raw_response;
    const marca = raw?._origem_dados?.[campo];
    if (marca)
        return marca === "banco";
    if (!raw || typeof raw !== "object")
        return true; // sem retorno: não mascara legado
    if (campo === "prazo_pagamento_max") {
        return raw.prazoPagamentoBancoMax != null || raw.prazoPagamentoBanco != null;
    }
    return raw.valorFinanciamentoBancoMax != null || raw.valorFinanciamentoBanco != null;
}
/** Valor a exibir: `null` quando o banco não informou (a tela mostra "—"). */
export function valorInformadoPeloBanco(banco, campo, valor) {
    return bancoInformou(banco, campo) ? valor : null;
}
/**
 * Total financiado EFETIVAMENTE devolvido pela IF. Nunca cai para o valor
 * solicitado na operação — se o banco não informou, devolve `null` e a tela
 * mostra "—" ("não informado pelo banco").
 */
export function totalFinanciadoBanco(banco) {
    const raw = banco?.raw_response;
    const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
    };
    if (raw && typeof raw === "object") {
        const doRetorno = num(raw.valorFinanciamentoBancoMax) ??
            num(raw.valorFinanciamentoBanco) ??
            num(raw.valorTotalFinanciamento);
        if (doRetorno != null)
            return doRetorno;
    }
    // Sem retorno bruto (registros legados): usa o campo apenas se marcado como
    // resposta do banco.
    if (bancoInformou(banco, "valor_financiamento_max")) {
        return num(banco?.valor_financiamento_max);
    }
    return null;
}

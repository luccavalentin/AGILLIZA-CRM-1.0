/**
 * Cálculo local de simulação (Simulação Rápida) — sem chamada ao provedor.
 * Estimativa por SAC e PRICE. Módulo puro (client + server safe).
 * As taxas são estimativas de mercado por banco e servem apenas para
 * a simulação rápida; a simulação personalizada usa os valores reais do banco.
 */
/**
 * Taxas anuais de referência por código COMPE — fallback quando não há
 * histórico recente de simulação no banco. Valores calibrados pela média
 * observada nos últimos retornos reais dos bancos (2025-2026).
 */
const TAXA_PADRAO_ANO = {
    237: 0.1265, // Bradesco  — média real ~12,65% a.a.
    33: 0.1255, // Santander  — média real ~12,55% a.a.
    341: 0.1325, // Itaú       — média real ~13,25% a.a.
    77: 0.1199, // Inter
    104: 0.1189, // Caixa
};
export function taxaAnoDeBanco(codigo_banco, override) {
    const dinamica = override?.[codigo_banco];
    if (dinamica != null && dinamica > 0)
        return dinamica;
    return TAXA_PADRAO_ANO[codigo_banco] ?? 0.1299;
}
function taxaMensal(taxaAno) {
    return Math.pow(1 + taxaAno, 1 / 12) - 1;
}
export function calcularSimulacao({ valor_financiamento, prazo_meses, taxa_ano, sistema, }) {
    const i = taxaMensal(taxa_ano);
    const n = Math.max(1, Math.round(prazo_meses));
    const pv = Math.max(0, valor_financiamento);
    const cetAno = taxa_ano * 1.05; // Estimativa simples para CET na rápida
    const fatorRenda = sistema === "P" ? 0.25 : 0.3;
    const rendaMin = (pv * i) / (1 - Math.pow(1 + i, -n)) / fatorRenda;
    if (sistema === "P") {
        // PRICE: parcela fixa
        const fator = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
        const parcela = pv * fator;
        const total = parcela * n;
        return {
            primeira_parcela: parcela,
            ultima_parcela: parcela,
            parcela_media: parcela,
            total_pago: total,
            total_juros: total - pv,
            taxa_mes: i,
            renda_minima: Math.max(rendaMin, parcela / 0.3),
            cet_ano: cetAno,
        };
    }
    // SAC: amortização constante, juros decrescentes
    const amort = pv / n;
    let saldo = pv;
    let total = 0;
    let primeira = 0;
    let ultima = 0;
    for (let k = 0; k < n; k++) {
        const juros = saldo * i;
        const parcela = amort + juros;
        if (k === 0)
            primeira = parcela;
        if (k === n - 1)
            ultima = parcela;
        total += parcela;
        saldo -= amort;
    }
    return {
        primeira_parcela: primeira,
        ultima_parcela: ultima,
        parcela_media: total / n,
        total_pago: total,
        total_juros: total - pv,
        taxa_mes: i,
        renda_minima: Math.max(rendaMin, primeira / 0.3),
        cet_ano: cetAno,
    };
}
export function compararBancosRapido(bancos, base) {
    const resultados = [];
    for (const b of bancos) {
        // ITAÚ (341) não tem PRICE. Se o sistema for PRICE, ignoramos o Itaú.
        // Se for AMBOS, simulamos apenas o SAC para o Itaú.
        const isItau = String(b.codigo_banco) === "341";
        let sistemasParaEsteBanco;
        if (base.sistema === "AMBOS") {
            sistemasParaEsteBanco = isItau ? ["S"] : ["S", "P"];
        }
        else {
            sistemasParaEsteBanco = [base.sistema];
        }
        for (const s of sistemasParaEsteBanco) {
            // Pular Itaú se o sistema solicitado explicitamente for PRICE
            if (isItau && s === "P")
                continue;
            resultados.push({
                ...b,
                nome_banco: base.sistema === "AMBOS"
                    ? `${b.nome_banco} (${s === "S" ? "SAC" : "PRICE"})`
                    : b.nome_banco,
                resultado: calcularSimulacao({
                    valor_financiamento: base.valor_financiamento,
                    prazo_meses: base.prazo_meses,
                    taxa_ano: b.taxa_ano,
                    sistema: s,
                }),
            });
        }
    }
    return resultados.sort((a, b) => a.resultado.primeira_parcela - b.resultado.primeira_parcela);
}

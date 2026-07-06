import {
  baixarSimulacaoSimplificadaPDF,
  baixarSimulacaoDetalhadaPDF,
  baixarSimulacaoPDF,
} from "@/lib/simulacao/simulacao-pdf";

interface PropostaPdfInput {
  proposta: any;
  bancos: any[];
}

/**
 * Extrato simplificado da proposta (cabeçalho com CET/CESH/taxas + resumo, um banco por folha).
 * Reutiliza o mesmo layout institucional das simulações, com rótulos de proposta.
 */
export function baixarPropostaSimplificadaPDF({ proposta, bancos }: PropostaPdfInput) {
  return baixarSimulacaoSimplificadaPDF({
    simulacao: proposta,
    bancos,
    docLabel: "Extrato da Proposta de Financiamento",
    dataLabel: "Data da Proposta",
    filePrefix: "proposta",
  });
}

/** Extrato detalhado da proposta (todas as parcelas), um banco por folha. */
export function baixarPropostaDetalhadaPDF({ proposta, bancos }: PropostaPdfInput) {
  return baixarSimulacaoDetalhadaPDF({
    simulacao: proposta,
    bancos,
    docLabel: "Extrato da Proposta de Financiamento",
    dataLabel: "Data da Proposta",
    filePrefix: "proposta",
  });
}

/** Comparativo consolidado dos bancos da proposta (uso interno). */
export function baixarPropostaConsolidadoPDF({ proposta, bancos }: PropostaPdfInput) {
  return baixarSimulacaoPDF({
    simulacao: { ...proposta, numero_simulacao: proposta.numero_proposta },
    bancos,
  });
}

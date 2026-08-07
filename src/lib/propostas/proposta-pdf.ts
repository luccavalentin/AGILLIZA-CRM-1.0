import {
  baixarSimulacaoSimplificadaPDF,
  baixarSimulacaoDetalhadaPDF,
  baixarSimulacaoPDF,
  nomeDescritivo,
} from "@/lib/simulacao/simulacao-pdf";

interface PropostaPdfInput {
  proposta: any;
  bancos: any[];
}

/**
 * Constrói o nome do arquivo da proposta seguindo o MESMO padrão da simulação,
 * porém prefixado com o número da proposta no banco (numero_proposta_banco),
 * quando existir. Ex.: "PROP-123 - Bradesco-SAC-C e V 500k - Finan 400k - ...".
 * Para PDFs consolidados (múltiplos bancos), usa o numero_proposta geral.
 */
function prefixoNumeroProposta(proposta: any, bancos: any[]): string {
  // 1 banco: usa o protocolo daquele banco.
  if (bancos?.length === 1) {
    const n = String(bancos[0]?.numero_proposta_banco ?? "").trim();
    if (n) return n;
  }
  // Fallback: número interno da proposta.
  return String(proposta?.numero_proposta ?? "").trim();
}

function montarFilePrefix(proposta: any, bancos: any[]): string {
  const prefixo = prefixoNumeroProposta(proposta, bancos);
  const descritivo = nomeDescritivo(proposta, bancos);
  return prefixo ? `${prefixo} - ${descritivo}` : descritivo;
}

/**
 * Extrato simplificado da proposta (cabeçalho com CET/CESH/taxas + resumo, um banco por folha).
 * Nome do arquivo: "{N proposta banco} - {mesmo padrão da simulação}".
 */
export function baixarPropostaSimplificadaPDF({ proposta, bancos }: PropostaPdfInput) {
  return baixarSimulacaoSimplificadaPDF({
    simulacao: proposta,
    bancos,
    docLabel: "Extrato da Proposta de Financiamento",
    dataLabel: "Data da Proposta",
    filePrefix: montarFilePrefix(proposta, bancos),
  });
}

/** Extrato detalhado da proposta (todas as parcelas), um banco por folha. */
export function baixarPropostaDetalhadaPDF({ proposta, bancos }: PropostaPdfInput) {
  return baixarSimulacaoDetalhadaPDF({
    simulacao: proposta,
    bancos,
    docLabel: "Extrato da Proposta de Financiamento",
    dataLabel: "Data da Proposta",
    filePrefix: montarFilePrefix(proposta, bancos),
  });
}

/** Comparativo consolidado dos bancos da proposta (uso interno). */
export function baixarPropostaConsolidadoPDF({ proposta, bancos }: PropostaPdfInput) {
  return baixarSimulacaoPDF({
    simulacao: { ...proposta, numero_simulacao: proposta.numero_proposta },
    bancos,
    filePrefix: montarFilePrefix(proposta, bancos),
  });
}

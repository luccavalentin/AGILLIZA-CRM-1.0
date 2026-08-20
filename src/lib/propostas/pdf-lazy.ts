/**
 * Carregamento sob demanda dos PDFs de proposta (jsPDF fora do bundle inicial).
 */
export async function baixarPropostaSimplificadaPDF(
  ...args: Parameters<(typeof import("./proposta-pdf"))["baixarPropostaSimplificadaPDF"]>
) {
  const mod = await import("./proposta-pdf");
  return mod.baixarPropostaSimplificadaPDF(...args);
}

export async function baixarPropostaDetalhadaPDF(
  ...args: Parameters<(typeof import("./proposta-pdf"))["baixarPropostaDetalhadaPDF"]>
) {
  const mod = await import("./proposta-pdf");
  return mod.baixarPropostaDetalhadaPDF(...args);
}

export async function baixarPropostaConsolidadoPDF(
  ...args: Parameters<(typeof import("./proposta-pdf"))["baixarPropostaConsolidadoPDF"]>
) {
  const mod = await import("./proposta-pdf");
  return mod.baixarPropostaConsolidadoPDF(...args);
}

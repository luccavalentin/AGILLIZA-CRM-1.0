/**
 * Carregamento sob demanda dos geradores de PDF (jsPDF só é baixado no clique).
 */

export async function baixarDemandasPDF(
  ...args: Parameters<(typeof import("./export-pdf"))["baixarDemandasPDF"]>
) {
  const mod = await import("./export-pdf");
  return mod.baixarDemandasPDF(...args);
}

export async function baixarTarefasPDF(
  ...args: Parameters<(typeof import("./export-pdf"))["baixarTarefasPDF"]>
) {
  const mod = await import("./export-pdf");
  return mod.baixarTarefasPDF(...args);
}

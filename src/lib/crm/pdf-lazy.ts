/**
 * Carregamento sob demanda dos geradores de PDF (jsPDF só é baixado no clique).
 */

export async function imprimirFichaPDF(
  ...args: Parameters<(typeof import("./ficha-pdf"))["imprimirFichaPDF"]>
) {
  const mod = await import("./ficha-pdf");
  return mod.imprimirFichaPDF(...args);
}

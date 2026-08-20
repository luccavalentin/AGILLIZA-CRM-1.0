/**
 * Carregamento sob demanda dos geradores de PDF (jsPDF só é baixado no clique).
 */

export async function gerarEbookFaqPDF(
  ...args: Parameters<(typeof import("./ebook-pdf"))["gerarEbookFaqPDF"]>
) {
  const mod = await import("./ebook-pdf");
  return mod.gerarEbookFaqPDF(...args);
}

export async function gerarVerbetePDF(
  ...args: Parameters<(typeof import("./biblioteca-pdf"))["gerarVerbetePDF"]>
) {
  const mod = await import("./biblioteca-pdf");
  return mod.gerarVerbetePDF(...args);
}

export async function gerarCompendioPDF(
  ...args: Parameters<(typeof import("./biblioteca-pdf"))["gerarCompendioPDF"]>
) {
  const mod = await import("./biblioteca-pdf");
  return mod.gerarCompendioPDF(...args);
}

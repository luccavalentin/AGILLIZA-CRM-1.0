/**
 * Carregamento sob demanda do PDF de papel timbrado.
 */
export async function gerarPapelTimbradoPDF(
  ...args: Parameters<(typeof import("./papel-timbrado-pdf"))["gerarPapelTimbradoPDF"]>
) {
  const mod = await import("./papel-timbrado-pdf");
  return mod.gerarPapelTimbradoPDF(...args);
}

export async function gerarPapelTimbradoWord(
  ...args: Parameters<(typeof import("./word-export"))["gerarPapelTimbradoWord"]>
) {
  const mod = await import("./word-export");
  return mod.gerarPapelTimbradoWord(...args);
}

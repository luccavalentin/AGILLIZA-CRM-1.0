/**
 * Carregamento sob demanda dos geradores de PDF (jsPDF só é baixado no clique).
 */

export async function gerarHoleritePdf(
  ...args: Parameters<(typeof import("./holerite-pdf"))["gerarHoleritePdf"]>
) {
  const mod = await import("./holerite-pdf");
  return mod.gerarHoleritePdf(...args);
}

export async function gerarFichaFuncionarioPdf(
  ...args: Parameters<(typeof import("./ficha-pdf"))["gerarFichaFuncionarioPdf"]>
) {
  const mod = await import("./ficha-pdf");
  return mod.gerarFichaFuncionarioPdf(...args);
}

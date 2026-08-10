/**
 * Reduz imagens grandes no navegador antes do upload. O arquivo original pode
 * ter qualquer tamanho; apenas a versão otimizada é enviada e exibida.
 */
export async function otimizarImagem(file: File, limite = 1280): Promise<File> {
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/svg+xml" ||
    file.type === "image/gif"
  ) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, limite / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) {
    bitmap.close();
    return file;
  }

  contexto.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82),
  );
  if (!blob) return file;

  const nomeBase = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${nomeBase}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

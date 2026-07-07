import JSZip from "jszip";
import type { ItemBackupDoc } from "./backup-documentos.functions";

export interface ProgressoBackup {
  total: number;
  baixados: number;
  falhas: number;
}

/**
 * Baixa cada documento do inventário e compacta tudo num único ZIP,
 * respeitando a estrutura de pastas. Roda no navegador.
 */
export async function baixarDocumentosZip(
  itens: ItemBackupDoc[],
  onProgress?: (p: ProgressoBackup) => void,
): Promise<{ falhas: number }> {
  const zip = new JSZip();
  let baixados = 0;
  let falhas = 0;
  const total = itens.length;

  const CONCORRENCIA = 5;
  let cursor = 0;

  async function worker() {
    while (cursor < itens.length) {
      const idx = cursor++;
      const item = itens[idx];
      try {
        const resp = await fetch(item.url);
        if (!resp.ok) throw new Error(String(resp.status));
        const blob = await resp.blob();
        const caminho = `${item.pasta}/${item.nomeArquivo}`.replace(/^\/+/, "");
        zip.file(caminho, blob);
        baixados++;
      } catch {
        falhas++;
      }
      onProgress?.({ total, baixados, falhas });
    }
  }

  await Promise.all(Array.from({ length: CONCORRENCIA }, () => worker()));

  const conteudo = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const hoje = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(conteudo);
  const a = document.createElement("a");
  a.href = url;
  a.download = `documentos-backup-${hoje}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { falhas };
}

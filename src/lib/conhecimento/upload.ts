/**
 * Envio de imagens e anexos dos artigos (navegador). Imagem vai para o bucket público
 * `conhecimento-imagens` (abre na News do Agilliza Tech), anexo para o privado
 * `conhecimento-anexos`; sempre na pasta da conta, com nome aleatório. Quem pode enviar é
 * decidido pelas políticas do armazenamento (migração 20261027070002).
 */
import { supabase } from "@/integrations/supabase/client";

const IMAGENS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGEM = 5 * 1024 * 1024;
const MAX_ANEXO = 20 * 1024 * 1024;

function extensao(nome: string, padrao: string) {
  const e = (nome.split(".").pop() ?? "").toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(e) ? e : padrao;
}

export async function enviarImagemArtigo(correspondenteId: string, arquivo: File): Promise<string> {
  if (!IMAGENS.has(arquivo.type)) throw new Error("Envie JPG, PNG, WebP ou GIF.");
  if (arquivo.size > MAX_IMAGEM) throw new Error("A imagem passa de 5 MB.");
  const caminho = `${correspondenteId}/${crypto.randomUUID()}.${extensao(arquivo.name, "jpg")}`;
  const { error } = await supabase.storage
    .from("conhecimento-imagens")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (error) throw new Error("Não foi possível enviar a imagem (confira sua permissão).");
  return supabase.storage.from("conhecimento-imagens").getPublicUrl(caminho).data.publicUrl;
}

export async function enviarAnexoArtigo(
  correspondenteId: string,
  arquivo: File,
): Promise<{ nome: string; caminho: string; tamanho: number; tipo: string }> {
  if (arquivo.size > MAX_ANEXO) throw new Error("O anexo passa de 20 MB.");
  const ext = extensao(arquivo.name, "pdf");
  if (!["pdf", "docx", "xlsx", "pptx", "jpg", "jpeg", "png", "txt", "csv"].includes(ext)) {
    throw new Error("Anexo aceito: PDF, Word, Excel, PowerPoint, imagem, TXT ou CSV.");
  }
  const caminho = `${correspondenteId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("conhecimento-anexos")
    .upload(caminho, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error("Não foi possível enviar o anexo (confira sua permissão).");
  return {
    nome: arquivo.name.slice(0, 200),
    caminho,
    tamanho: arquivo.size,
    tipo: arquivo.type || ext,
  };
}

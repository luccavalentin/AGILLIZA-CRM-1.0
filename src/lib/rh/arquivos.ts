/**
 * Arquivos do RH no bucket privado `rh-documentos`.
 *
 * A política do bucket só aceita caminhos que começam pelo correspondente do
 * usuário; antes cada tela descobria esse id e fazia o upload por conta própria.
 * Abrir e baixar usam URL assinada temporária.
 */
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { gerarUrlAssinada } from "@/lib/rh/submodulos.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";

export const BUCKET_RH = "rh-documentos";

const SEM_EMPRESA =
  "Seu usuário não está vinculado a uma empresa. Peça ao administrador para revisar o cadastro.";

/** Correspondente do usuário logado (primeira pasta dos caminhos no bucket). */
export async function correspondenteAtual(): Promise<string> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Sua sessão expirou. Entre de novo.");
  const { data, error } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const cid = data?.correspondente_id as string | undefined;
  if (!cid) throw new Error(SEM_EMPRESA);
  return cid;
}

/** Extensão do arquivo, só com letras e números. */
export function extensaoDe(nome: string, padrao = "bin"): string {
  const ext = (nome.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext && ext !== nome.toLowerCase() ? ext.slice(0, 10) : padrao;
}

/**
 * Envia o arquivo para `<correspondente>/<caminho>` e devolve o caminho completo.
 * `caminho` é relativo ao correspondente (ex.: `holerites/<func>/2026-10.pdf`).
 */
export async function enviarArquivoRh(
  caminho: string,
  arquivo: File | Blob,
  opcoes: { contentType?: string; upsert?: boolean } = {},
): Promise<string> {
  const cid = await correspondenteAtual();
  const path = `${cid}/${caminho}`;
  const { error } = await supabase.storage.from(BUCKET_RH).upload(path, arquivo, {
    contentType: opcoes.contentType || arquivo.type || undefined,
    upsert: opcoes.upsert ?? false,
  });
  if (error) throw new Error(mensagemDeErro(error, "Não foi possível enviar o arquivo."));
  return path;
}

/** Caminho do holerite de uma competência (um por funcionário e mês). */
export function caminhoHolerite(funcionarioId: string, ano: number, mes: number): string {
  return `holerites/${funcionarioId}/${ano}-${String(mes).padStart(2, "0")}.pdf`;
}

async function urlAssinada(path: string): Promise<string> {
  const r = await gerarUrlAssinada({ data: { path, expira_em: 300 } });
  return r.url;
}

/** Abre o arquivo em nova aba. Mostra o erro em toast se falhar. */
export async function abrirArquivoRh(path: string): Promise<void> {
  // A aba é aberta antes do await para o navegador não bloquear como pop-up.
  const aba = window.open("", "_blank");
  try {
    const url = await urlAssinada(path);
    if (aba) {
      aba.opener = null;
      aba.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (e) {
    aba?.close();
    toast.error(mensagemDeErro(e, "Não foi possível abrir o arquivo."));
  }
}

/** Baixa o arquivo com o nome original. Mostra o erro em toast se falhar. */
export async function baixarArquivoRh(path: string, nome: string): Promise<void> {
  try {
    const url = await urlAssinada(path);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    toast.error(mensagemDeErro(e, "Não foi possível baixar o arquivo."));
  }
}

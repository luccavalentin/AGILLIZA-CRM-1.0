/**
 * Comprovantes e documentos do financeiro: o arquivo vai para o bucket privado
 * `financeiro-comprovantes` em `<correspondente>/<pasta do módulo>/<id>-<nome>` (a política
 * do storage confere a pasta e a permissão do módulo) e depois é registrado no banco
 * (fin_anexo_registrar), que confere de novo e liga ao lançamento. Abrir = link
 * temporário de 5 minutos, só para quem vê o módulo.
 */
import { supabase } from "@/integrations/supabase/client";
import { getMinhaSessao } from "@/lib/session.functions";
import { nomeArquivoSeguro } from "@/lib/storage/nome-arquivo";
import { executarOuFalhar } from "@/lib/financeiro/cliente";

export type PastaFinanceiro = "comissoes-bancos" | "repasses" | "comissoes" | "contas-pagar" | "contas-receber" | "conciliacao";

const LIMITE = 15 * 1024 * 1024;
const BUCKET = "financeiro-comprovantes";

let corrCache: string | null = null;

async function correspondente(): Promise<string> {
  if (corrCache) return corrCache;
  const s = await getMinhaSessao();
  const c = s?.profile?.correspondente_id;
  if (!c) throw new Error("Correspondente não identificado.");
  corrCache = c;
  return c;
}

export async function enviarAnexo(
  arquivo: File,
  pasta: PastaFinanceiro,
  entidade: string,
  entidadeId: string | null = null,
): Promise<string> {
  if (arquivo.size > LIMITE) throw new Error("Arquivo acima de 15 MB.");
  const corr = await correspondente();
  const caminho = `${corr}/${pasta}/${crypto.randomUUID()}-${nomeArquivoSeguro(arquivo.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { upsert: false });
  if (error) throw new Error("Não foi possível enviar o arquivo.");
  return executarOuFalhar<string>("anexo", {
    _pasta: pasta,
    _entidade: entidade,
    _entidade_id: entidadeId,
    _caminho: caminho,
    _nome: arquivo.name.slice(0, 200),
    _tipo: arquivo.type || null,
    _tamanho: arquivo.size,
  });
}

/** Abre a aba antes do await (o celular bloqueia pop-up depois dele). */
export async function abrirAnexo(caminho: string): Promise<void> {
  const aba = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 300);
  if (error || !data?.signedUrl) {
    aba?.close();
    throw new Error("Não foi possível abrir o arquivo.");
  }
  if (aba) aba.location.href = data.signedUrl;
  else window.location.assign(data.signedUrl);
}

/** Arquivo → base64 (leitura de boleto em PDF no servidor). */
export function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => falha(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(arquivo);
  });
}

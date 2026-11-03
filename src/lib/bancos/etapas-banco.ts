/**
 * Regras de etapa que variam por banco.
 *
 * Cada banco conduz a proposta do seu jeito, e o Agilliza mostra a régua de
 * cada um com o nome que aparece no portal dele:
 *
 * - Itaú: entre o crédito e o envio de documentos, o portal pede o
 *   preenchimento dos "Formulários Digitais".
 * - Santander: a Análise Técnica começa pelo "Cadastro das Informações",
 *   antes do "Envio de Documentos".
 * - Bradesco: não tem essa etapa — do crédito vai direto aos documentos.
 *   Até o laudo o andamento volta pela HomeFin; depois, o robô lê o portal do
 *   BPO do Bradesco (Índice) e grava na mesma régua.
 *
 * O status interno é o mesmo para os dois (`formularios`); só o nome muda.
 * Mapeado nos portais em 24/09/2026. O robô dos portais usa os mesmos nomes
 * (automacao-portal-banco/app/agiliza/etapas.py) — mudou aqui, muda lá.
 *
 * Módulo puro: servidor e tela.
 */

export type ChaveBanco = "itau" | "santander" | "bradesco";

/** "Itaú", "BANCO ITAU S.A.", "santander" → chave do banco; `null` se outro. */
export function chaveDoBanco(nomeBanco: unknown): ChaveBanco | null {
  const n = String(nomeBanco ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (n.includes("itau")) return "itau";
  if (n.includes("santander")) return "santander";
  if (n.includes("bradesco")) return "bradesco";
  return null;
}

/**
 * De onde vem o andamento de cada banco: Itaú e Santander, pelo robô que lê o
 * portal do banco (a HomeFin não move as etapas deles); o Bradesco, pela
 * HomeFin até o laudo e pelo portal do BPO depois; os demais, pela HomeFin.
 */
export function fonteDoAndamento(
  nomeBanco: unknown,
): "homefin" | "portal_banco" | "homefin_e_bpo" {
  const chave = chaveDoBanco(nomeBanco);
  if (chave === "itau" || chave === "santander") return "portal_banco";
  return chave === "bradesco" ? "homefin_e_bpo" : "homefin";
}

/** Nome da etapa de formulários no portal de cada banco que a tem. */
export const ETAPA_FORMULARIOS: Partial<Record<ChaveBanco, string>> = {
  itau: "Formulários Digitais",
  santander: "Cadastro das Informações",
};

/** Rótulo genérico, para quando o banco não é conhecido na tela. */
export const ROTULO_FORMULARIOS_GENERICO = "Formulários do banco";

/** O banco tem a etapa de formulários antes dos documentos? */
export function temEtapaFormularios(nomeBanco: unknown): boolean {
  const chave = chaveDoBanco(nomeBanco);
  return Boolean(chave && ETAPA_FORMULARIOS[chave]);
}

/** Nome da etapa de formulários como o banco a chama (ou o genérico). */
export function nomeEtapaFormularios(nomeBanco: unknown): string {
  const chave = chaveDoBanco(nomeBanco);
  return (chave && ETAPA_FORMULARIOS[chave]) || ROTULO_FORMULARIOS_GENERICO;
}

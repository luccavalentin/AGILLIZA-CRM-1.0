/**
 * Mensagem de erro em português para a tela.
 *
 * O padrão espalhado pelo sistema era `e instanceof Error ? e.message : "..."`.
 * Quando a falha é de rede, `e.message` é a string crua do navegador — o
 * usuário via "Failed to fetch" no meio da operação e não tinha como saber que
 * aquilo era queda de conexão, e não recusa do banco.
 *
 * Só traduz o que é ruído técnico. Mensagem de negócio (recusa do banco,
 * validação, regra de prazo) passa intacta: ela é a informação útil.
 */

import { semMarcaIntegracao } from "@/lib/texto/sem-marca-integracao";

/** Falhas de camada de rede, em todos os navegadores que usamos. */
const RUIDO_DE_REDE = [
  "failed to fetch",
  "networkerror",
  "network error",
  "load failed",
  "the internet connection appears to be offline",
  "err_internet_disconnected",
  "err_network_changed",
  "connection closed",
  "fetch failed",
];

const MSG_REDE =
  "Sem conexão com o servidor. Verifique a internet e tente de novo — nada foi perdido.";

const MSG_VERSAO = "O sistema acabou de ser atualizado. Atualizando a página…";

const MSG_TEMPO ="O servidor demorou demais para responder. Tente de novo em alguns instantes.";

export function mensagemDeErro(e: unknown, alternativa: string): string {
  // PostgrestError e StorageError do Supabase não são `Error`: chegam como objeto com `message`.
  const msg = (e as { message?: unknown } | null)?.message;
  const bruta = typeof e === "string" ? e : typeof msg === "string" ? msg : "";
  const texto = bruta.trim();
  if (!texto) return alternativa;

  const minuscula = texto.toLowerCase();
  // Página HTML no lugar da resposta: quase sempre é a aba aberta antes de uma
  // atualização chamando uma função que a versão nova não tem mais. Nunca
  // mostrar código na tela — e avisar o app para buscar a versão nova.
  if (
    minuscula.startsWith("<!doctype") ||
    minuscula.startsWith("<html") ||
    minuscula.includes("</html>") ||
    minuscula.includes("server function info not found")
  ) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("agilliza:versao-antiga"));
    return MSG_VERSAO;
  }
  if (RUIDO_DE_REDE.some((t) => minuscula.includes(t))) return MSG_REDE;
  if (minuscula.includes("timeout") || minuscula.includes("aborted")) return MSG_TEMPO;

  return semMarcaIntegracao(deValidacao(texto) ?? doBanco(texto) ?? texto);
}

/** "data_pagamento" → "Data pagamento". */
function rotuloCampo(caminho: unknown): string {
  const ultimo = Array.isArray(caminho) ? String(caminho[caminho.length - 1] ?? "") : "";
  const r = ultimo.replace(/_/g, " ").trim();
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : "Campo";
}

/**
 * Falha de validação do servidor (Zod) chega como o JSON da lista de problemas:
 * `[{"code":"too_big","maximum":31,...}]`. Vira uma frase por campo.
 */
function deValidacao(texto: string): string | null {
  if (!texto.startsWith("[")) return null;
  let problemas: any[];
  try {
    problemas = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!Array.isArray(problemas) || !problemas.length || !problemas[0]?.code) return null;
  const frases = problemas.slice(0, 3).map((p) => {
    const campo = rotuloCampo(p.path);
    // Mensagem própria do schema (escrita em português) vale mais que a genérica do Zod.
    const propria = typeof p.message === "string" ? p.message.trim() : "";
    if (propria && !/^(number|string|array|invalid|expected|required|too (small|big)|must|value)\b/i.test(propria)) {
      return propria;
    }
    switch (p.code) {
      case "too_big":
        return p.maximum !== undefined ? `${campo}: o máximo é ${p.maximum}.` : `${campo}: valor alto demais.`;
      case "too_small":
        return p.minimum === 1 && (p.origin === "string" || p.type === "string")
          ? `${campo}: preenchimento obrigatório.`
          : p.minimum !== undefined
            ? `${campo}: o mínimo é ${p.minimum}.`
            : `${campo}: valor baixo demais.`;
      case "invalid_type":
        return `${campo}: preenchimento obrigatório ou inválido.`;
      case "invalid_format":
      case "invalid_string":
        return `${campo}: formato inválido.`;
      case "invalid_value":
      case "invalid_enum_value":
        return `${campo}: opção inválida.`;
      default:
        return `${campo}: valor inválido.`;
    }
  });
  return frases.join(" ");
}

/** Erros do PostgreSQL que chegam crus pela API. */
function doBanco(texto: string): string | null {
  const t = texto.toLowerCase();
  if (t.includes("invalid input syntax for type date") || t.includes("date/time field value out of range"))
    return "Data inválida ou não informada.";
  if (t.includes("invalid input syntax for type numeric") || t.includes("invalid input syntax for type integer"))
    return "Número inválido ou não informado.";
  if (t.includes("duplicate key value violates unique constraint"))
    return "Já existe um registro com esses dados.";
  if (t.includes("violates foreign key constraint"))
    return "Este registro está ligado a outros dados e não pode ser alterado ou excluído assim.";
  const nulo = texto.match(/null value in column "([^"]+)"/i);
  if (nulo) return `${rotuloCampo([nulo[1]])}: preenchimento obrigatório.`;
  if (t.includes("violates check constraint")) return "Valor não permitido para este campo.";
  return null;
}

/**
 * Cancelamento de consulta/requisição — não é falha para o usuário.
 *
 * O React Query cancela a busca em andamento quando a tela troca ou quando
 * outra busca da mesma chave começa; o erro chega com `message:
 * "CancelledError"` e virava um toast vermelho escrito "CancelledError" no
 * meio do envio da proposta (visto em 21/09/2026). Nada falhou: quem cancelou
 * fomos nós.
 */
export function ehCancelamento(e: unknown): boolean {
  const nome = String((e as any)?.name ?? "").toLowerCase();
  const msg = String((e as any)?.message ?? "").toLowerCase();
  return (
    nome === "cancellederror" ||
    nome === "aborterror" ||
    msg === "cancellederror" ||
    msg.includes("the operation was aborted") ||
    msg.includes("signal is aborted")
  );
}

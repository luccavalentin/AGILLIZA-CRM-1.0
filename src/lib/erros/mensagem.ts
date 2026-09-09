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

const MSG_TEMPO = "O servidor demorou demais para responder. Tente de novo em alguns instantes.";

export function mensagemDeErro(e: unknown, alternativa: string): string {
  const bruta = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const texto = bruta.trim();
  if (!texto) return alternativa;

  const minuscula = texto.toLowerCase();
  if (RUIDO_DE_REDE.some((t) => minuscula.includes(t))) return MSG_REDE;
  if (minuscula.includes("timeout") || minuscula.includes("aborted")) return MSG_TEMPO;

  return texto;
}

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

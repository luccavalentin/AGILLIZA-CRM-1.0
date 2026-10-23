/**
 * Erros do Agilliza → Gestão de Tecnologia (migração 0233 do Corretor).
 *
 * Funções puras (navegador e servidor) para resumir um erro SEM dado pessoal antes de ele
 * sair de onde aconteceu. O banco limpa de novo (`plataforma._limpar_texto_erro`) e agrupa
 * por impressão digital (mensagem normalizada + 1ª linha da pilha).
 * O Corretor usa as mesmas regras em `apps/web/src/lib/erros-cliente.ts`.
 */

/** Aba aberta antes de uma publicação: não é defeito, a própria tela recarrega. */
export const SINAIS_VERSAO_ANTIGA =
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module|Loading CSS chunk|server function info not found/i;

/** Ruído que não é defeito nosso (extensões, aviso benigno, erro opaco de outra origem, rede). */
export const RUIDO =
  /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-(web-)?extension:|AbortError|The user aborted a request|Failed to fetch$|NetworkError when attempting|Load failed$/i;

/** Texto sem dado pessoal: e-mail, id, query string, texto entre aspas duplas, token, telefone e número longo. */
export function limparTexto(texto: string, max = 300): string {
  return (texto ?? "")
    .slice(0, 4000)
    .replace(/\p{Cc}+/gu, " ")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\?[^\s'"():]*/g, "")
    .replace(/"[^"]{1,200}"/g, '"…"')
    .replace(/[A-Za-z0-9_-]{24,}/g, "<x>")
    .replace(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, "<tel>")
    .replace(/\d(?:[-\d./]*\d){3,}/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Primeira linha da pilha que diz onde quebrou (Chrome/Node: "at …"; Safari/Firefox: "fn@url"). */
export function linhaDaPilha(pilha: string | undefined | null): string {
  if (!pilha) return "";
  const linha = pilha
    .slice(0, 4000)
    .split("\n")
    .find((l) => /^\s*at |@/.test(l));
  return linha ? limparTexto(linha.replace(/https?:\/\/[^/\s]+/g, ""), 200) : "";
}

/** Caminho sem dado: id → `:id`, número → `:n`, segmento com cara de token → `:x`. */
export function rotaSemDado(caminho: string): string {
  const semOrigem = (caminho ?? "").replace(/^[a-z]+:\/\/[^/]+/i, "");
  const partes = (semOrigem.split(/[?#]/)[0] ?? "")
    .split("/")
    .filter(Boolean)
    .slice(0, 8)
    .map((p) => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p)) return ":id";
      if (/^\d+$/.test(p) || /\d{5,}/.test(p)) return ":n";
      if (p.length > 40 || /^[A-Za-z0-9_-]{24,}$/.test(p)) return ":x";
      return /^[a-z0-9._-]+$/i.test(p) ? p.toLowerCase() : ":x";
    });
  return `/${partes.join("/")}`.slice(0, 160);
}

/** Família e versão principal do navegador ("Chrome 129") e o sistema ("Android"). */
export function resumirNavegador(ua: string): {
  navegador: string | null;
  sistemaOp: string | null;
} {
  const u = ua ?? "";
  const achar = (re: RegExp, nome: string) => {
    const m = u.match(re);
    return m ? `${nome} ${m[1]}` : null;
  };
  const navegador =
    achar(/EdgA?\/(\d+)/, "Edge") ??
    achar(/SamsungBrowser\/(\d+)/, "Samsung") ??
    achar(/OPR\/(\d+)/, "Opera") ??
    achar(/Firefox\/(\d+)/, "Firefox") ??
    achar(/CriOS\/(\d+)/, "Chrome") ??
    achar(/Chrome\/(\d+)/, "Chrome") ??
    (/Safari\//.test(u) ? achar(/Version\/(\d+)/, "Safari") : null);
  const sistemaOp = /Android/.test(u)
    ? "Android"
    : /iPhone|iPad|iPod/.test(u)
      ? "iOS"
      : /Windows/.test(u)
        ? "Windows"
        : /Mac OS X/.test(u)
          ? "macOS"
          : /Linux/.test(u)
            ? "Linux"
            : null;
  return { navegador, sistemaOp };
}

/** Perfil de quem viu o erro, pela área do sistema (o servidor não confia no navegador para isso). */
export function perfilDaRota(rota: string): "cliente" | "parceiro" | "equipe" | "anonimo" {
  if (/^\/cliente(\/|$|[.-])/.test(rota)) return "cliente";
  if (/^\/parceiro(\/|$|[.-])/.test(rota)) return "parceiro";
  if (rota === "/" || /^\/(auth|portal|politica|cliente-consentimento)/.test(rota))
    return "anonimo";
  return "equipe";
}

export interface ErroResumido {
  mensagem: string;
  pilha: string;
  tipo: string | null;
  rota: string;
}

/** Erro qualquer → resumo enviável; `null` quando é ruído ou versão antiga. */
export function resumirErro(erro: unknown, caminho: string): ErroResumido | null {
  const e = erro as { name?: unknown; message?: unknown; stack?: unknown } | null;
  const bruto =
    e && typeof e === "object" && "message" in e ? String(e.message ?? "") : String(erro ?? "");
  const tipo =
    typeof e?.name === "string" && /^[A-Za-z][A-Za-z0-9_.$]{0,59}$/.test(e.name) ? e.name : null;
  if (!bruto.trim() || SINAIS_VERSAO_ANTIGA.test(bruto) || RUIDO.test(bruto.trim())) return null;
  const pilha = typeof e?.stack === "string" ? e.stack : "";
  if (/chrome-extension:|moz-extension:|safari-(web-)?extension:/.test(pilha)) return null;
  const mensagem = limparTexto(bruto);
  if (!mensagem) return null;
  return { mensagem, pilha: linhaDaPilha(pilha), tipo, rota: rotaSemDado(caminho) };
}

/**
 * Freio local: o mesmo erro no máximo 1× a cada 5 min; até `semAmostraAte` envios seguidos,
 * depois só uma fração (`amostra`) dos erros novos; nunca mais que `tetoPorHora`.
 * `sortear` é injetável para teste.
 */
export function criarFreio(
  opcoes: {
    dedupMs?: number;
    tetoPorHora?: number;
    semAmostraAte?: number;
    amostra?: number;
    sortear?: () => number;
  } = {},
) {
  const dedupMs = opcoes.dedupMs ?? 5 * 60_000;
  const teto = opcoes.tetoPorHora ?? 20;
  const semAmostra = opcoes.semAmostraAte ?? 5;
  const amostra = opcoes.amostra ?? 0.25;
  const sortear = opcoes.sortear ?? Math.random;
  const enviados = new Map<string, number>();
  let historico: number[] = [];
  return (chave: string, agora = Date.now()): boolean => {
    const ultimo = enviados.get(chave);
    if (ultimo !== undefined && agora - ultimo < dedupMs) return false;
    historico = historico.filter((t) => agora - t < 3_600_000);
    if (historico.length >= teto) return false;
    if (ultimo === undefined && historico.length >= semAmostra && sortear() >= amostra)
      return false;
    if (enviados.size > 500) enviados.clear();
    enviados.set(chave, agora);
    historico.push(agora);
    return true;
  };
}

// ---------------------------------------------------------------------------
// Envio a partir do navegador
// ---------------------------------------------------------------------------

let freioNavegador: ReturnType<typeof criarFreio> | null = null;

/** Manda um erro da tela para `/api/erros`. Nunca lança. */
export function registrarErroNaTela(erro: unknown): void {
  try {
    if (typeof window === "undefined") return;
    const r = resumirErro(erro, window.location.pathname);
    if (!r) return;
    freioNavegador ??= criarFreio();
    if (!freioNavegador(`${r.tipo}|${r.mensagem}|${r.pilha}`)) return;
    const { navegador, sistemaOp } = resumirNavegador(navigator.userAgent);
    void fetch("/api/erros", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...r, navegador, sistemaOp }),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    // Quem reporta erro não pode virar um segundo erro.
  }
}

/** Liga a captura de `error` e `unhandledrejection` na janela. Devolve o desligar. */
export function instalarCapturaDeErros(): () => void {
  if (typeof window === "undefined") return () => {};
  const aoErro = (ev: ErrorEvent) => registrarErroNaTela(ev.error ?? ev.message);
  const aoRejeitar = (ev: PromiseRejectionEvent) => registrarErroNaTela(ev.reason);
  window.addEventListener("error", aoErro);
  window.addEventListener("unhandledrejection", aoRejeitar);
  return () => {
    window.removeEventListener("error", aoErro);
    window.removeEventListener("unhandledrejection", aoRejeitar);
  };
}

/**
 * Volta do link de "Esqueci minha senha" (navegador).
 *
 * O link do e-mail passa pelo Auth (`/auth/v1/verify`), que abre uma sessão e devolve a pessoa
 * para `/auth?recuperar=1#access_token=…&type=recovery`. O supabase-js guarda a sessão e emite
 * `PASSWORD_RECOVERY`; a tela de login mostra então o formulário de senha nova.
 */

/** Métodos de entrada que só um link do e-mail produz (a senha produz "password"). */
const METODOS_DE_LINK = new Set(["otp", "recovery", "magiclink"]);

/** Uma hora: depois disso a sessão aberta pelo link não serve para trocar a senha por aqui. */
const JANELA_S = 60 * 60;

function decodificarBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  // UTF-8 (o token pode ter nome com acento).
  return decodeURIComponent(
    Array.from(bin, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
  );
}

/**
 * A sessão foi aberta AGORA por um link do e-mail (e não pela senha)? Lê o `amr` do token —
 * só para decidir o que a TELA mostra; quem garante a troca é o Auth.
 */
export function sessaoDeRecuperacao(
  accessToken: string | null | undefined,
  agoraMs: number = Date.now(),
): boolean {
  if (!accessToken) return false;
  try {
    const corpo = accessToken.split(".")[1];
    if (!corpo) return false;
    const claims = JSON.parse(decodificarBase64Url(corpo)) as {
      amr?: { method?: unknown; timestamp?: unknown }[];
    };
    if (!Array.isArray(claims.amr)) return false;
    const agora = agoraMs / 1000;
    return claims.amr.some(
      (a) =>
        typeof a?.method === "string" &&
        METODOS_DE_LINK.has(a.method) &&
        typeof a.timestamp === "number" &&
        agora - a.timestamp < JANELA_S &&
        a.timestamp - agora < 300,
    );
  } catch {
    return false;
  }
}

/** A URL é a volta do link de recuperação (`?recuperar=1`, com ou sem erro no `#`)? */
export function voltouDoLinkDeRecuperacao(search: string): boolean {
  return new URLSearchParams(search).get("recuperar") === "1";
}

/**
 * Regra da senha nova — a mesma da tela Segurança: 8+ caracteres com letra e número,
 * diferente do e-mail, e a confirmação igual. Devolve a frase do problema ou `null`.
 */
export function problemaDaSenhaNova(nova: string, confirma: string, email: string): string | null {
  if (nova.length < 8 || !/[A-Za-z]/.test(nova) || !/\d/.test(nova)) {
    return "Use pelo menos 8 caracteres, com letras e números.";
  }
  if (email && nova.trim().toLowerCase() === email.trim().toLowerCase()) {
    return "A nova senha não pode ser o seu e-mail.";
  }
  if (nova !== confirma) return "As senhas não coincidem.";
  return null;
}

export const LINK_DE_RECUPERACAO_INVALIDO =
  "Este link de recuperação não vale mais (já foi usado ou venceu). Peça outro em “Esqueci minha senha”.";

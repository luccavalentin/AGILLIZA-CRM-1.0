// Sessao selada do App do Cliente (cookie HttpOnly assinado com HMAC).
// NAO usa Supabase Auth — isolamento total do sistema interno.
import { createHmac, timingSafeEqual } from "node:crypto";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

const COOKIE_NAME = "agz_cliente_app";
const TTL_MS = 8 * 60 * 60 * 1000; // 8h
const COOKIE_SCOPE = "HttpOnly; Secure; SameSite=None; Partitioned; Path=/";

export interface ClienteSession {
  cid: string; // cliente_id
  corr: string | null; // correspondente_id
  exp: number; // epoch ms
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function getSecret(): string {
  const secret = process.env.CLIENTE_APP_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CLIENTE_APP_SESSION_SECRET ausente ou muito curto.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function selarSessao(cid: string, corr: string | null): string {
  const data: ClienteSession = { cid, corr, exp: Date.now() + TTL_MS };
  const payload = b64url(JSON.stringify(data));
  return `${payload}.${sign(payload)}`;
}

function abrirSessao(token: string | undefined): ClienteSession | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as ClienteSession;
    if (!data.cid || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function lerCookie(nome: string): string | undefined {
  const header = getRequest()?.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === nome) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function garantirHttps(): void {
  // O cookie usa `Secure; SameSite=None; Partitioned`, então navegadores
  // rejeitam silenciosamente em conexões http://. Falhar cedo, com mensagem
  // clara, é muito melhor do que loop de login sem feedback (bug clássico
  // em custom domains mal configurados).
  const req = getRequest();
  const h = req?.headers;
  const proto = h?.get("x-forwarded-proto") ?? (req?.url?.startsWith("https://") ? "https" : null);
  const host = h?.get("host") ?? "";
  // Preview local do dev-server sempre acessa via https na Lovable; libera
  // apenas 127.0.0.1/localhost para permitir testes explícitos em http.
  const ehLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (proto !== "https" && !ehLocal) {
    throw new Response(
      "Portal do Cliente exige HTTPS. Verifique o certificado do domínio.",
      { status: 400 },
    );
  }
}

export function gravarCookieSessao(cid: string, corr: string | null): void {
  garantirHttps();
  const token = selarSessao(cid, corr);
  const maxAge = Math.floor(TTL_MS / 1000);
  setResponseHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; ${COOKIE_SCOPE}; Max-Age=${maxAge}`,
  );
}

export function limparCookieSessao(): void {
  setResponseHeader("Set-Cookie", `${COOKIE_NAME}=; ${COOKIE_SCOPE}; Max-Age=0`);
}

/** Retorna a sessao do cookie ou null. Nunca aceita cliente_id do body. */
export function lerSessaoCliente(): ClienteSession | null {
  return abrirSessao(lerCookie(COOKIE_NAME));
}

/** Exige sessao valida; lanca 401 caso contrario. */
export function requireClienteSession(): ClienteSession {
  const sess = lerSessaoCliente();
  if (!sess) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return sess;
}

export function dadosRequisicao(): { ip: string | null; userAgent: string | null } {
  const req = getRequest();
  const h = req?.headers;
  return {
    ip: h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h?.get("cf-connecting-ip") ?? null,
    userAgent: h?.get("user-agent") ?? null,
  };
}

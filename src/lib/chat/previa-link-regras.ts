/**
 * Regras puras da prévia de link do chat (sem rede, testáveis): que endereço pode ser
 * visitado pelo servidor e como ler título e descrição do HTML.
 *
 * A prévia é buscada pelo SERVIDOR (o navegador de quem lê não visita site de terceiro só
 * por abrir a conversa). Por isso as travas contra SSRF: só http/https, sem usuário/senha na
 * URL, só portas 80/443, nada de nome interno e — conferido no momento da conexão — nenhum
 * IP privado, de loopback, link-local, CGNAT, multicast ou reservado (IPv4 e IPv6, inclusive
 * IPv4 embutido em IPv6).
 */
import { isIP } from "node:net";

export function ipPrivado(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    const [a, b] = [p[0]!, p[1]!];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (p[2] === 0 || p[2] === 2)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && p[2] === 100) ||
      (a === 203 && b === 0 && p[2] === 113) ||
      a >= 224
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x) ?? /^::(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapeado) return ipPrivado(mapeado[1]!);
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(x)) {
      // ::ffff:7f00:1 = 127.0.0.1 em hexadecimal.
      const [h1, h2] = x
        .slice(7)
        .split(":")
        .map((h) => parseInt(h, 16));
      return ipPrivado(`${h1! >> 8}.${h1! & 255}.${h2! >> 8}.${h2! & 255}`);
    }
    return /^(fc|fd|fe8|fe9|fea|feb|ff|2001:db8|2001:0db8|64:ff9b|100::)/.test(x);
  }
  return true;
}

/** A URL pode ser buscada pelo servidor? (o IP é conferido de novo na conexão). */
export function urlPermitida(bruta: string): URL | null {
  let u: URL;
  try {
    u = new URL(bruta);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(host)
  )
    return null;
  if (!host.includes(".") && !isIP(host)) return null;
  if (isIP(host) && ipPrivado(host)) return null;
  if (bruta.length > 2000) return null;
  return u;
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodificar(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n =
          e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 31 && n < 0x10ffff ? String.fromCodePoint(n) : "";
      }
      return ENTIDADES[e.toLowerCase()] ?? m;
    })
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, nomes: string[]): string | null {
  for (const n of nomes) {
    const re = new RegExp(
      `<meta\\b[^>]*?(?:property|name)\\s*=\\s*["']${n.replace(/[.:]/g, "\\$&")}["'][^>]*>`,
      "i",
    );
    const tag = re.exec(html)?.[0];
    const conteudo = tag ? /content\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag) : null;
    const v = conteudo ? (conteudo[2] ?? conteudo[3] ?? "") : "";
    if (v.trim()) return decodificar(v);
  }
  return null;
}

/** Título e descrição da página (Open Graph, Twitter ou <title>/description). */
export function extrairPrevia(
  html: string,
  url: URL,
): { url: string; dominio: string; titulo: string | null; descricao: string | null } {
  const cabeca = html.slice(0, 200_000);
  const titulo =
    meta(cabeca, ["og:title", "twitter:title"]) ??
    (() => {
      const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(cabeca)?.[1];
      return t ? decodificar(t) : null;
    })();
  const descricao = meta(cabeca, ["og:description", "twitter:description", "description"]);
  return {
    url: url.toString(),
    dominio: url.hostname.replace(/^www\./, ""),
    titulo: titulo ? titulo.slice(0, 140) : null,
    descricao: descricao ? descricao.slice(0, 240) : null,
  };
}

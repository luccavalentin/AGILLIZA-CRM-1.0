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
    // eco-aud: pelos 128 bits, não por texto. Antes "[::127.0.0.1]" (normalizado para ::7f00:1),
    // fec0::/10, 6to4 (2002::/16) e Teredo passavam. Só unicast global (2000::/3) é público,
    // e o IPv4 embutido (::/96, ::ffff:0:0/96, 6to4) é conferido.
    const h = hextetos(ip);
    if (!h) return true;
    const ipv4 = (a: number, b: number) => `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
    if (h.slice(0, 5).every((n) => n === 0) && (h[5] === 0 || h[5] === 0xffff)) {
      if (h[5] === 0 && h[6] === 0) return true; // ::, ::1 e o resto de ::/112
      return ipPrivado(ipv4(h[6]!, h[7]!));
    }
    if (h[0] === 0x2002) return ipPrivado(ipv4(h[1]!, h[2]!)); // 6to4
    if ((h[0]! & 0xe000) !== 0x2000) return true; // fora de 2000::/3: ULA, link/site-local, multicast, NAT64…
    if (h[0] === 0x2001 && (h[1] === 0 || h[1] === 0xdb8 || h[1]! < 0x200)) return true; // Teredo, documentação, IETF
    return false;
  }
  return true;
}

/** Os 8 grupos de 16 bits de um IPv6 (aceita "::" e IPv4 no fim), ou null. */
function hextetos(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0]!;
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number) as [number, number, number, number];
    s = s.slice(0, v4.index) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const partes = s.split("::");
  if (partes.length > 2) return null;
  const esq = partes[0] ? partes[0].split(":") : [];
  const dir = partes.length === 2 && partes[1] ? partes[1].split(":") : [];
  const faltam = 8 - esq.length - dir.length;
  if (partes.length === 1 ? faltam !== 0 : faltam < 1) return null;
  const todos = [...esq, ...Array(partes.length === 2 ? faltam : 0).fill("0"), ...dir];
  const n = todos.map((x) => (/^[0-9a-f]{1,4}$/.test(x) ? parseInt(x, 16) : NaN));
  return n.length === 8 && n.every((x) => Number.isInteger(x)) ? n : null;
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

/* ------------------------------------------------------------------------------------------
 * Auditoria rodada 2 (26/10/2026): prazo TOTAL e limite por pessoa.
 *
 * O `timeout` do http é de OCIOSIDADE: um site que pinga 1 byte a cada 3 s ("slowloris")
 * prendia a busca por minutos, e 3 redirecionamentos somavam 4 prazos. E qualquer pessoa
 * disparava buscas sem limite (o servidor visita o site em nome dela). Agora a busca inteira
 * (DNS, redirecionamentos, corpo) tem UM prazo, e a busca que não está no cache passa antes
 * pelo limite da pessoa (`antesDeBuscar`: no banco, `chat.limite_previa_link()`).
 * ---------------------------------------------------------------------------------------- */

export type PreviaDaPagina = ReturnType<typeof extrairPrevia>;
export type Baixado = { status: number; local?: string; tipo: string; corpo: string };
/** Baixa UMA URL e tem que desistir sozinho em `prazo` (epoch ms). */
export type Baixador = (u: URL, prazo: number) => Promise<Baixado>;

/** Prazo da busca inteira (todos os saltos e o corpo). */
export const PRAZO_TOTAL_MS = 6000;

/** Arma o prazo total numa requisição: no prazo ela é destruída, esteja onde estiver. */
export function armarPrazo(
  req: { destroy(e?: Error): unknown; once(ev: "close", f: () => void): unknown },
  prazo: number,
): void {
  const restante = prazo - Date.now();
  if (restante <= 0) {
    req.destroy(new Error("Tempo total esgotado."));
    return;
  }
  const relogio = setTimeout(() => req.destroy(new Error("Tempo total esgotado.")), restante);
  req.once("close", () => clearTimeout(relogio));
}

export function criarBuscadorDePrevia(opcoes: {
  baixar: Baixador;
  prazoTotalMs?: number;
  validadeMs?: number;
  maxCache?: number;
}) {
  const cache = new Map<string, { em: number; valor: PreviaDaPagina | null }>();
  const prazoTotal = opcoes.prazoTotalMs ?? PRAZO_TOTAL_MS;
  const validade = opcoes.validadeMs ?? 6 * 3600_000;
  const maxCache = opcoes.maxCache ?? 300;
  /** `antesDeBuscar` (limite por pessoa) só roda quando a página não está no cache; se lançar, não busca. */
  return async function buscar(
    bruta: string,
    antesDeBuscar?: () => Promise<unknown>,
  ): Promise<PreviaDaPagina | null> {
    const inicial = urlPermitida(bruta);
    if (!inicial) return null;
    const chave = inicial.toString();
    const em = cache.get(chave);
    if (em && Date.now() - em.em < validade) return em.valor;
    if (antesDeBuscar) await antesDeBuscar();
    const prazo = Date.now() + prazoTotal;
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const esgotou = new Promise<never>((_, rejeitar) => {
      relogio = setTimeout(() => rejeitar(new Error("Tempo total esgotado.")), prazoTotal);
    });
    let valor: PreviaDaPagina | null = null;
    try {
      let u: URL | null = inicial;
      for (let i = 0; i < 4 && u; i++) {
        // O próprio baixador desiste no prazo; a corrida garante mesmo se ele não desistir.
        const r: Baixado = await Promise.race([opcoes.baixar(u, prazo), esgotou]);
        if (r.local) {
          u = urlPermitida(new URL(r.local, u).toString());
          continue;
        }
        if (r.status >= 200 && r.status < 300 && r.corpo) valor = extrairPrevia(r.corpo, u);
        break;
      }
    } catch {
      valor = null;
    } finally {
      clearTimeout(relogio);
    }
    if (cache.size >= maxCache) cache.delete(cache.keys().next().value!);
    cache.set(chave, { em: Date.now(), valor });
    return valor;
  };
}

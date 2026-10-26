/**
 * Pré-visualização de link para a Agilliza News (C60) — SÓ SERVIDOR.
 *
 * A curadoria cola o endereço de uma matéria e o servidor busca título, descrição, imagem
 * e nome do veículo (Open Graph / Twitter / <title>). O endereço vem de fora, então a busca
 * não pode virar porta para a rede interna (SSRF):
 *   · só http/https, portas 80/443, sem usuário/senha, sem IP escrito no lugar do nome,
 *     sem sufixo local (localhost, .internal, .local…);
 *   · o nome é resolvido AQUI e TODOS os endereços precisam ser públicos (nada de 10.x,
 *     127.x, 169.254.x — metadados da nuvem —, 192.168.x, ::1, fc00::/7…); a conexão vai
 *     para o IP conferido (sem segunda consulta ao DNS: DNS rebinding);
 *   · redirecionamento seguido à mão (até 3), cada destino conferido de novo;
 *   · tempo máximo total e tamanho máximo lido (só o começo da página importa).
 * A imagem não é baixada: guardamos o ENDEREÇO (https), como qualquer cartão de link.
 */
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import http from "node:http";
import https from "node:https";

export class RecusaLink extends Error {}

export interface Previa {
  url: string;
  titulo: string | null;
  descricao: string | null;
  imagem_url: string | null;
  veiculo: string | null;
}

/* --------------------------------------------------------------- endereços --- */

function v4Num(ip: string) {
  return ip.split(".").reduce((n, p) => (n << 8) + Number(p), 0) >>> 0;
}
const FAIXAS_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
function v4Proibido(ip: string) {
  const n = v4Num(ip);
  return FAIXAS_V4.some(([b, bits]) => {
    const m = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & m) === (v4Num(b) & m);
  });
}
function gruposV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0]!;
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = v4Num(v4[1]!);
    s = s.slice(0, -v4[1]!.length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [a0, b0] = s.split("::");
  const a = a0 ? a0.split(":") : [];
  const b = b0 !== undefined ? (b0 ? b0.split(":") : []) : [];
  if (s.includes("::")) {
    const falta = 8 - a.length - b.length;
    if (falta < 0) return null;
    return [...a, ...Array(falta).fill("0"), ...b].map((x) => parseInt(x || "0", 16));
  }
  return a.length === 8 ? a.map((x) => parseInt(x, 16)) : null;
}
function v6Proibido(ip: string) {
  const g = gruposV6(ip);
  if (!g || g.some((x) => Number.isNaN(x) || x < 0 || x > 0xffff)) return true;
  if (g.every((x) => x === 0)) return true;
  const v4 = `${g[6]! >> 8}.${g[6]! & 255}.${g[7]! >> 8}.${g[7]! & 255}`;
  if (g.slice(0, 4).every((x) => x === 0)) {
    if (g[4] === 0 && (g[5] === 0xffff || g[5] === 0)) return v4Proibido(v4);
    return true;
  }
  if (g[0] === 0x64 && g[1] === 0xff9b) return v4Proibido(v4);
  const p = g[0]!;
  if ((p & 0xe000) !== 0x2000) return true; // fora de 2000::/3
  if (p === 0x2001 && g[1] === 0x0db8) return true;
  if (p === 0x2002) return v4Proibido(`${g[1]! >> 8}.${g[1]! & 255}.${g[2]! >> 8}.${g[2]! & 255}`);
  if (p === 0x2001 && g[1]! < 0x0200) return true;
  return false;
}

/** O endereço é da internet pública? (qualquer dúvida é "não") */
export function enderecoPublico(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return !v4Proibido(ip);
  if (v === 6) return !v6Proibido(ip);
  return false;
}

const SUFIXOS_LOCAIS =
  /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa|arpa|test|invalid|example)$/i;

/** Regras da URL antes de qualquer rede. */
export function conferirUrl(texto: string): URL {
  let u: URL;
  try {
    u = new URL(texto.trim());
  } catch {
    throw new RecusaLink("Endereço inválido.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:")
    throw new RecusaLink("Só endereços http:// ou https:// são aceitos.");
  if (u.username || u.password)
    throw new RecusaLink("Usuário e senha no endereço não são aceitos.");
  if (u.port && u.port !== "80" && u.port !== "443")
    throw new RecusaLink("Só as portas 80 e 443 são aceitas.");
  const host = u.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (isIP(host)) throw new RecusaLink("Use o nome do site, não um IP.");
  if (!host.includes(".") || SUFIXOS_LOCAIS.test(host) || !/\.[a-z]{2,63}$/.test(host))
    throw new RecusaLink("O endereço não é público.");
  return u;
}

export type Resolvedor = (host: string) => Promise<{ address: string; family: number }[]>;
const resolverPadrao: Resolvedor = (host) => lookup(host, { all: true, verbatim: true });

export async function resolverPublico(host: string, resolver: Resolvedor = resolverPadrao) {
  let lista: { address: string; family: number }[];
  try {
    lista = await resolver(host);
  } catch {
    throw new RecusaLink("O site não foi encontrado.");
  }
  if (!lista.length) throw new RecusaLink("O site não foi encontrado.");
  if (lista.some((a) => !enderecoPublico(a.address)))
    throw new RecusaLink("O endereço aponta para a rede interna: recusado.");
  return lista[0]!;
}

/* ------------------------------------------------------------------ leitura --- */

export type Resposta = { status: number; location: string | null; tipo: string; corpo: string };
/** Faz UM pedido para a URL já conferida, conectando no IP já conferido. */
export type Requisitar = (
  u: URL,
  ip: { address: string; family: number },
  o: { tempoMs: number; maxBytes: number },
) => Promise<Resposta>;

const requisitarPadrao: Requisitar = (u, ip, o) =>
  new Promise((ok, falha) => {
    const fixo: LookupFunction = (_h, opcoes, cb) => {
      if ((opcoes as { all?: boolean }).all) cb(null, [ip]);
      else cb(null, ip.address, ip.family);
    };
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(
      u,
      {
        method: "GET",
        lookup: fixo,
        agent: false,
        headers: {
          "user-agent": "AgillizaNews/1.0 (+https://agillizatech.com.br) previa-de-link",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-language": "pt-BR,pt;q=0.9",
        },
        timeout: o.tempoMs,
      },
      (r) => {
        const tipo = String(r.headers["content-type"] ?? "")
          .split(";")[0]!
          .trim()
          .toLowerCase();
        const st = r.statusCode ?? 0;
        if (st >= 300 && st < 400) {
          r.destroy();
          return ok({ status: st, location: r.headers.location ?? null, tipo, corpo: "" });
        }
        const partes: Buffer[] = [];
        let total = 0;
        r.on("data", (b: Buffer) => {
          total += b.length;
          partes.push(b);
          if (total >= o.maxBytes) r.destroy();
        });
        const fim = () =>
          ok({
            status: st,
            location: null,
            tipo,
            corpo: Buffer.concat(partes).subarray(0, o.maxBytes).toString("utf8"),
          });
        r.on("end", fim);
        r.on("close", fim);
        r.on("error", () => falha(new RecusaLink("Não foi possível ler a página.")));
      },
    );
    req.on("timeout", () => req.destroy(new RecusaLink("O site demorou demais para responder.")));
    req.on("error", (e) =>
      falha(e instanceof RecusaLink ? e : new RecusaLink("Não foi possível conectar ao site.")),
    );
    req.end();
  });

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
    .replace(/&#(\d{1,6});/g, (_, n) => {
      const c = Number(n);
      return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : "";
    })
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, n) => {
      const c = parseInt(n, 16);
      return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : "";
    })
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Título, descrição, imagem (https, absoluta) e veículo a partir do HTML. */
export function extrairPrevia(html: string, urlFinal: string): Previa {
  const cabeca = html.slice(0, 300_000);
  const metas = new Map<string, string>();
  for (const m of cabeca.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const chave = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const valor = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (chave && valor && !metas.has(chave)) metas.set(chave, decodificar(valor));
  }
  const titulo =
    metas.get("og:title") ||
    metas.get("twitter:title") ||
    decodificar(/<title[^>]*>([^<]{1,500})<\/title>/i.exec(cabeca)?.[1] ?? "") ||
    null;
  const descricao =
    metas.get("og:description") ||
    metas.get("twitter:description") ||
    metas.get("description") ||
    null;
  let imagem: string | null = null;
  const bruto =
    metas.get("og:image:secure_url") || metas.get("og:image") || metas.get("twitter:image") || null;
  if (bruto) {
    try {
      const u = new URL(bruto, urlFinal);
      if (u.protocol === "https:" && u.toString().length <= 1000) imagem = u.toString();
    } catch {
      imagem = null;
    }
  }
  const veiculo = metas.get("og:site_name") || new URL(urlFinal).hostname.replace(/^www\./, "");
  return {
    url: urlFinal,
    titulo: titulo ? titulo.slice(0, 300) : null,
    descricao: descricao ? descricao.slice(0, 600) : null,
    imagem_url: imagem,
    veiculo: veiculo ? veiculo.slice(0, 120) : null,
  };
}

/** Busca a pré-visualização com todas as travas. */
export async function buscarPrevia(
  endereco: string,
  o: { resolver?: Resolvedor; requisitar?: Requisitar; tempoMs?: number; maxBytes?: number } = {},
): Promise<Previa> {
  const tempoMs = o.tempoMs ?? 6000;
  const maxBytes = o.maxBytes ?? 512 * 1024;
  const prazo = Date.now() + tempoMs;
  let atual = conferirUrl(endereco);
  for (let saltos = 0; ; saltos++) {
    const restante = prazo - Date.now();
    if (restante <= 0) throw new RecusaLink("O site demorou demais para responder.");
    const ip = await resolverPublico(
      atual.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, ""),
      o.resolver,
    );
    const r = await (o.requisitar ?? requisitarPadrao)(atual, ip, { tempoMs: restante, maxBytes });
    if (r.status >= 300 && r.status < 400 && r.location) {
      if (saltos >= 3) throw new RecusaLink("Redirecionamentos demais.");
      atual = conferirUrl(new URL(r.location, atual).toString());
      continue;
    }
    if (r.status !== 200) throw new RecusaLink(`O site respondeu ${r.status}.`);
    if (r.tipo && !/html|xml/.test(r.tipo))
      throw new RecusaLink("O endereço não é uma página (é um arquivo).");
    return extrairPrevia(r.corpo, atual.toString());
  }
}

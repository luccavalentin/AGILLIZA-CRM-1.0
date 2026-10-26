import { lookup as resolverDns } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { extrairPrevia, ipPrivado, urlPermitida } from "./previa-link-regras";

/**
 * Prévia de link do chat, buscada pelo servidor com as travas de `previa-link-regras`.
 *
 * O IP é conferido NA CONEXÃO (função `lookup` própria), não antes: assim um nome que
 * resolve para um IP público na conferência e para 127.0.0.1 na conexão (DNS rebinding)
 * não passa. Até 3 redirecionamentos (cada um conferido de novo), 4 s, 256 KB, só HTML.
 * Resultado (inclusive "sem prévia") fica 6 h num cache em memória de 300 endereços.
 */
export type Previa = {
  url: string;
  dominio: string;
  titulo: string | null;
  descricao: string | null;
};

const cache = new Map<string, { em: number; valor: Previa | null }>();
const VALIDADE_MS = 6 * 3600_000;
const TETO_BYTES = 256 * 1024;

const lookupSeguro: LookupFunction = (host, opcoes, cb) => {
  resolverDns(host, { ...opcoes, all: true }, (erro, enderecos) => {
    if (erro) return cb(erro, "", 4);
    const lista = (
      Array.isArray(enderecos)
        ? enderecos
        : [{ address: enderecos as unknown as string, family: 4 }]
    ) as {
      address: string;
      family: number;
    }[];
    const bom = lista.find((e) => !ipPrivado(e.address));
    if (!bom || lista.some((e) => ipPrivado(e.address)))
      return cb(new Error("Endereço não permitido."), "", 4);
    if ((opcoes as { all?: boolean }).all)
      return (cb as unknown as (e: null, a: typeof lista) => void)(null, [bom]);
    cb(null, bom.address, bom.family);
  });
};

function baixar(u: URL): Promise<{ status: number; local?: string; tipo: string; corpo: string }> {
  return new Promise((resolver, rejeitar) => {
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(
      u,
      {
        method: "GET",
        lookup: lookupSeguro,
        timeout: 4000,
        headers: {
          "user-agent": "AgillizaTech-Previa/1.0 (+https://agillizatech.com.br)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "pt-BR,pt;q=0.9",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const tipo = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          res.resume();
          return resolver({ status, local: String(res.headers.location ?? ""), tipo, corpo: "" });
        }
        if (!/text\/html|application\/xhtml/i.test(tipo)) {
          res.destroy();
          return resolver({ status, tipo, corpo: "" });
        }
        let bytes = 0;
        const partes: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          bytes += c.length;
          if (bytes > TETO_BYTES) {
            res.destroy();
            return;
          }
          partes.push(c);
        });
        res.on("close", () =>
          resolver({ status, tipo, corpo: Buffer.concat(partes).toString("utf8") }),
        );
        res.on("error", () =>
          resolver({ status, tipo, corpo: Buffer.concat(partes).toString("utf8") }),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("tempo esgotado")));
    req.on("error", rejeitar);
    req.end();
  });
}

export async function buscarPreviaLink(bruta: string): Promise<Previa | null> {
  const inicial = urlPermitida(bruta);
  if (!inicial) return null;
  const chave = inicial.toString();
  const em = cache.get(chave);
  if (em && Date.now() - em.em < VALIDADE_MS) return em.valor;
  let valor: Previa | null = null;
  try {
    let u: URL | null = inicial;
    for (let i = 0; i < 4 && u; i++) {
      const r = await baixar(u);
      if (r.local) {
        u = urlPermitida(new URL(r.local, u).toString());
        continue;
      }
      if (r.status >= 200 && r.status < 300 && r.corpo) valor = extrairPrevia(r.corpo, u);
      break;
    }
  } catch {
    valor = null;
  }
  if (cache.size >= 300) cache.delete(cache.keys().next().value!);
  cache.set(chave, { em: Date.now(), valor });
  return valor;
}

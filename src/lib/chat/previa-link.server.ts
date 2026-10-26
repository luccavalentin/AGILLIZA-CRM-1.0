import { lookup as resolverDns } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { armarPrazo, criarBuscadorDePrevia, ipPrivado, type Baixado } from "./previa-link-regras";

/**
 * Prévia de link do chat, buscada pelo servidor com as travas de `previa-link-regras`.
 *
 * O IP é conferido NA CONEXÃO (função `lookup` própria), não antes: assim um nome que
 * resolve para um IP público na conferência e para 127.0.0.1 na conexão (DNS rebinding)
 * não passa. Até 3 redirecionamentos (cada um conferido de novo), 256 KB, só HTML, e UM prazo
 * total para a busca inteira (auditoria rodada 2: o `timeout` do http é só de ociosidade).
 * Resultado (inclusive "sem prévia") fica 6 h num cache em memória de 300 endereços; a busca
 * que não está no cache passa antes pelo limite da pessoa (`antesDeBuscar`).
 */
export type Previa = {
  url: string;
  dominio: string;
  titulo: string | null;
  descricao: string | null;
};

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

function baixar(u: URL, prazo: number): Promise<Baixado> {
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
    armarPrazo(req, prazo);
    req.on("error", rejeitar);
    req.end();
  });
}

const buscar = criarBuscadorDePrevia({ baixar });

/** Prévia do link; `antesDeBuscar` é o limite da pessoa (só para o que não está no cache). */
export function buscarPreviaLink(
  bruta: string,
  antesDeBuscar?: () => Promise<unknown>,
): Promise<Previa | null> {
  return buscar(bruta, antesDeBuscar);
}

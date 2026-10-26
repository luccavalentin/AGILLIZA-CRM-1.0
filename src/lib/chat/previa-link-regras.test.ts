/**
 * Auditoria adversarial rodada 2 (26/10/2026), chat do Agilliza (mesmas regras do Agilliza Tech):
 *   · prévia de link: o `timeout` do http era só de ociosidade — um site que pinga 1 byte a
 *     cada 3 s ("slowloris") prendia a busca, e 3 redirecionamentos somavam 4 prazos. Agora UM
 *     prazo total; e a busca fora do cache passa pelo limite da pessoa (`chat.limite_previa_link`).
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { armarPrazo, criarBuscadorDePrevia, type Baixado } from "./previa-link-regras";

const HTML = '<html><head><title>Imóvel bonito</title></head></html>';

test("prévia: baixador que nunca termina desiste no prazo total", async () => {
  const buscar = criarBuscadorDePrevia({ baixar: () => new Promise<Baixado>(() => {}), prazoTotalMs: 200 });
  const t0 = Date.now();
  assert.equal(await buscar("https://exemplo.com.br/lento"), null);
  assert.ok(Date.now() - t0 < 1500, `levou ${Date.now() - t0} ms`);
});

test("prévia: redirecionamentos lentos somam UM prazo, não um por salto", async () => {
  let saltos = 0;
  const buscar = criarBuscadorDePrevia({
    prazoTotalMs: 300,
    baixar: async (u) => {
      saltos++;
      await new Promise((r) => setTimeout(r, 180));
      return { status: 302, local: `https://exemplo.com.br/s${saltos}`, tipo: "", corpo: "" };
    },
  });
  const t0 = Date.now();
  assert.equal(await buscar("https://exemplo.com.br/r"), null);
  assert.ok(Date.now() - t0 < 900, `levou ${Date.now() - t0} ms`);
  assert.ok(saltos <= 2, `foram ${saltos} saltos dentro do prazo`);
});

test("prévia: o limite da pessoa roda só fora do cache e, se recusar, nada é buscado", async () => {
  let baixou = 0;
  let limite = 0;
  const buscar = criarBuscadorDePrevia({
    baixar: async () => {
      baixou++;
      return { status: 200, tipo: "text/html", corpo: HTML };
    },
  });
  const contar = async () => {
    limite++;
  };
  assert.equal((await buscar("https://exemplo.com.br/a", contar))?.titulo, "Imóvel bonito");
  assert.equal((await buscar("https://exemplo.com.br/a", contar))?.titulo, "Imóvel bonito");
  assert.equal(limite, 1, "a segunda veio do cache e não contou no limite");
  await assert.rejects(
    buscar("https://exemplo.com.br/b", async () => {
      throw new Error("Muitas prévias de link em pouco tempo.");
    }),
    /Muitas prévias/,
  );
  assert.equal(baixou, 1, "recusada pelo limite, a página não foi visitada");
});

test("prévia: endereço proibido não gasta o limite nem visita nada", async () => {
  let limite = 0;
  const buscar = criarBuscadorDePrevia({ baixar: async () => assert.fail("não devia visitar") });
  assert.equal(await buscar("http://127.0.0.1/admin", async () => void limite++), null);
  assert.equal(limite, 0);
});

test("prévia: armarPrazo derruba uma conexão de verdade que pinga 1 byte de cada vez (slowloris)", async () => {
  const servidor = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    const t = setInterval(() => res.write("a"), 50);
    res.on("close", () => clearInterval(t));
  });
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", () => r()));
  const { port } = servidor.address() as AddressInfo;
  const t0 = Date.now();
  try {
    await new Promise<void>((resolver) => {
      // timeout de ociosidade folgado (como o de produção): sozinho, ele nunca dispararia.
      const req = http.request({ host: "127.0.0.1", port, path: "/", timeout: 4000 }, (res) => {
        res.on("data", () => {});
        res.on("close", () => resolver());
        res.on("error", () => resolver());
      });
      req.on("error", () => resolver());
      armarPrazo(req, Date.now() + 400);
      req.end();
    });
  } finally {
    servidor.closeAllConnections();
    servidor.close();
  }
  const levou = Date.now() - t0;
  assert.ok(levou >= 350 && levou < 2000, `levou ${levou} ms`);
});

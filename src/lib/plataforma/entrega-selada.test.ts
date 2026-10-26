/**
 * Auditoria adversarial rodada 2 (26/10/2026): rota de arquivo selado com `Range`.
 *
 * Quebra achada: a cada pedido de pedaço (o Safari faz dezenas por vídeo, e qualquer um com o
 * endereço selado pode disparar centenas em paralelo) o Agilliza baixava o arquivo INTEIRO do
 * Agilliza Tech para a memória (`arrayBuffer`) para cortar 2 bytes — e o Tech também lia o
 * arquivo inteiro. Agora o `Range` vai adiante e o pedaço volta em fluxo; o 206 também leva a
 * CSP que o 200 já levava.
 */
import { describe, expect, it, vi } from "vitest";
import { entregarArquivoSelado, type Selo } from "./entrega-selada";

const VIDEO: Selo = { k: "t/conversa/2026/10/26/a.mp4", m: "video/mp4", n: "clipe.mp4" };
const PDF: Selo = { k: "t/conversa/2026/10/26/a.pdf", m: "application/pdf", n: "doc.pdf" };
const ARQ = new TextEncoder().encode("0123456789abcdefghij"); // 20 bytes

/** Resposta do Tech que proíbe ser lida inteira na memória. */
function doTech(status: number, corpo: Uint8Array | null, headers: Record<string, string> = {}) {
  const r = new Response(
    corpo ? new ReadableStream<Uint8Array>({ start(c) { c.enqueue(corpo); c.close(); } }) : null,
    { status, headers },
  );
  Object.defineProperty(r, "arrayBuffer", {
    value: () => {
      throw new Error("leu o arquivo inteiro na memória");
    },
  });
  return r;
}

/** Tech de mentira que já entende Range (o lado do Tech tem os próprios testes). */
function tech() {
  const chamadas: Array<{ chave: string; range: string | null }> = [];
  const lerDoCorretor = vi.fn(async (chave: string, range: string | null) => {
    chamadas.push({ chave, range });
    const m = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
    if (range === "bytes=20-") return doTech(416, null, { "content-range": "bytes */20" });
    if (m) {
      const ini = Number(m[1]);
      const fim = Math.min(m[2] ? Number(m[2]) : 19, 19);
      const p = ARQ.subarray(ini, fim + 1);
      return doTech(206, p, { "content-length": String(p.byteLength), "content-range": `bytes ${ini}-${fim}/20` });
    }
    return doTech(200, ARQ, { "content-length": "20" });
  });
  return { chamadas, lerDoCorretor };
}

const pedir = (range?: string, t = "selo") =>
  new Request(`http://x/api/plataforma/midia?t=${t}`, { headers: range ? { range } : {} });

const dep = (selo: Selo | null, t = tech()) => ({ ...t, abrirSelo: vi.fn(() => selo) });

describe("arquivo selado com Range", () => {
  it("o pedaço do Safari (bytes=0-1) vem em fluxo do Tech, sem baixar o arquivo inteiro", async () => {
    const d = dep(VIDEO);
    const r = await entregarArquivoSelado(pedir("bytes=0-1"), d);
    expect(r.status).toBe(206);
    expect(d.chamadas).toEqual([{ chave: VIDEO.k, range: "bytes=0-1" }]);
    expect(r.headers.get("content-range")).toBe("bytes 0-1/20");
    expect(r.headers.get("content-length")).toBe("2");
    expect(r.headers.get("content-type")).toBe("video/mp4");
    expect(new TextDecoder().decode(await r.arrayBuffer())).toBe("01");
  });

  it("o 206 leva a mesma CSP e nosniff do 200 (arquivo de usuário não roda script)", async () => {
    const r = await entregarArquivoSelado(pedir("bytes=5-"), dep(VIDEO));
    expect(r.status).toBe(206);
    expect(r.headers.get("content-security-policy")).toMatch(/sandbox/);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("accept-ranges")).toBe("bytes");
  });

  it("faixa fora do arquivo: 416 com o tamanho que o Tech informou", async () => {
    const r = await entregarArquivoSelado(pedir("bytes=20-"), dep(VIDEO));
    expect(r.status).toBe(416);
    expect(r.headers.get("content-range")).toBe("bytes */20");
  });

  it("várias faixas, negativas ou lixo não vão adiante: arquivo inteiro com 200", async () => {
    for (const range of ["bytes=0-1,5-9", "bytes=-5-10", "bytes=0-5,3-8", "items=0-1", "bytes=1e3-", "bytes=0-1 ,2-3", "bytes=--1"]) {
      const d = dep(VIDEO);
      const r = await entregarArquivoSelado(pedir(range), d);
      expect(r.status, range).toBe(200);
      expect(d.chamadas[0]?.range ?? null, range).toBeNull();
    }
  });

  it("arquivo que não é vídeo/áudio ignora o Range (200 inteiro, em fluxo)", async () => {
    const d = dep(PDF);
    const r = await entregarArquivoSelado(pedir("bytes=0-1"), d);
    expect(r.status).toBe(200);
    expect(d.chamadas[0]?.range).toBeNull();
    expect(r.headers.get("content-length")).toBe("20");
  });

  it("selo inválido, vencido ou grande demais: 404 sem tocar o Tech", async () => {
    const d = dep(null);
    expect((await entregarArquivoSelado(pedir("bytes=0-1"), d)).status).toBe(404);
    const d2 = dep(VIDEO);
    expect((await entregarArquivoSelado(pedir("bytes=0-1", "x".repeat(2000)), d2)).status).toBe(404);
    expect(d.lerDoCorretor).not.toHaveBeenCalled();
    expect(d2.lerDoCorretor).not.toHaveBeenCalled();
  });

  it("Tech fora do ar ou arquivo sumido: 404", async () => {
    const d = { abrirSelo: () => VIDEO, lerDoCorretor: vi.fn(async () => doTech(404, null)) };
    expect((await entregarArquivoSelado(pedir("bytes=0-1"), d)).status).toBe(404);
    const e = { abrirSelo: () => VIDEO, lerDoCorretor: vi.fn(async () => { throw new Error("rede"); }) };
    expect((await entregarArquivoSelado(pedir(), e)).status).toBe(404);
  });
});

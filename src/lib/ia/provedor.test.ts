/**
 * Camada de provedor de IA e leitura do Scan com provedor SIMULADO (nunca a IA real).
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  configDaLinha,
  ErroIA,
  extrairJson,
  gerarJson,
  gerarTexto,
  gerarTextoStream,
  MENSAGEM_SEM_CHAVE,
  type ConfigProvedor,
} from "./provedor.server";
import { detectarMime, extrairDocumento } from "@/lib/crm/scan-ia-extracao.server";

const GEMINI: ConfigProvedor = {
  provedor: "gemini",
  modelo: "gemini-2.5-flash",
  apiKey: "chave-de-teste",
  baseUrl: "https://ia.simulada",
  temperatura: 0.2,
};
const OPENAI: ConfigProvedor = { ...GEMINI, provedor: "openai", modelo: "gpt-4o-mini" };

/** Provedor simulado: responde como o Gemini/OpenAI responderiam, sem rede. */
function simulado(resposta: { status?: number; json?: unknown; texto?: string; sse?: string[] }) {
  const chamadas: Array<{ url: string; corpo: any }> = [];
  const f = vi.fn(async (url: any, init: any) => {
    chamadas.push({ url: String(url), corpo: JSON.parse(init.body) });
    if (resposta.sse) {
      const enc = new TextEncoder();
      const corpo = new ReadableStream({
        start(c) {
          for (const l of resposta.sse!) c.enqueue(enc.encode(l));
          c.close();
        },
      });
      return new Response(corpo, { status: 200 });
    }
    return new Response(resposta.texto ?? JSON.stringify(resposta.json ?? {}), {
      status: resposta.status ?? 200,
    });
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

const gem = (texto: string) => ({ candidates: [{ content: { parts: [{ text: texto }] } }] });

describe("provedor de IA", () => {
  it("sem chave: mensagem clara dizendo onde configurar; desativada também", () => {
    expect(() => configDaLinha(null, {})).toThrow(MENSAGEM_SEM_CHAVE);
    expect(() => configDaLinha({ api_key: "x", ativo: false }, {})).toThrow(/desativada/);
    const c = configDaLinha(
      { api_key: " k ", base_url: "https://x.y/", config: { provedor: "openai" } },
      {},
    );
    expect(c).toMatchObject({
      provedor: "openai",
      modelo: "gpt-4o-mini",
      apiKey: "k",
      baseUrl: "https://x.y",
    });
    expect(configDaLinha({ api_key: "k", config: {} }, {}).modelo).toBe("gemini-2.5-flash");
  });

  it("erros HTTP viram mensagens em português (cota, chave, modelo, arquivo)", async () => {
    for (const [status, texto, re] of [
      [429, "{}", /cota/i],
      [401, "{}", /chave/i],
      [404, "{}", /modelo/i],
      [400, "The document has no pages", /arquivo/i],
      [500, "boom", /não respondeu/i],
    ] as const) {
      const { f } = simulado({ status, texto });
      await expect(
        gerarTexto(GEMINI, { sistema: "s", mensagens: [{ papel: "usuario", texto: "oi" }] }, f),
      ).rejects.toThrow(re);
    }
  });

  it("monta o pedido certo para cada provedor (sistema, histórico, arquivo)", async () => {
    const g = simulado({ json: gem("ok") });
    await gerarTexto(
      GEMINI,
      {
        sistema: "Você é o consultor.",
        mensagens: [
          { papel: "usuario", texto: "a" },
          { papel: "assistente", texto: "b" },
          { papel: "usuario", texto: "c" },
        ],
        arquivo: { mime: "image/png", base64: "QUJD", nome: "rg.png" },
      },
      g.f,
    );
    expect(g.chamadas[0]!.url).toContain(":generateContent?key=chave-de-teste");
    expect(g.chamadas[0]!.corpo.systemInstruction.parts[0].text).toBe("Você é o consultor.");
    expect(g.chamadas[0]!.corpo.contents.map((c: any) => c.role)).toEqual([
      "user",
      "model",
      "user",
    ]);
    expect(g.chamadas[0]!.corpo.contents[2].parts[1].inline_data.mime_type).toBe("image/png");

    const o = simulado({ json: { choices: [{ message: { content: "ok" } }] } });
    expect(
      await gerarTexto(
        OPENAI,
        {
          sistema: "S",
          mensagens: [{ papel: "usuario", texto: "x" }],
          arquivo: { mime: "application/pdf", base64: "QQ==", nome: "a.pdf" },
        },
        o.f,
      ),
    ).toBe("ok");
    expect(o.chamadas[0]!.corpo.messages[0]).toEqual({ role: "system", content: "S" });
    expect(o.chamadas[0]!.corpo.messages[1].content[1].type).toBe("file");
  });

  it("streaming SSE dos dois provedores, inclusive linha partida no meio", async () => {
    const g = simulado({
      sse: [
        'data: {"candidates":[{"content":{"parts":[{"text":"Olá, "}]}}]}\n',
        'data: {"candidates":[{"content":{"par',
        'ts":[{"text":"mundo"}]}}]}\n\n',
      ],
    });
    const pedacos: string[] = [];
    for await (const p of gerarTextoStream(
      GEMINI,
      { sistema: "s", mensagens: [{ papel: "usuario", texto: "oi" }] },
      g.f,
    ))
      pedacos.push(p);
    expect(pedacos.join("")).toBe("Olá, mundo");
    const o = simulado({
      sse: ['data: {"choices":[{"delta":{"content":"A"}}]}\n', "data: [DONE]\n"],
    });
    const out: string[] = [];
    for await (const p of gerarTextoStream(
      OPENAI,
      { sistema: "s", mensagens: [{ papel: "usuario", texto: "oi" }] },
      o.f,
    ))
      out.push(p);
    expect(out).toEqual(["A"]);
  });

  it("JSON validado por esquema: cerca de markdown tolerada, fora do esquema recusado", async () => {
    expect(extrairJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => extrairJson("não é json")).toThrow(ErroIA);
    const esquema = z.object({ a: z.number() });
    const ok = simulado({ json: gem('Aqui está: {"a": 2} fim') });
    expect(
      (
        await gerarJson(
          GEMINI,
          { sistema: "s", mensagens: [{ papel: "usuario", texto: "x" }] },
          esquema,
          ok.f,
        )
      ).dados,
    ).toEqual({ a: 2 });
    const ruim = simulado({ json: gem('{"a":"dois"}') });
    await expect(
      gerarJson(
        GEMINI,
        { sistema: "s", mensagens: [{ papel: "usuario", texto: "x" }] },
        esquema,
        ruim.f,
      ),
    ).rejects.toThrow(/fora do formato/);
  });
});

describe("Scan IA com provedor simulado", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

  it("detecta o MIME pelos bytes (não pelo nome)", () => {
    expect(detectarMime(PNG, "rg.pdf")).toBe("image/png");
    expect(detectarMime(new TextEncoder().encode("%PDF-1.7"), "x.bin")).toBe("application/pdf");
    expect(detectarMime(new Uint8Array([1, 2, 3]), "foto.jpeg")).toBe("image/jpeg");
  });

  it("lê o RG: só campos previstos, normaliza, valida CPF/data/UF/órgão e rebaixa o reprovado", async () => {
    const resposta = {
      tipo_documento: "rg",
      confianca_tipo: "95",
      campos: [
        { campo: "nome_completo", valor: "MARIA DA SILVA", confianca: 0.98 },
        { campo: "cpf_cnpj", valor: "529.982.247-24", confianca: 0.97 }, // dígito errado
        { campo: "data_nascimento", valor: "12/03/1985", confianca: 0.9 },
        { campo: "orgao_expedidor", valor: "SSP SP", confianca: 0.9 },
        { campo: "uf_expedicao", valor: "ZZ", confianca: 0.9 },
        { campo: "campo_inventado", valor: "x", confianca: 1 },
        { campo: "endereco_completo", valor: "Rua das Flores, 10 - 01310-100", confianca: 0.8 },
        { campo: "nome_mae", valor: { primeiro: "Ana", ultimo: "Silva" }, confianca: 0.8 },
        { campo: "nome_completo", valor: "Duplicado", confianca: 0.1 },
      ],
    };
    const { f, chamadas } = simulado({ json: gem(JSON.stringify(resposta)) });
    const r = await extrairDocumento({
      cfg: GEMINI,
      bytes: PNG,
      mime: "image/png",
      nomeArquivo: "rg.png",
      tipoInformado: null,
      fetch: f,
      hoje: new Date("2026-10-26T12:00:00Z"),
    });
    expect(chamadas[0]!.corpo.generationConfig.responseMimeType).toBe("application/json");
    expect(chamadas[0]!.corpo.generationConfig.temperature).toBe(0);
    expect(r.tipoSugerido).toBe("rg");
    expect(r.confiancaTipo).toBe(0.95);
    const por = Object.fromEntries(r.campos.map((c) => [c.campo, c]));
    expect(Object.keys(por).sort()).toEqual(
      [
        "cpf_cnpj",
        "data_nascimento",
        "endereco_cep",
        "endereco_completo",
        "nome_completo",
        "nome_mae",
        "orgao_expedidor",
        "uf_expedicao",
      ].sort(),
    );
    expect(por.nome_completo!.valor).toBe("MARIA DA SILVA");
    expect(por.cpf_cnpj!).toMatchObject({ valido: false, confianca: 0.3 });
    expect(por.cpf_cnpj!.motivo_validacao).toMatch(/dígito/);
    expect(por.uf_expedicao!.valido).toBe(false);
    expect(por.orgao_expedidor!.valido).toBe(true);
    expect(por.endereco_cep!.valor).toBe("01310-100");
    expect(por.nome_mae!.valor).toBe("primeiro: Ana; ultimo: Silva");
  });

  it("resposta fora do contrato vira erro claro (não grava lixo)", async () => {
    const { f } = simulado({ json: gem('{"campos": "não é lista"}') });
    await expect(
      extrairDocumento({
        cfg: GEMINI,
        bytes: PNG,
        mime: "image/png",
        nomeArquivo: "a.png",
        tipoInformado: "rg",
        fetch: f,
      }),
    ).rejects.toThrow(/fora do formato/);
  });
});

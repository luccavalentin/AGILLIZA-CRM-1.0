/**
 * Camada única de provedor de IA (Gemini e OpenAI) — SÓ SERVIDOR.
 *
 * Antes, Scan IA e Consultor IA montavam cada um a sua chamada HTTP, com modelos padrão
 * diferentes (um deles já descontinuado: "gemini-2.0-flash-exp"). Agora os dois passam por
 * aqui: configuração da conta (Configurações gerais › APIs de IA), mensagens de erro claras
 * em português (sem chave, cota, chave inválida, arquivo ilegível), resposta JSON validada
 * por esquema (zod) e streaming. O `fetch` é injetável: os testes usam um provedor
 * SIMULADO e nunca chamam a IA de verdade.
 */
import type { ZodType, ZodTypeDef } from "zod";

export type ProvedorIA = "gemini" | "openai";

/** Modelo padrão quando a conta não escolheu (o mesmo do preset da tela de APIs de IA). */
export const MODELO_PADRAO: Record<ProvedorIA, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
};
export const BASE_PADRAO: Record<ProvedorIA, string> = {
  gemini: "https://generativelanguage.googleapis.com",
  openai: "https://api.openai.com/v1",
};

export interface ConfigProvedor {
  provedor: ProvedorIA;
  modelo: string;
  apiKey: string;
  baseUrl: string;
  temperatura: number;
}

export type CodigoErroIA =
  | "sem_chave"
  | "desativada"
  | "cota"
  | "chave_invalida"
  | "arquivo"
  | "formato"
  | "indisponivel";

export class ErroIA extends Error {
  constructor(
    public codigo: CodigoErroIA,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroIA";
  }
}

export const MENSAGEM_SEM_CHAVE =
  "A IA ainda não está configurada nesta conta. Cadastre a chave em Configurações gerais › APIs de IA.";

/** Linha de `admin_api_integrations` (chave 'ia') → configuração. Sem chave: ErroIA claro. */
export function configDaLinha(
  linha: { api_key?: string | null; base_url?: string | null; config?: unknown; ativo?: boolean | null } | null,
  env: Record<string, string | undefined> = process.env,
): ConfigProvedor {
  if (linha && linha.ativo === false) {
    throw new ErroIA("desativada", "A integração de IA está desativada. Ative-a em Configurações gerais › APIs de IA.");
  }
  const cfg = (linha?.config ?? {}) as Record<string, unknown>;
  const provedor: ProvedorIA = cfg.provedor === "openai" ? "openai" : "gemini";
  const modelo =
    typeof cfg.modelo === "string" && cfg.modelo.trim() ? cfg.modelo.trim() : MODELO_PADRAO[provedor];
  const salva = typeof linha?.api_key === "string" ? linha.api_key.trim() : "";
  const apiKey = salva || (provedor === "openai" ? env.OPENAI_API_KEY : env.GEMINI_API_KEY) || "";
  if (!apiKey) throw new ErroIA("sem_chave", MENSAGEM_SEM_CHAVE);
  const baseUrl = ((typeof linha?.base_url === "string" && linha.base_url.trim()) || BASE_PADRAO[provedor]).replace(
    /\/+$/,
    "",
  );
  const temperatura = typeof cfg.temperatura === "number" ? Math.max(0, Math.min(2, cfg.temperatura)) : 0.2;
  return { provedor, modelo, apiKey, baseUrl, temperatura };
}

/** Resposta HTTP de erro do provedor → mensagem para a pessoa (detalhe técnico só no log). */
export function erroDaResposta(status: number, corpo: string): ErroIA {
  if (status === 429) {
    return new ErroIA("cota", "A cota da IA acabou ou o limite por minuto foi atingido. Tente de novo em alguns minutos.");
  }
  if (status === 401 || status === 403) {
    return new ErroIA("chave_invalida", "A chave da IA é inválida ou não tem permissão. Revise em Configurações gerais › APIs de IA.");
  }
  if (/has no pages|Unsupported MIME|invalid image|unsupported image|could not process/i.test(corpo)) {
    return new ErroIA(
      "arquivo",
      "Não foi possível abrir este arquivo. Confira se o PDF não está corrompido ou protegido por senha, ou envie em JPG/PNG.",
    );
  }
  if (status === 404) {
    return new ErroIA("indisponivel", "O modelo de IA configurado não existe mais. Escolha outro em Configurações gerais › APIs de IA.");
  }
  console.error("[ia] provedor respondeu", status, corpo.slice(0, 300));
  return new ErroIA("indisponivel", "A IA não respondeu agora. Tente de novo em alguns minutos.");
}

export type Mensagem = { papel: "usuario" | "assistente"; texto: string };
export type Arquivo = { mime: string; base64: string; nome: string };

export interface Pedido {
  sistema: string;
  mensagens: Mensagem[];
  arquivo?: Arquivo;
  json?: boolean;
  maxTokens?: number;
  temperatura?: number;
}

type Fetch = typeof fetch;

function corpoGemini(p: Pedido, cfg: ConfigProvedor) {
  const contents = p.mensagens.map((m, i) => ({
    role: m.papel === "usuario" ? "user" : "model",
    parts: [
      { text: m.texto },
      ...(p.arquivo && i === p.mensagens.length - 1
        ? [{ inline_data: { mime_type: p.arquivo.mime, data: p.arquivo.base64 } }]
        : []),
    ],
  }));
  return {
    systemInstruction: { parts: [{ text: p.sistema }] },
    contents,
    generationConfig: {
      temperature: p.temperatura ?? cfg.temperatura,
      maxOutputTokens: p.maxTokens ?? 2048,
      ...(p.json ? { responseMimeType: "application/json" } : {}),
      // O "pensamento" do 2.5 atrasa a primeira palavra; nos nossos usos (extração e RAG
      // objetivo) não compensa. Modelos sem suporte ignoram a opção.
      ...(cfg.modelo.includes("2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };
}

function corpoOpenai(p: Pedido, cfg: ConfigProvedor, stream: boolean) {
  const ultima = p.mensagens.length - 1;
  const mensagens = p.mensagens.map((m, i) => {
    if (p.arquivo && i === ultima) {
      const ehPdf = p.arquivo.mime === "application/pdf";
      return {
        role: "user",
        content: [
          { type: "text", text: m.texto },
          ehPdf
            ? { type: "file", file: { filename: p.arquivo.nome, file_data: `data:${p.arquivo.mime};base64,${p.arquivo.base64}` } }
            : { type: "image_url", image_url: { url: `data:${p.arquivo.mime};base64,${p.arquivo.base64}` } },
        ],
      };
    }
    return { role: m.papel === "usuario" ? "user" : "assistant", content: m.texto };
  });
  return {
    model: cfg.modelo,
    temperature: p.temperatura ?? cfg.temperatura,
    max_tokens: p.maxTokens ?? 2048,
    messages: [{ role: "system", content: p.sistema }, ...mensagens],
    ...(p.json ? { response_format: { type: "json_object" } } : {}),
    ...(stream ? { stream: true } : {}),
  };
}

function endereco(cfg: ConfigProvedor, stream: boolean): { url: string; headers: Record<string, string> } {
  if (cfg.provedor === "openai") {
    return {
      url: `${cfg.baseUrl}/chat/completions`,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    };
  }
  const metodo = stream ? "streamGenerateContent?alt=sse&" : "generateContent?";
  return {
    url: `${cfg.baseUrl}/v1beta/models/${encodeURIComponent(cfg.modelo)}:${metodo}key=${encodeURIComponent(cfg.apiKey)}`,
    headers: { "Content-Type": "application/json" },
  };
}

async function chamar(cfg: ConfigProvedor, p: Pedido, stream: boolean, f: Fetch, tempoMs: number): Promise<Response> {
  const { url, headers } = endereco(cfg, stream);
  let resp: Response;
  try {
    resp = await f(url, {
      method: "POST",
      headers,
      body: JSON.stringify(cfg.provedor === "openai" ? corpoOpenai(p, cfg, stream) : corpoGemini(p, cfg)),
      signal: AbortSignal.timeout(tempoMs),
    });
  } catch (e) {
    console.error("[ia] falha de rede", (e as Error)?.name);
    throw new ErroIA("indisponivel", "A IA não respondeu a tempo. Tente de novo em alguns minutos.");
  }
  if (!resp.ok) throw erroDaResposta(resp.status, await resp.text().catch(() => ""));
  return resp;
}

/** Resposta inteira (sem streaming). */
export async function gerarTexto(cfg: ConfigProvedor, p: Pedido, f: Fetch = fetch, tempoMs = 90_000): Promise<string> {
  const resp = await chamar(cfg, p, false, f, tempoMs);
  const json: any = await resp.json().catch(() => null);
  const texto: string =
    cfg.provedor === "openai"
      ? (json?.choices?.[0]?.message?.content ?? "")
      : (json?.candidates?.[0]?.content?.parts ?? []).map((x: any) => x?.text ?? "").join("");
  return texto;
}

/** Streaming: devolve pedaços de texto conforme o modelo gera (SSE dos dois provedores). */
export async function* gerarTextoStream(
  cfg: ConfigProvedor,
  p: Pedido,
  f: Fetch = fetch,
  tempoMs = 120_000,
): AsyncGenerator<string> {
  const resp = await chamar(cfg, p, true, f, tempoMs);
  if (!resp.body) throw new ErroIA("indisponivel", "A IA não respondeu agora. Tente de novo em alguns minutos.");
  const leitor = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const pedacoDe = (linha: string): string => {
    const l = linha.trim();
    if (!l.startsWith("data:")) return "";
    const carga = l.slice(5).trim();
    if (!carga || carga === "[DONE]") return "";
    try {
      const json = JSON.parse(carga);
      return cfg.provedor === "openai"
        ? (json?.choices?.[0]?.delta?.content ?? "")
        : (json?.candidates?.[0]?.content?.parts ?? []).map((x: any) => x?.text ?? "").join("");
    } catch {
      return "";
    }
  };
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const linhas = buffer.split("\n");
    buffer = linhas.pop() ?? "";
    for (const linha of linhas) {
      const pedaco = pedacoDe(linha);
      if (pedaco) yield pedaco;
    }
  }
  const resto = pedacoDe(buffer);
  if (resto) yield resto;
}

/** Tira cercas de markdown e lixo antes/depois do JSON. */
export function extrairJson(texto: string): unknown {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(limpo);
  } catch {
    const m = limpo.match(/\{[\s\S]*\}/);
    if (!m) throw new ErroIA("formato", "A IA respondeu fora do formato esperado. Tente reprocessar.");
    try {
      return JSON.parse(m[0]);
    } catch {
      throw new ErroIA("formato", "A IA respondeu fora do formato esperado. Tente reprocessar.");
    }
  }
}

/** Resposta JSON validada pelo esquema. Fora do esquema → ErroIA("formato"). */
export async function gerarJson<T>(
  cfg: ConfigProvedor,
  p: Omit<Pedido, "json">,
  esquema: ZodType<T, ZodTypeDef, any>,
  f: Fetch = fetch,
  tempoMs = 120_000,
): Promise<{ dados: T; bruto: string }> {
  const bruto = await gerarTexto(cfg, { ...p, json: true }, f, tempoMs);
  const r = esquema.safeParse(extrairJson(bruto));
  if (!r.success) {
    console.error("[ia] JSON fora do esquema", r.error.issues.slice(0, 3));
    throw new ErroIA("formato", "A IA respondeu fora do formato esperado. Tente reprocessar.");
  }
  return { dados: r.data, bruto };
}

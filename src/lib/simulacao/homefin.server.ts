/**
 * Cliente server-only da integração bancária (provedor externo).
 */

import { humanizarRespostaErro } from "./bank-error-humanizer";

export const TIPO_BANCO_SANTANDER = 33;

const SENSIVEIS = new Set([
  "secretId", "secretKey", "cpfCnpj", "cpf", "cnpj", "cpfConjuge",
  "rendaTotal", "renda", "rendaConjuge", "email", "emailConjuge",
  "celular", "celularConjuge", "senha", "password", "token", "jwt",
]);

function mascarar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(mascarar);
  if (valor && typeof valor === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      out[k] = SENSIVEIS.has(k) ? "***" : mascarar(v);
    }
    return out;
  }
  return valor;
}

const CAMPOS_TEXTO_LIVRE_BANCO = new Set([
  "nomeProfissao", "nomeProfissaoConjuge", "nomeEmpresaProfissao",
  "nomeEmpresaProfissaoConjuge", "profession", "company",
]);

function limparTextoLivreBanco(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  return valor.replace(/\((?:a|o)\)/gi, "").replace(/[(){}[\]]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizarPayloadBanco(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(normalizarPayloadBanco);
  if (valor && typeof valor === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      out[k] = CAMPOS_TEXTO_LIVRE_BANCO.has(k) ? limparTextoLivreBanco(v) : normalizarPayloadBanco(v);
    }
    return out;
  }
  return valor;
}

export class IntegracaoBancariaError extends Error {
  constructor(message: string, public statusHttp?: number) {
    super(message);
    this.name = "IntegracaoBancariaError";
  }
}

function config() {
  const base = process.env.HOMEFIN_BASE_URL;
  const secretId = process.env.HOMEFIN_SECRET_ID;
  const secretKey = process.env.HOMEFIN_SECRET_KEY;
  if (!base || !secretId || !secretKey) {
    throw new IntegracaoBancariaError("Integração bancária não configurada.");
  }
  return { base: base.replace(/\/$/, ""), secretId, secretKey };
}

export function sanitizarMensagemErro(msg: string | null | undefined): string {
  const fallback = "O banco não respondeu corretamente. Tente novamente em instantes.";
  if (!msg) return fallback;
  if (/supabase|service[_ ]role|environment variable|cloud/i.test(msg)) return fallback;
  return msg;
}

async function registrarLog(entrada: {
  simulacao_id?: string | null;
  proposta_id?: string | null;
  correspondente_id?: string | null;
  endpoint: string;
  metodo: string;
  status_http?: number;
  request?: unknown;
  response?: unknown;
  erro?: string;
}) {
  try {
    const { supabaseAdmin: sbAdmin } = await import("@/integrations/supabase/client.server");
    if (entrada.proposta_id) {
      await sbAdmin.from("proposta_logs_homefin").insert({

        proposta_id: entrada.proposta_id,
        correspondente_id: entrada.correspondente_id ?? null,
        endpoint: entrada.endpoint,
        metodo: entrada.metodo,
        status_http: entrada.status_http ?? null,
        request_masked: entrada.request ? (mascarar(entrada.request) as any) : null,
        response: (entrada.response as any) ?? null,
        erro: entrada.erro ?? null,
      });
      return;
    }
    await sbAdmin.from("simulacao_logs_homefin").insert({
      simulacao_id: entrada.simulacao_id ?? null,
      correspondente_id: entrada.correspondente_id ?? null,
      endpoint: entrada.endpoint,
      metodo: entrada.metodo,
      status_http: entrada.status_http ?? null,
      request_masked: entrada.request ? (mascarar(entrada.request) as any) : null,
      response: (entrada.response as any) ?? null,
      erro: entrada.erro ?? null,
    });
  } catch (e) {
    console.error("[integracao] falha ao registrar log", e);
  }
}

interface TokenInfo {
  token: string;
  idRegional: string | null;
  idParceiro: string | null;
  idUsuarioParceiro: string | null;
}

let _tokenCache: { info: TokenInfo; expiresAt: number } | null = null;
let _tokenEmVoo: Promise<TokenInfo> | null = null;
const CACHE_ID = "00000000-0000-0000-0000-000000000000";

async function solicitarToken(): Promise<TokenInfo> {
  const { base, secretId, secretKey } = config();
  const url = `${base}/auth/token`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secretId, secretKey }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    await registrarLog({ endpoint: "/auth/token", metodo: "POST", erro: String(e) });
    throw new IntegracaoBancariaError("Falha ao autenticar na integração bancária.");
  }

  const json = (await resp.json().catch(() => ({}))) as Record<string, any>;
  await registrarLog({ endpoint: "/auth/token", metodo: "POST", status_http: resp.status, response: { ok: resp.ok } });
  if (!resp.ok) throw new IntegracaoBancariaError("Não foi possível autenticar.", resp.status);

  const token: string = json.jwt ?? json.token ?? "";
  const usuario = json.usuario ?? {};
  const info: TokenInfo = {
    token,
    idRegional: String(usuario.idRegional ?? json.idRegional ?? "") || null,
    idParceiro: String(usuario.idParceiro ?? json.idParceiro ?? "") || null,
    idUsuarioParceiro: String(usuario.idUsuarioParceiro ?? json.idUsuarioParceiro ?? "") || null,
  };

  const expiresAt = Date.now() + 25 * 60 * 1000;
  _tokenCache = { info, expiresAt };

  try {
    const { supabaseAdmin: sbAdmin } = await import("@/integrations/supabase/client.server");
    await sbAdmin.from("homefin_auth_cache").upsert({

      id: CACHE_ID, token: info.token, expires_at: new Date(expiresAt).toISOString(),
      id_regional: info.idRegional, id_parceiro: info.idParceiro, id_usuario_parceiro: info.idUsuarioParceiro,
    });
  } catch (e) { console.error("[integracao] falha ao persistir cache", e); }
  return info;
}

export async function obterToken(forcarRenovacao = false): Promise<TokenInfo> {
  const margem = 2 * 60 * 1000;
  const agora = Date.now();
  if (!forcarRenovacao && _tokenCache && _tokenCache.expiresAt > agora + margem) return _tokenCache.info;
  
  if (!forcarRenovacao) {
    try {
      const { supabaseAdmin: sbAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await sbAdmin.from("homefin_auth_cache").select("*").eq("id", CACHE_ID).maybeSingle();

      if (data && new Date(data.expires_at).getTime() > agora + margem) {
        const info: TokenInfo = { token: data.token, idRegional: data.id_regional, idParceiro: data.id_parceiro, idUsuarioParceiro: data.id_usuario_parceiro };
        _tokenCache = { info, expiresAt: new Date(data.expires_at).getTime() };
        return info;
      }
    } catch (e) { console.error("[integracao] erro cache L2", e); }
  }
  
  if (_tokenEmVoo) return _tokenEmVoo;
  if (forcarRenovacao) _tokenCache = null;
  
  _tokenEmVoo = (async () => {
    try { return await solicitarToken(); } finally { _tokenEmVoo = null; }
  })();
  return _tokenEmVoo;
}


export interface HomefinRequestCtx {
  simulacao_id?: string | null;
  proposta_id?: string | null;
  correspondente_id?: string | null;
}

export async function chamarIntegracao<T = unknown>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body: unknown | undefined,
  ctx: HomefinRequestCtx = {},
): Promise<T> {
  const queuedAt = performance.now();
  const isAuth = endpoint.startsWith("/auth");
  const isDominio = endpoint.includes("/dominios");
  const isIntegracao = endpoint.includes("/integracao");
  
  // Elevar limite para 3 e garantir que funciona como fila global
  const CONCURRENCY_LIMIT = 3;
  const deveSerializar = !isAuth && !isDominio;

  if (deveSerializar) {
    const global = globalThis as any;
    global._hfActiveCount = global._hfActiveCount || 0;
    global._hfQueue = global._hfQueue || [];

    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        global._hfActiveCount++;
        const startedAt = performance.now();
        const queue_wait_ms = (startedAt - queuedAt).toFixed(0);
        console.info(`[SIM-PERF][API] ${method} ${endpoint} queue_wait_ms=${queue_wait_ms}`);
        
        try {
          const result = await executarChamada<T>(endpoint, method, body, ctx);
          resolve(result);
        } catch (e) {
          reject(e);
        } finally {
          global._hfActiveCount--;
          if (global._hfQueue.length > 0) {
            const nextTask = global._hfQueue.shift();
            nextTask();
          }
        }
      };

      if (global._hfActiveCount < CONCURRENCY_LIMIT) {
        task();
      } else {
        global._hfQueue.push(task);
      }
    });
  }

  const startedAt = performance.now();
  const queue_wait_ms = (startedAt - queuedAt).toFixed(0);
  console.info(`[SIM-PERF][API] ${method} ${endpoint} queue_wait_ms=${queue_wait_ms}`);
  return executarChamada<T>(endpoint, method, body, ctx);
}


async function executarChamada<T = unknown>(
  endpoint: string, method: "GET" | "POST" | "PUT" | "DELETE",
  body: unknown | undefined, ctx: HomefinRequestCtx = {},
): Promise<T> {
  const { base } = config();
  const url = `${base}${endpoint}`;
  const bodyNormalizado = body ? normalizarPayloadBanco(body) : undefined;

  const executar = (token: string) => fetch(url, {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: bodyNormalizado ? JSON.stringify(bodyNormalizado) : undefined,
    signal: AbortSignal.timeout(90_000),
  });

  let resp: Response;
  try {
    let tokenInfo = await obterToken();
    let tokenAtual = tokenInfo.token;
    const apiStart = performance.now();
    resp = await executar(tokenAtual);
    const api_duration_ms = (performance.now() - apiStart).toFixed(0);
    console.info(`[SIM-PERF][API-RAW] ${method} ${endpoint} api_duration_ms=${api_duration_ms}`);

    for (let tentativa = 0; tentativa < 2 && resp.status === 401; tentativa++) {
      tokenInfo = await obterToken(true);
      if (tokenInfo.token === tokenAtual) break;
      tokenAtual = tokenInfo.token;
      const tStart = performance.now();
      resp = await executar(tokenAtual);
      console.info(`[SIM-PERF][API-RAW] ${method} ${endpoint} retry_api_duration_ms=${(performance.now() - tStart).toFixed(0)}`);
    }
  } catch (e) {
    await registrarLog({ ...ctx, endpoint, metodo: method, request: bodyNormalizado, erro: String(e) });
    throw new IntegracaoBancariaError("O banco não respondeu no tempo esperado.");
  }

  const json = (await resp.json().catch(() => null)) as T;
  await registrarLog({ ...ctx, endpoint, metodo: method, status_http: resp.status, request: bodyNormalizado, response: json as any, erro: resp.ok ? undefined : `HTTP ${resp.status}` });
  if (!resp.ok) throw new IntegracaoBancariaError(humanizarRespostaErro(json, resp.status, endpoint), resp.status);
  return json;
}

export function integracaoConfigurada(): boolean {
  return Boolean(process.env.HOMEFIN_BASE_URL && process.env.HOMEFIN_SECRET_ID && process.env.HOMEFIN_SECRET_KEY);
}

/** Busca a lista oficial de bancos no provedor de integração. */
export async function buscarBancosDominio(): Promise<any[]> {
  const arr = await chamarIntegracao<any[]>("/dominios/bancos", "GET", undefined);
  return Array.isArray(arr) ? arr : [];
}

/** Busca a lista oficial de operações no provedor de integração. */
export async function buscarOperacoesDominio(): Promise<any[]> {
  const arr = await chamarIntegracao<any[]>("/dominios/operacoes", "GET", undefined);
  return Array.isArray(arr) ? arr : [];
}

/** Sincroniza os domínios da HomeFin com o banco local. */
export async function sincronizarDominiosIntegracao(): Promise<{ bancos: number; operacoes: number }> {
  const [bancosApi, operacoesApi] = await Promise.all([
    buscarBancosDominio(),
    buscarOperacoesDominio(),
  ]);
  const { supabaseAdmin: sbAdmin } = await import("@/integrations/supabase/client.server");

  // Atualiza bancos
  for (const b of bancosApi) {
    await sbAdmin.from("homefin_bancos").upsert({

      id_banco: Number(b.idBanco),
      codigo_banco: Number(b.codigoBanco),
      nome_banco: String(b.nomeBanco),
      flag_simulacao: b.flagSimulacao === "S" || b.flagSimulacao === true ? "S" : "N",
      updated_at: new Date().toISOString(),
    }, { onConflict: "id_banco" });
  }

  // Atualiza operações
  for (const o of operacoesApi) {
    await sbAdmin.from("homefin_operacoes").upsert({
      id_operacao: Number(o.idOperacao),
      nome_operacao: String(o.nomeOperacao),
      produto_sistema: String(o.produtoSistema || ""),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id_operacao" });
  }

  return { bancos: bancosApi.length, operacoes: operacoesApi.length };
}

/** Envia um arquivo binário para a integração bancária. */
export async function enviarArquivoIntegracao<T = unknown>(
  endpoint: string,
  arquivo: { bytes: Uint8Array; nome: string; mime: string },
  documentoAprovado: boolean,
  ctx: HomefinRequestCtx = {},
): Promise<T> {
  const { base } = config();
  const { token } = await obterToken();
  const url = `${base}${endpoint}`;
  const form = new FormData();
  form.append("arquivo", new Blob([arquivo.bytes as any], { type: arquivo.mime || "application/pdf" }), arquivo.nome);
  form.append("documentoAprovado", String(documentoAprovado));

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    await registrarLog({ ...ctx, endpoint, metodo: "POST", erro: String(e) });
    throw new IntegracaoBancariaError("O banco não respondeu no tempo esperado.");
  }

  const json = (await resp.json().catch(() => null)) as T;
  await registrarLog({ ...ctx, endpoint, metodo: "POST", status_http: resp.status, request: { arquivo: arquivo.nome, documentoAprovado }, response: json as any, erro: resp.ok ? undefined : `HTTP ${resp.status}` });
  if (!resp.ok) throw new IntegracaoBancariaError(humanizarRespostaErro(json, resp.status, endpoint), resp.status);
  return json;
}

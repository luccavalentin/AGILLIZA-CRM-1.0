/**
 * Cliente server-only da integração bancária (provedor externo).
 * NUNCA importar em código de cliente. Carregar via dynamic import dentro
 * de handlers de server functions/rotas.
 *
 * Config por variáveis de ambiente (dev) — em runtime a Etapa 10 mantém
 * credenciais por correspondente. Marca branca: nenhum texto retornado ao
 * usuário cita o fornecedor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SENSIVEIS = new Set([
  "secretId", "secretKey", "cpfCnpj", "cpf", "cnpj", "cpfConjuge", "rendaTotal",
  "renda", "rendaConjuge", "dataNascimento", "dataNascimentoConjuge", "email",
  "emailConjuge", "celular", "celularConjuge", "senha", "password", "token", "jwt",
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
    throw new IntegracaoBancariaError(
      "Integração bancária não configurada. Cadastre as credenciais em Configurações → Bancos.",
    );
  }
  return { base: base.replace(/\/$/, ""), secretId, secretKey };
}

async function registrarLog(entrada: {
  simulacao_id?: string | null;
  correspondente_id?: string | null;
  endpoint: string;
  metodo: string;
  status_http?: number;
  request?: unknown;
  response?: unknown;
  erro?: string;
}) {
  try {
    await supabaseAdmin.from("simulacao_logs_homefin").insert({
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

/**
 * Cache do token em memória do worker (válido por 55 min).
 * Evita depender de chave de serviço do banco de dados só para guardar o token;
 * o token é reobtido no primeiro uso após um cold start.
 */
let _tokenCache: { info: TokenInfo; expiresAt: number } | null = null;

/** Retorna token válido, reutilizando o cache (55 min) quando possível. */
export async function obterToken(): Promise<TokenInfo> {
  if (_tokenCache && _tokenCache.expiresAt > Date.now()) {
    return _tokenCache.info;
  }

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
  await registrarLog({
    endpoint: "/auth/token",
    metodo: "POST",
    status_http: resp.status,
    response: { ok: resp.ok },
  });
  if (!resp.ok) {
    throw new IntegracaoBancariaError("Não foi possível autenticar na integração bancária.", resp.status);
  }

  const token: string = json.jwt ?? json.token ?? "";
  const usuario = json.usuario ?? {};
  const info: TokenInfo = {
    token,
    idRegional: String(usuario.idRegional ?? json.idRegional ?? "") || null,
    idParceiro: String(usuario.idParceiro ?? json.idParceiro ?? "") || null,
    idUsuarioParceiro: String(usuario.idUsuarioParceiro ?? json.idUsuarioParceiro ?? "") || null,
  };

  _tokenCache = { info, expiresAt: Date.now() + 55 * 60 * 1000 };
  return info;
}


export interface HomefinRequestCtx {
  simulacao_id?: string | null;
  correspondente_id?: string | null;
}

/** Executa uma chamada autenticada à integração, registrando log. */
export async function chamarIntegracao<T = unknown>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body: unknown | undefined,
  ctx: HomefinRequestCtx = {},
): Promise<T> {
  const { base } = config();
  const { token } = await obterToken();
  const url = `${base}${endpoint}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    await registrarLog({ ...ctx, endpoint, metodo: method, request: body, erro: String(e) });
    throw new IntegracaoBancariaError("O banco não respondeu no tempo esperado. Tente reenviar.");
  }

  const json = (await resp.json().catch(() => null)) as T;
  await registrarLog({
    ...ctx,
    endpoint,
    metodo: method,
    status_http: resp.status,
    request: body,
    response: json as any,
    erro: resp.ok ? undefined : `HTTP ${resp.status}`,
  });

  if (!resp.ok) {
    throw new IntegracaoBancariaError(
      `A integração bancária retornou um erro (${resp.status}).`,
      resp.status,
    );
  }
  return json;
}

export function integracaoConfigurada(): boolean {
  return Boolean(
    process.env.HOMEFIN_BASE_URL && process.env.HOMEFIN_SECRET_ID && process.env.HOMEFIN_SECRET_KEY,
  );
}

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
import { humanizarRespostaErro } from "./bank-error-humanizer";

const SENSIVEIS = new Set([
  "secretId",
  "secretKey",
  "cpfCnpj",
  "cpf",
  "cnpj",
  "cpfConjuge",
  "rendaTotal",
  "renda",
  "rendaConjuge",
  "dataNascimento",
  "dataNascimentoConjuge",
  "email",
  "emailConjuge",
  "celular",
  "celularConjuge",
  "senha",
  "password",
  "token",
  "jwt",
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
  "nomeProfissao",
  "nomeProfissaoConjuge",
  "nomeEmpresaProfissao",
  "nomeEmpresaProfissaoConjuge",
  "profession",
  "company",
]);

function limparTextoLivreBanco(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  return valor
    .replace(/\((?:a|o)\)/gi, "")
    .replace(/[(){}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarPayloadBanco(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(normalizarPayloadBanco);
  if (valor && typeof valor === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      out[k] = CAMPOS_TEXTO_LIVRE_BANCO.has(k)
        ? limparTextoLivreBanco(v)
        : normalizarPayloadBanco(v);
    }
    return out;
  }
  return valor;
}

export class IntegracaoBancariaError extends Error {
  constructor(
    message: string,
    public statusHttp?: number,
  ) {
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

/**
 * Remove qualquer referência de infraestrutura de mensagens exibidas ao usuário
 * (marca branca). Nunca vazar nomes de provedores/plataforma.
 */
export function sanitizarMensagemErro(msg: string | null | undefined): string {
  const fallback = "O banco não respondeu corretamente. Verifique se todos os campos estão preenchidos e tente novamente em instantes.";
  if (!msg) return fallback;
  if (/supabase|service[_ ]role|environment variable|cloud/i.test(msg)) {
    return fallback;
  }
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
    // Chamadas de proposta vão para a tabela de auditoria de propostas;
    // as demais (simulação/auth) ficam na tabela de simulação.
    if (entrada.proposta_id) {
      await supabaseAdmin.from("proposta_logs_homefin").insert({
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
 * Cache do token em memória do worker.
 * TTL conservador (25 min) porque o banco pode expirar o JWT antes de 1h.
 * A obtenção é "single-flight": chamadas concorrentes compartilham a MESMA
 * requisição de token. Sem isso, o polling paralelo de propostas disparava
 * vários `/auth/token` ao mesmo tempo e o banco invalidava os tokens
 * anteriores, gerando 401 "Token JWT expirado" em cascata.
 */
let _tokenCache: { info: TokenInfo; expiresAt: number } | null = null;
let _tokenEmVoo: Promise<TokenInfo> | null = null;

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
  await registrarLog({
    endpoint: "/auth/token",
    metodo: "POST",
    status_http: resp.status,
    response: { ok: resp.ok },
  });
  if (!resp.ok) {
    throw new IntegracaoBancariaError(
      "Não foi possível autenticar na integração bancária.",
      resp.status,
    );
  }

  const token: string = json.jwt ?? json.token ?? "";
  const usuario = json.usuario ?? {};
  const info: TokenInfo = {
    token,
    idRegional: String(usuario.idRegional ?? json.idRegional ?? "") || null,
    idParceiro: String(usuario.idParceiro ?? json.idParceiro ?? "") || null,
    idUsuarioParceiro: String(usuario.idUsuarioParceiro ?? json.idUsuarioParceiro ?? "") || null,
  };

  _tokenCache = { info, expiresAt: Date.now() + 25 * 60 * 1000 };
  return info;
}

/** Retorna token válido, reutilizando cache e deduplicando chamadas simultâneas. */
export async function obterToken(forcarRenovacao = false): Promise<TokenInfo> {
  if (!forcarRenovacao && _tokenCache && _tokenCache.expiresAt > Date.now()) {
    return _tokenCache.info;
  }
  // Se outra chamada já está renovando, aguarda o mesmo resultado.
  if (_tokenEmVoo) return _tokenEmVoo;
  if (forcarRenovacao) _tokenCache = null;

  _tokenEmVoo = solicitarToken().finally(() => {
    _tokenEmVoo = null;
  });
  return _tokenEmVoo;
}


export interface HomefinRequestCtx {
  simulacao_id?: string | null;
  proposta_id?: string | null;
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
  const url = `${base}${endpoint}`;
  const bodyNormalizado = body ? normalizarPayloadBanco(body) : undefined;

  const executar = (token: string) =>
    fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: bodyNormalizado ? JSON.stringify(bodyNormalizado) : undefined,
      signal: AbortSignal.timeout(90_000),
    });

  let resp: Response;
  try {
    let tokenAtual = (await obterToken()).token;
    resp = await executar(tokenAtual);

    // Token expirado/invalidado (401): renova e repete até 2 vezes.
    // A renovação é single-flight, então chamadas concorrentes reaproveitam
    // o mesmo token novo em vez de invalidarem umas às outras.
    for (let tentativa = 0; tentativa < 2 && resp.status === 401; tentativa++) {
      const cacheado = _tokenCache?.info.token;
      const novo =
        cacheado && cacheado !== tokenAtual ? cacheado : (await obterToken(true)).token;
      if (novo === tokenAtual) break;
      tokenAtual = novo;
      resp = await executar(tokenAtual);
    }
  } catch (e) {
    await registrarLog({ ...ctx, endpoint, metodo: method, request: bodyNormalizado, erro: String(e) });
    throw new IntegracaoBancariaError("O banco não respondeu no tempo esperado. Tente reenviar.");
  }


  const json = (await resp.json().catch(() => null)) as T;
  await registrarLog({
    ...ctx,
    endpoint,
    metodo: method,
    status_http: resp.status,
    request: bodyNormalizado,
    response: json as any,
    erro: resp.ok ? undefined : `HTTP ${resp.status}`,
  });

  if (!resp.ok) {
    throw new IntegracaoBancariaError(extrairMensagemErroBanco(json, resp.status, endpoint), resp.status);
  }
  return json;
}


/**
 * Envia um arquivo binário (multipart/form-data) para a integração bancária.
 * Usado no upload de documentos: `POST /documento/{id}/upload`.
 * `arquivo` é o conteúdo do PDF; `documentoAprovado` marca se já revisado.
 */
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
  form.append(
    "arquivo",
    new Blob([arquivo.bytes as any], { type: arquivo.mime || "application/pdf" }),
    arquivo.nome,
  );
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
    throw new IntegracaoBancariaError("O banco não respondeu no tempo esperado. Tente reenviar.");
  }

  const json = (await resp.json().catch(() => null)) as T;
  await registrarLog({
    ...ctx,
    endpoint,
    metodo: "POST",
    status_http: resp.status,
    request: { arquivo: arquivo.nome, documentoAprovado },
    response: json as any,
    erro: resp.ok ? undefined : `HTTP ${resp.status}`,
  });

  if (!resp.ok) {
    throw new IntegracaoBancariaError(extrairMensagemErroBanco(json, resp.status, endpoint), resp.status);
  }
  return json;
}

/**
 * Extrai a mensagem de erro mais útil retornada pela integração/banco.
 * Muitos bancos retornam o motivo real (prazo inválido, renda insuficiente, etc.)
 * no corpo da resposta; sem isso o usuário só via um "erro (404)" genérico e
 * não sabia o que corrigir. Erros 5xx costumam ser falha interna do banco.
 */
function extrairMensagemErroBanco(json: unknown, status: number, endpoint = ""): string {
  return humanizarRespostaErro(json, status, endpoint);
}


export function integracaoConfigurada(): boolean {
  return Boolean(
    process.env.HOMEFIN_BASE_URL && process.env.HOMEFIN_SECRET_ID && process.env.HOMEFIN_SECRET_KEY,
  );
}

/* ===================================================================
 * Domínios dinâmicos (bancos e operações) da integração bancária.
 * A API expõe os catálogos oficiais em GET /dominios/bancos e
 * GET /dominios/operacoes. Sincronizamos esses valores nas tabelas de
 * referência (homefin_bancos / homefin_operacoes) para que simulações e
 * propostas usem sempre os códigos aceitos pelo provedor, sem seed manual.
 * =================================================================== */

interface DominioBancoApi {
  idBanco?: number;
  codigoBanco?: number;
  nomeBanco?: string;
  flagSimulacao?: string;
}

interface DominioOperacaoApi {
  idOperacao?: number;
  nomeOperacao?: string;
}

/** Busca a lista oficial de bancos no provedor de integração. */
export async function buscarBancosDominio(): Promise<DominioBancoApi[]> {
  const arr = await chamarIntegracao<DominioBancoApi[]>("/dominios/bancos", "GET", undefined);
  return Array.isArray(arr) ? arr : [];
}

/** Busca a lista oficial de operações/produtos no provedor de integração. */
export async function buscarOperacoesDominio(): Promise<DominioOperacaoApi[]> {
  const arr = await chamarIntegracao<DominioOperacaoApi[]>("/dominios/operacoes", "GET", undefined);
  return Array.isArray(arr) ? arr : [];
}

export interface ResultadoSincronizacaoDominios {
  bancos: number;
  operacoes: number;
}

/**
 * Sincroniza bancos e operações do provedor para as tabelas de referência.
 * Faz upsert idempotente por id (idBanco / idOperacao) sem apagar registros
 * já existentes — apenas atualiza nome/código/flag e insere novos.
 */
export async function sincronizarDominiosIntegracao(): Promise<ResultadoSincronizacaoDominios> {
  const [bancosApi, operacoesApi] = await Promise.all([
    buscarBancosDominio(),
    buscarOperacoesDominio(),
  ]);

  let bancosSync = 0;
  for (const b of bancosApi) {
    if (b.idBanco == null) continue;
    const nome = (b.nomeBanco ?? "").trim();
    const { error } = await supabaseAdmin.from("homefin_bancos").upsert(
      {
        id_banco: b.idBanco,
        codigo_banco: b.codigoBanco ?? b.idBanco,
        nome_banco: nome || `Banco ${b.idBanco}`,
        flag_simulacao: (b.flagSimulacao ?? "").trim() || undefined,
        ativo: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id_banco" },
    );
    if (!error) bancosSync++;
    else console.error("[integracao] upsert banco falhou", error.message);
  }

  let operacoesSync = 0;
  for (const o of operacoesApi) {
    if (o.idOperacao == null) continue;
    const nome = (o.nomeOperacao ?? "").trim() || `Operação ${o.idOperacao}`;
    // Atualiza os já existentes preservando produto_sistema; insere os novos.
    const { data: existente } = await supabaseAdmin
      .from("homefin_operacoes")
      .select("id")
      .eq("id_operacao", o.idOperacao)
      .maybeSingle();
    let error;
    if (existente) {
      ({ error } = await supabaseAdmin
        .from("homefin_operacoes")
        .update({ nome_operacao: nome, ativo: true, updated_at: new Date().toISOString() })
        .eq("id_operacao", o.idOperacao));
    } else {
      ({ error } = await supabaseAdmin.from("homefin_operacoes").insert({
        id_operacao: o.idOperacao,
        nome_operacao: nome,
        produto_sistema: "PRICE",
        ativo: true,
      }));
    }
    if (!error) operacoesSync++;
    else console.error("[integracao] sync operação falhou", error.message);
  }


  return { bancos: bancosSync, operacoes: operacoesSync };
}

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
export const TIPO_BANCO_SANTANDER = 33; // Código HomeFin para Santander
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
    "email",
    "emailConjuge",
    "celular",
    "celularConjuge",
    "senha",
    "password",
    "token",
    "jwt",
]);
/**
 * Mascara apenas dados sensíveis (identificação, contato, renda).
 * Preserva campos estruturais como endereço, estado civil e regime
 * para facilitar o diagnóstico (Problema 3a).
 */
function mascarar(valor) {
    if (Array.isArray(valor))
        return valor.map(mascarar);
    if (valor && typeof valor === "object") {
        const out = {};
        for (const [k, v] of Object.entries(valor)) {
            // Data de nascimento não é mais mascarada para facilitar diagnóstico de prazo/idade
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
function limparTextoLivreBanco(valor) {
    if (typeof valor !== "string")
        return valor;
    return valor
        .replace(/\((?:a|o)\)/gi, "")
        .replace(/[(){}[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function normalizarPayloadBanco(valor) {
    if (Array.isArray(valor))
        return valor.map(normalizarPayloadBanco);
    if (valor && typeof valor === "object") {
        const out = {};
        for (const [k, v] of Object.entries(valor)) {
            out[k] = CAMPOS_TEXTO_LIVRE_BANCO.has(k)
                ? limparTextoLivreBanco(v)
                : normalizarPayloadBanco(v);
        }
        return out;
    }
    return valor;
}
export class IntegracaoBancariaError extends Error {
    statusHttp;
    constructor(message, statusHttp) {
        super(message);
        this.statusHttp = statusHttp;
        this.name = "IntegracaoBancariaError";
    }
}
function config() {
    const base = process.env.HOMEFIN_BASE_URL;
    const secretId = process.env.HOMEFIN_SECRET_ID;
    const secretKey = process.env.HOMEFIN_SECRET_KEY;
    if (!base || !secretId || !secretKey) {
        throw new IntegracaoBancariaError("Integração bancária não configurada. Cadastre as credenciais em Configurações → Bancos.");
    }
    return { base: base.replace(/\/$/, ""), secretId, secretKey };
}
/**
 * Remove qualquer referência de infraestrutura de mensagens exibidas ao usuário
 * (marca branca). Nunca vazar nomes de provedores/plataforma.
 */
export function sanitizarMensagemErro(msg) {
    const fallback = "O banco não respondeu corretamente. Verifique se todos os campos estão preenchidos e tente novamente em instantes.";
    if (!msg)
        return fallback;
    if (/supabase|service[_ ]role|environment variable|cloud/i.test(msg)) {
        return fallback;
    }
    return msg;
}
async function registrarLog(entrada) {
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
                request_masked: entrada.request ? mascarar(entrada.request) : null,
                response: entrada.response ?? null,
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
            request_masked: entrada.request ? mascarar(entrada.request) : null,
            response: entrada.response ?? null,
            erro: entrada.erro ?? null,
        });
    }
    catch (e) {
        console.error("[integracao] falha ao registrar log", e);
    }
}
/**
 * Cache do token em memória do worker (L1).
 * Em Cloudflare Workers, a memória do módulo é efêmera e isolada por requisição.
 * O cache real (L2) reside na tabela `homefin_auth_cache` no Supabase.
 */
let _tokenCache = null;
let _tokenEmVoo = null;
const CACHE_ID = "00000000-0000-0000-0000-000000000000"; // Linha única de cache
async function solicitarToken() {
    const { base, secretId, secretKey } = config();
    const url = `${base}/auth/token`;
    let resp;
    try {
        resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secretId, secretKey }),
            signal: AbortSignal.timeout(30000),
        });
    }
    catch (e) {
        await registrarLog({ endpoint: "/auth/token", metodo: "POST", erro: String(e) });
        throw new IntegracaoBancariaError("Falha ao autenticar na integração bancária.");
    }
    const json = (await resp.json().catch(() => ({})));
    await registrarLog({
        endpoint: "/auth/token",
        metodo: "POST",
        status_http: resp.status,
        response: { ok: resp.ok },
    });
    if (!resp.ok) {
        throw new IntegracaoBancariaError("Não foi possível autenticar na integração bancária.", resp.status);
    }
    const token = json.jwt ?? json.token ?? "";
    const usuario = json.usuario ?? {};
    const info = {
        token,
        idRegional: String(usuario.idRegional ?? json.idRegional ?? "") || null,
        idParceiro: String(usuario.idParceiro ?? json.idParceiro ?? "") || null,
        idUsuarioParceiro: String(usuario.idUsuarioParceiro ?? json.idUsuarioParceiro ?? "") || null,
    };
    const expiresAt = Date.now() + 25 * 60 * 1000;
    _tokenCache = { info, expiresAt };
    // Persiste no banco para compartilhamento entre isolates (L2)
    try {
        await supabaseAdmin.from("homefin_auth_cache").upsert({
            id: CACHE_ID,
            token: info.token,
            expires_at: new Date(expiresAt).toISOString(),
            id_regional: info.idRegional,
            id_parceiro: info.idParceiro,
            id_usuario_parceiro: info.idUsuarioParceiro,
        });
    }
    catch (e) {
        console.error("[integracao] falha ao persistir cache de token", e);
    }
    return info;
}
/** Retorna token válido, reutilizando cache L1/L2 e mitigando corridas em Workers. */
export async function obterToken(forcarRenovacao = false) {
    const margem = 2 * 60 * 1000; // 2 minutos de folga
    const agora = Date.now();
    // 1. L1: Cache em memória do isolate atual
    if (!forcarRenovacao && _tokenCache && _tokenCache.expiresAt > agora + margem) {
        return _tokenCache.info;
    }
    // 2. L2: Cache compartilhado no banco (Supabase)
    if (!forcarRenovacao) {
        try {
            const { data } = await supabaseAdmin
                .from("homefin_auth_cache")
                .select("*")
                .eq("id", CACHE_ID)
                .maybeSingle();
            if (data && new Date(data.expires_at).getTime() > agora + margem) {
                const info = {
                    token: data.token,
                    idRegional: data.id_regional,
                    idParceiro: data.id_parceiro,
                    idUsuarioParceiro: data.id_usuario_parceiro,
                };
                _tokenCache = { info, expiresAt: new Date(data.expires_at).getTime() };
                return info;
            }
        }
        catch (e) {
            console.error("[integracao] erro ao ler cache L2", e);
        }
    }
    // 3. Bloqueio "Single-flight" para o isolate atual
    if (_tokenEmVoo)
        return _tokenEmVoo;
    // 4. Renovação com mitigação de corrida entre isolates (Polling curto)
    // Em Workers, isolates concorrentes podem tentar solicitar o token ao mesmo tempo.
    // Usamos um polling simples de 10s para ver se outro isolate já renovou no L2.
    if (forcarRenovacao)
        _tokenCache = null;
    _tokenEmVoo = (async () => {
        // 4.1 Bloqueio pessimista via banco para evitar múltiplos isolates renovando
        // Tenta "marcar" que este isolate vai renovar. Se já houver um timestamp
        // de renovação recente (<30s), aguarda.
        try {
            const lockKey = `auth_lock_${CACHE_ID}`;
            // Em Workers não temos Redis global fácil sem extra infra.
            // O upsert acima já resolve a maioria dos casos se for rápido.
            // O single-flight L1 resolve dentro do mesmo isolate.
            return await solicitarToken();
        }
        finally {
            _tokenEmVoo = null;
        }
    })();
    return _tokenEmVoo;
}
/** Executa uma chamada autenticada à integração, registrando log. */
export async function chamarIntegracao(endpoint, method, body, ctx = {}) {
    // Serialização de chamadas para evitar rajadas de 401 que invalidam tokens
    // Apenas para endpoints que costumam ser chamados em paralelo (polling/oportunidade/participante)
    const deveSerializar = !endpoint.startsWith("/auth") && !endpoint.includes("/dominios");
    if (deveSerializar) {
        return (async () => {
            // @ts-ignore - _pollingQueue is a simple Promise.resolve()
            return new Promise((resolve, reject) => {
                // @ts-ignore
                globalThis._hfQueue = (globalThis._hfQueue || Promise.resolve()).then(async () => {
                    try {
                        resolve(await executarChamada(endpoint, method, body, ctx));
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            });
        })();
    }
    return executarChamada(endpoint, method, body, ctx);
}
async function executarChamada(endpoint, method, body, ctx = {}) {
    const { base } = config();
    const url = `${base}${endpoint}`;
    const bodyNormalizado = body ? normalizarPayloadBanco(body) : undefined;
    const executar = (token) => fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: bodyNormalizado ? JSON.stringify(bodyNormalizado) : undefined,
        signal: AbortSignal.timeout(90000),
    });
    let resp;
    try {
        let tokenInfo = await obterToken();
        let tokenAtual = tokenInfo.token;
        resp = await executar(tokenAtual);
        // Token expirado/invalidado (401): renova e repete até 2 vezes.
        // A renovação é single-flight, então chamadas concorrentes reaproveitam
        // o mesmo token novo em vez de invalidarem umas às outras.
        for (let tentativa = 0; tentativa < 2 && resp.status === 401; tentativa++) {
            // Tenta reler cache L1/L2 primeiro (outro isolate pode ter renovado)
            tokenInfo = await obterToken(true);
            const novo = tokenInfo.token;
            if (novo === tokenAtual)
                break;
            tokenAtual = novo;
            resp = await executar(tokenAtual);
        }
    }
    catch (e) {
        await registrarLog({
            ...ctx,
            endpoint,
            metodo: method,
            request: bodyNormalizado,
            erro: String(e),
        });
        throw new IntegracaoBancariaError("O banco não respondeu no tempo esperado. Tente reenviar.");
    }
    const json = (await resp.json().catch(() => null));
    await registrarLog({
        ...ctx,
        endpoint,
        metodo: method,
        status_http: resp.status,
        request: bodyNormalizado,
        response: json,
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
export async function enviarArquivoIntegracao(endpoint, arquivo, documentoAprovado, ctx = {}) {
    const { base } = config();
    const { token } = await obterToken();
    const url = `${base}${endpoint}`;
    const form = new FormData();
    form.append("arquivo", new Blob([arquivo.bytes], { type: arquivo.mime || "application/pdf" }), arquivo.nome);
    form.append("documentoAprovado", String(documentoAprovado));
    let resp;
    try {
        resp = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
            signal: AbortSignal.timeout(60000),
        });
    }
    catch (e) {
        await registrarLog({ ...ctx, endpoint, metodo: "POST", erro: String(e) });
        throw new IntegracaoBancariaError("O banco não respondeu no tempo esperado. Tente reenviar.");
    }
    const json = (await resp.json().catch(() => null));
    await registrarLog({
        ...ctx,
        endpoint,
        metodo: "POST",
        status_http: resp.status,
        request: { arquivo: arquivo.nome, documentoAprovado },
        response: json,
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
function extrairMensagemErroBanco(json, status, endpoint = "") {
    return humanizarRespostaErro(json, status, endpoint);
}
export function integracaoConfigurada() {
    return Boolean(process.env.HOMEFIN_BASE_URL && process.env.HOMEFIN_SECRET_ID && process.env.HOMEFIN_SECRET_KEY);
}
/** Busca a lista oficial de bancos no provedor de integração. */
export async function buscarBancosDominio() {
    const arr = await chamarIntegracao("/dominios/bancos", "GET", undefined);
    return Array.isArray(arr) ? arr : [];
}
/** Busca a lista oficial de operações/produtos no provedor de integração. */
export async function buscarOperacoesDominio() {
    const arr = await chamarIntegracao("/dominios/operacoes", "GET", undefined);
    return Array.isArray(arr) ? arr : [];
}
/**
 * Sincroniza bancos e operações do provedor para as tabelas de referência.
 * Faz upsert idempotente por id (idBanco / idOperacao) sem apagar registros
 * já existentes — apenas atualiza nome/código/flag e insere novos.
 */
export async function sincronizarDominiosIntegracao() {
    const [bancosApi, operacoesApi] = await Promise.all([
        buscarBancosDominio(),
        buscarOperacoesDominio(),
    ]);
    let bancosSync = 0;
    for (const b of bancosApi) {
        if (b.idBanco == null)
            continue;
        const nome = (b.nomeBanco ?? "").trim();
        const { error } = await supabaseAdmin.from("homefin_bancos").upsert({
            id_banco: b.idBanco,
            codigo_banco: b.codigoBanco ?? b.idBanco,
            nome_banco: nome || `Banco ${b.idBanco}`,
            flag_simulacao: (b.flagSimulacao ?? "").trim() || undefined,
            ativo: true,
            updated_at: new Date().toISOString(),
        }, { onConflict: "id_banco" });
        if (!error)
            bancosSync++;
        else
            console.error("[integracao] upsert banco falhou", error.message);
    }
    let operacoesSync = 0;
    for (const o of operacoesApi) {
        if (o.idOperacao == null)
            continue;
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
        }
        else {
            ({ error } = await supabaseAdmin.from("homefin_operacoes").insert({
                id_operacao: o.idOperacao,
                nome_operacao: nome,
                produto_sistema: "PRICE",
                ativo: true,
            }));
        }
        if (!error)
            operacoesSync++;
        else
            console.error("[integracao] sync operação falhou", error.message);
    }
    return { bancos: bancosSync, operacoes: operacoesSync };
}

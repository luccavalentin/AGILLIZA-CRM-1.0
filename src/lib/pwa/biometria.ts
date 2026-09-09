/**
 * Desbloqueio por biometria (impressão digital / rosto) via WebAuthn.
 *
 * O que isto é: uma TRAVA DE APARELHO, igual à do app do banco quando ele
 * pede a digital para reabrir a tela. A sessão do Supabase continua sendo a
 * fonte de verdade da autenticação; a biometria só decide se a tela destrava.
 *
 * O que isto NÃO é: login sem senha. Login sem senha exigiria o servidor
 * guardar a chave pública e conferir a assinatura de cada acesso (passkey
 * completa). Aqui a conferência é local, então o ganho é impedir que alguém
 * que pegou o celular destravado entre no sistema — não substitui a senha.
 *
 * Requisitos do navegador: HTTPS, autenticador de plataforma (digital, Face
 * ID, Windows Hello). Em iPhone/iPad funciona no Safari e no app instalado.
 */

const CHAVE = "agilliza:biometria";

interface RegistroBiometria {
  /** Id da credencial em base64url. */
  credentialId: string;
  email: string | null;
  criadoEm: string;
}

type Mapa = Record<string, RegistroBiometria>;

export type CodigoErroBiometria =
  | "cancelado"
  | "ja-cadastrado"
  | "nao-suportado"
  | "dominio"
  | "iframe"
  | "inseguro"
  | "sem-leitor"
  | "desconhecido";

/** Erro de biometria com causa identificada, para a tela poder explicar. */
export class ErroBiometria extends Error {
  constructor(
    public readonly codigo: CodigoErroBiometria,
    /** Nome do DOMException original, quando houver. Ajuda no diagnóstico. */
    public readonly origem?: string,
  ) {
    super(mensagemErroBiometria(codigo));
    this.name = "ErroBiometria";
  }
}

export function mensagemErroBiometria(codigo: CodigoErroBiometria): string {
  switch (codigo) {
    case "cancelado":
      return "O aparelho não confirmou a biometria. Isso acontece quando o pedido é cancelado, quando ele expira ou quando a digital/rosto não está configurada no sistema.";
    case "ja-cadastrado":
      return "Este aparelho já tem uma credencial cadastrada para esta conta. Desative e ative de novo para recadastrar.";
    case "nao-suportado":
      return "Este aparelho não oferece leitor de digital, Face ID ou Windows Hello para o navegador.";
    case "dominio":
      return "O endereço em que o sistema está aberto não permite biometria. Use o domínio oficial do sistema (https).";
    case "iframe":
      return "A biometria não funciona com o sistema aberto dentro de outra página (preview/iframe). Abra o sistema direto no navegador ou pelo app instalado.";
    case "inseguro":
      return "A biometria exige conexão segura (https). Em http, o navegador bloqueia.";
    case "sem-leitor":
      return "Não encontramos digital, Face ID ou Windows Hello disponível neste aparelho.";
    default:
      return "Não foi possível usar a biometria neste aparelho.";
  }
}

function codigoDoErro(e: unknown): CodigoErroBiometria {
  const nome = (e as { name?: string } | null)?.name ?? "";
  if (nome === "NotAllowedError" || nome === "AbortError") return "cancelado";
  if (nome === "InvalidStateError") return "ja-cadastrado";
  if (nome === "NotSupportedError") return "nao-suportado";
  if (nome === "SecurityError") return "dominio";
  return "desconhecido";
}

/**
 * Por que a biometria não pode ser usada agora — ou `null` se pode.
 * Checagem barata e síncrona, feita antes do clique.
 */
export function impedimentoBiometria(): CodigoErroBiometria | null {
  if (typeof window === "undefined") return "nao-suportado";
  if (!window.PublicKeyCredential) return "nao-suportado";
  if (!window.isSecureContext) return "inseguro";
  // Em iframe de origem diferente o navegador recusa a criação da credencial.
  if (window.self !== window.top) return "iframe";
  return null;
}

function paraBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// `Uint8Array<ArrayBuffer>` (e não o genérico `ArrayBufferLike`) porque a
// WebAuthn tipa os campos como `BufferSource`, que não aceita SharedArrayBuffer.
function deBase64Url(txt: string): Uint8Array<ArrayBuffer> {
  const b64 = txt.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function paraBytes(txt: string): Uint8Array<ArrayBuffer> {
  const origem = new TextEncoder().encode(txt);
  const destino = new Uint8Array(new ArrayBuffer(origem.length));
  destino.set(origem);
  return destino;
}

function lerMapa(): Mapa {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as Mapa) : {};
  } catch {
    return {};
  }
}

function salvarMapa(m: Mapa): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

/** O aparelho tem digital/rosto/Windows Hello disponível para o site? */
export async function biometriaDisponivel(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  if (!window.isSecureContext) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** O usuário já cadastrou a biometria neste aparelho? */
export function biometriaAtiva(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return Boolean(lerMapa()[userId]);
}

export function desativarBiometria(userId: string): void {
  const m = lerMapa();
  delete m[userId];
  salvarMapa(m);
  limparSessaoBiometria(userId);
}

function desafio(): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(32));
  crypto.getRandomValues(b);
  return b;
}

/**
 * Cadastra a digital/rosto do aparelho para este usuário.
 *
 * Nada de `await` antes do `credentials.create`: em Safari/iOS a criação da
 * credencial exige o gesto do usuário ainda "quente", e qualquer espera no
 * meio derruba essa permissão — era o motivo de o cadastro voltar como
 * "cancelado pelo aparelho" mesmo sem o usuário cancelar nada.
 *
 * Lança `ErroBiometria` com a causa identificada.
 */
export async function registrarBiometria(params: {
  userId: string;
  email: string | null;
  nome: string | null;
}): Promise<void> {
  const impedimento = impedimentoBiometria();
  if (impedimento) throw new ErroBiometria(impedimento);

  let cred: PublicKeyCredential | null = null;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        challenge: desafio(),
        rp: { name: "Agilliza" },
        user: {
          id: paraBytes(params.userId),
          name: params.email ?? params.userId,
          displayName: params.nome ?? params.email ?? "Usuário Agilliza",
        },
        // ES256 e RS256 cobrem praticamente todos os autenticadores.
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          // "discouraged" de propósito: com "preferred" o Android tenta criar
          // uma passkey descobrível no Gerenciador de Senhas do Google, o que
          // exige conta Google ativa no Chrome e falha como "NotAllowedError"
          // quando não dá. Aqui guardamos o id da credencial e o enviamos em
          // `allowCredentials`, então nada precisa ser descobrível.
          residentKey: "discouraged",
          requireResidentKey: false,
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
  } catch (e) {
    throw new ErroBiometria(codigoDoErro(e), (e as { name?: string } | null)?.name);
  }

  if (!cred) throw new ErroBiometria("cancelado");

  const m = lerMapa();
  m[params.userId] = {
    credentialId: paraBase64Url(cred.rawId),
    email: params.email,
    criadoEm: new Date().toISOString(),
  };
  salvarMapa(m);
}

/** Conta cadastrada mais recentemente neste aparelho, se houver. */
export function ultimaBiometria(): { userId: string; email: string | null } | null {
  const m = lerMapa();
  const entradas = Object.entries(m);
  if (entradas.length === 0) return null;
  entradas.sort((a, b) => (a[1].criadoEm < b[1].criadoEm ? 1 : -1));
  const [userId, registro] = entradas[0];
  return { userId, email: registro.email };
}

export interface ResultadoBiometria {
  ok: boolean;
  codigo?: CodigoErroBiometria;
}

/**
 * Pede a biometria e diz se o aparelho confirmou a identidade.
 *
 * Como no cadastro, não há `await` antes do `credentials.get`: a espera
 * consome o gesto do usuário e o navegador recusa o pedido.
 */
export async function verificarBiometria(userId: string): Promise<ResultadoBiometria> {
  const registro = lerMapa()[userId];
  if (!registro) return { ok: false, codigo: "sem-leitor" };

  const impedimento = impedimentoBiometria();
  if (impedimento) return { ok: false, codigo: impedimento };

  try {
    const assercao = (await navigator.credentials.get({
      publicKey: {
        challenge: desafio(),
        allowCredentials: [
          {
            type: "public-key",
            id: deBase64Url(registro.credentialId),
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    if (!assercao) return { ok: false, codigo: "cancelado" };
    // Confirma que o autenticador respondeu com a credencial que cadastramos.
    if (paraBase64Url(assercao.rawId) !== registro.credentialId) {
      return { ok: false, codigo: "desconhecido" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, codigo: codigoDoErro(e) };
  }
}

/* ------------------------------------------------------------------ *
 * Estado de destravamento da sessão do app (usado pela tela de bloqueio)
 * ------------------------------------------------------------------ */

const CHAVE_DESBLOQUEIO = "agilliza:app-desbloqueado";

/** Marca a sessão atual do navegador como já destravada. */
export function marcarAppDesbloqueado(): void {
  try {
    sessionStorage.setItem(CHAVE_DESBLOQUEIO, "1");
  } catch {
    /* ignore */
  }
}

export function appDesbloqueado(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_DESBLOQUEIO) === "1";
  } catch {
    return false;
  }
}

export function limparDesbloqueioApp(): void {
  try {
    sessionStorage.removeItem(CHAVE_DESBLOQUEIO);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Sessão guardada atrás da biometria
 * ------------------------------------------------------------------ */

/**
 * Para a digital realmente ENTRAR (e não só destravar uma sessão que já
 * estava aberta), guardamos os tokens da sessão junto da credencial. Depois
 * da digital confirmada, a sessão é restaurada com `setSession`.
 *
 * Sobre o risco: o cliente do Supabase já mantém a sessão no localStorage
 * deste mesmo domínio (`persistSession: true`), então isto não abre uma
 * porta nova — é a mesma gaveta. O que muda é que a cópia sobrevive ao
 * "Sair" e só é usada depois que o aparelho confirma a biometria.
 *
 * O refresh token do Supabase gira a cada renovação: por isso a cópia é
 * atualizada em todo `TOKEN_REFRESHED` (ver `sessao-biometria-sync`).
 */
const CHAVE_SESSAO = "agilliza:biometria-sessao";

export interface SessaoGuardada {
  access_token: string;
  refresh_token: string;
  atualizadoEm: string;
}

type MapaSessao = Record<string, SessaoGuardada>;

function lerMapaSessao(): MapaSessao {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHAVE_SESSAO);
    return raw ? (JSON.parse(raw) as MapaSessao) : {};
  } catch {
    return {};
  }
}

function salvarMapaSessao(m: MapaSessao): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_SESSAO, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

/** Guarda/atualiza a sessão protegida pela biometria deste usuário. */
export function guardarSessaoBiometria(
  userId: string,
  tokens: { access_token: string; refresh_token: string },
): void {
  if (!biometriaAtiva(userId)) return;
  const m = lerMapaSessao();
  m[userId] = { ...tokens, atualizadoEm: new Date().toISOString() };
  salvarMapaSessao(m);
}

export function lerSessaoBiometria(userId: string): SessaoGuardada | null {
  return lerMapaSessao()[userId] ?? null;
}

export function limparSessaoBiometria(userId?: string): void {
  if (!userId) {
    salvarMapaSessao({});
    return;
  }
  const m = lerMapaSessao();
  delete m[userId];
  salvarMapaSessao(m);
}

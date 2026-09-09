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
}

function desafio(): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(32));
  crypto.getRandomValues(b);
  return b;
}

/**
 * Cadastra a digital/rosto do aparelho para este usuário.
 * Devolve `false` se o usuário cancelou o prompt do sistema.
 */
export async function registrarBiometria(params: {
  userId: string;
  email: string | null;
  nome: string | null;
}): Promise<boolean> {
  if (!(await biometriaDisponivel())) return false;

  const cred = (await navigator.credentials.create({
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
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) return false;

  const m = lerMapa();
  m[params.userId] = {
    credentialId: paraBase64Url(cred.rawId),
    email: params.email,
    criadoEm: new Date().toISOString(),
  };
  salvarMapa(m);
  return true;
}

/**
 * Pede a biometria e diz se o aparelho confirmou a identidade.
 * Devolve `false` em cancelamento, timeout ou credencial desconhecida.
 */
export async function verificarBiometria(userId: string): Promise<boolean> {
  const registro = lerMapa()[userId];
  if (!registro) return false;
  if (!(await biometriaDisponivel())) return false;

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

    if (!assercao) return false;
    // Confirma que o autenticador respondeu com a credencial que cadastramos.
    return paraBase64Url(assercao.rawId) === registro.credentialId;
  } catch {
    return false;
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

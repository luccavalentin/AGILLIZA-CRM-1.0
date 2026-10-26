/**
 * Arquivos da plataforma (capa da News, anexos do suporte, fotos do marketplace) vistos e
 * enviados pelo Agilliza.
 *
 * Os bytes moram no armazenamento do Agilliza Tech (disco hoje, R2 quando ligado); o
 * registro mora em `integracao.midias`. Divisão de papéis:
 *   · **quem pode** é sempre o banco: a linha da mídia é lida (ou gravada) com o contexto
 *     de plataforma da pessoa (`comPlataforma`), sob a RLS de sempre — se ela não aparece,
 *     não existe para essa pessoa;
 *   · **os bytes** vêm e vão pela rota interna do Corretor (`/api/interno/midias`), na rede
 *     interna da VPS, com assinatura HMAC de validade curta (`PONTE_MIDIAS_SEGREDO`, o mesmo
 *     segredo nos dois servidores).
 *
 * O navegador não manda o token do Agilliza numa `<img>`; por isso cada mídia liberada vira
 * um endereço SELADO (`/api/plataforma/midia?t=…`): a chave do arquivo vai cifrada
 * (AES-256-GCM) com validade de 1 hora, e só este servidor abre o selo. Ninguém monta um
 * endereço à mão para ler arquivo de outra conta.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

type Tx = {
  consultar<T>(sql: string, params?: unknown[]): Promise<T[]>;
  uma<T>(sql: string, params?: unknown[]): Promise<T | null>;
};

export type MidiaLiberada = { url: string; nome: string; mime: string; bytes: number };

const VALIDADE_SELO_S = 60 * 60;

function segredo(): string {
  const s = process.env.PONTE_MIDIAS_SEGREDO ?? "";
  if (s.length < 32)
    throw new Error("Arquivos indisponíveis: a ponte de arquivos não está configurada.");
  return s;
}

function baseCorretor(): string {
  return (process.env.CORRETOR_INTERNO_URL ?? "http://corretor-web:3000").replace(/\/$/, "");
}

const chaveDoSelo = () => createHash("sha256").update(`selo-midia:${segredo()}`).digest();

function selar(dados: { k: string; m: string; n: string }): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chaveDoSelo(), iv);
  const corpo = Buffer.concat([
    c.update(JSON.stringify({ ...dados, e: Math.floor(Date.now() / 1000) + VALIDADE_SELO_S })),
    c.final(),
  ]);
  return Buffer.concat([iv, c.getAuthTag(), corpo]).toString("base64url");
}

/**
 * Endereço selado de um arquivo cuja chave veio de uma função da plataforma que já conferiu
 * a permissão (ex.: as fotos dos anúncios em `plataforma.imobmatch_*`, 0283). Sem a ponte de
 * arquivos configurada, `null` (a tela mostra o lugar da foto vazio).
 */
export function selarArquivo(chave: string, mime: string, nome: string): string | null {
  if ((process.env.PONTE_MIDIAS_SEGREDO ?? "").length < 32) return null;
  return `/api/plataforma/midia?t=${selar({ k: chave, m: mime, n: nome })}`;
}

/** Abre o selo; `null` se adulterado, de outro segredo ou vencido. */
export function abrirSelo(token: string): { k: string; m: string; n: string } | null {
  try {
    const b = Buffer.from(token, "base64url");
    if (b.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", chaveDoSelo(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    const j = JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8")) as {
      k: string;
      m: string;
      n: string;
      e: number;
    };
    return j.e >= Math.floor(Date.now() / 1000) ? { k: j.k, m: j.m, n: j.n } : null;
  } catch {
    return null;
  }
}

function assinatura(metodo: string, alvo: string): string {
  const expira = Math.floor(Date.now() / 1000) + 60;
  const hmac = createHmac("sha256", segredo())
    .update(`${metodo}\n${expira}\n${alvo}`)
    .digest("hex");
  return `${expira}.${hmac}`;
}

/**
 * Endereços selados das mídias que a pessoa pode ver (a consulta roda com o contexto dela).
 * Ids que a RLS esconde, apagados ou ainda em processamento simplesmente não voltam.
 */
export async function liberarMidias(tx: Tx, ids: Array<string | null | undefined>) {
  const lista = [...new Set(ids.filter((i): i is string => !!i))];
  const saida: Record<string, MidiaLiberada> = {};
  if (!lista.length || (process.env.PONTE_MIDIAS_SEGREDO ?? "").length < 32) return saida;
  const linhas = await tx.consultar<{
    id: string;
    r2_key: string;
    mime: string | null;
    nome_original: string | null;
    bytes: number | null;
  }>(
    `select id, r2_key, mime, nome_original, bytes::float8 as bytes
       from integracao.midias
      where id = any($1::uuid[]) and deleted_at is null and status_processamento = 'pronto'
        and r2_key is not null`,
    [lista],
  );
  for (const l of linhas) {
    const nome = l.nome_original ?? "arquivo";
    const mime = l.mime ?? "application/octet-stream";
    saida[l.id] = {
      url: `/api/plataforma/midia?t=${selar({ k: l.r2_key, m: mime, n: nome })}`,
      nome,
      mime,
      bytes: Number(l.bytes ?? 0),
    };
  }
  return saida;
}

/**
 * Bytes de um arquivo, pedidos ao Corretor pela rota interna. `range` (uma faixa só, já
 * conferida por quem chama) vai adiante: o Corretor lê só o pedaço, em fluxo (auditoria rodada 2).
 */
export async function lerDoCorretor(chave: string, range: string | null = null): Promise<Response> {
  return fetch(`${baseCorretor()}/api/interno/midias?chave=${encodeURIComponent(chave)}`, {
    headers: { "x-ponte-assinatura": assinatura("GET", chave), ...(range ? { range } : {}) },
    signal: AbortSignal.timeout(30_000),
  });
}

export async function apagarNoCorretor(chave: string): Promise<void> {
  await fetch(`${baseCorretor()}/api/interno/midias?chave=${encodeURIComponent(chave)}`, {
    method: "DELETE",
    headers: { "x-ponte-assinatura": assinatura("DELETE", chave) },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => undefined);
}

/** Guarda os bytes no armazenamento do Corretor; a pasta é `<conta>/<entidade>`. */
export async function guardarNoCorretor(p: {
  conteudo: Buffer;
  mime: string;
  nome: string;
  pasta: string;
}): Promise<{ chave: string; bytes: number; sha256: string }> {
  const sha = createHash("sha256").update(p.conteudo).digest("hex");
  const r = await fetch(`${baseCorretor()}/api/interno/midias`, {
    method: "POST",
    headers: {
      "x-ponte-assinatura": assinatura("POST", `${p.pasta}\n${sha}`),
      "x-ponte-pasta": p.pasta,
      "x-ponte-mime": p.mime,
      "x-ponte-nome": encodeURIComponent(p.nome.slice(0, 200)),
      "content-type": "application/octet-stream",
    },
    body: new Uint8Array(p.conteudo),
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
  const corpo = (await r?.json().catch(() => null)) as {
    chave?: string;
    bytes?: number;
    sha256?: string;
    erro?: string;
  } | null;
  if (!r?.ok || !corpo?.chave) {
    throw new Error(corpo?.erro ?? "Não foi possível guardar o arquivo agora. Tente de novo.");
  }
  return {
    chave: corpo.chave,
    bytes: Number(corpo.bytes ?? p.conteudo.byteLength),
    sha256: corpo.sha256 ?? sha,
  };
}

/** O conteúdo é a imagem que diz ser? (capa e foto que vão à vitrine de todo mundo) */
export function assinaturaDeImagem(b: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === "image/png")
    return (
      b.length > 8 &&
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  if (mime === "image/webp")
    return (
      b.length > 12 &&
      b.toString("latin1", 0, 4) === "RIFF" &&
      b.toString("latin1", 8, 12) === "WEBP"
    );
  return false;
}

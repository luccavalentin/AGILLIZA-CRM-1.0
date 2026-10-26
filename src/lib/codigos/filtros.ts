/**
 * Servidor de e-mail: filtro de palavras por caixa e destaque do código. Puro (sem rede
 * nem banco) para ser testado à parte e usado igual no leitor e na tela.
 *
 * Regra de captura (a mesma que a tela explica):
 *   1. "não contém" — TODAS valem: se o termo aparece no campo, o e-mail é ignorado;
 *   2. "contém" — QUALQUER UMA basta: o e-mail entra mesmo sem palavra de código;
 *   3. sem regra "contém" que case, entra o e-mail de código (palavras de sempre), se a
 *      caixa usa as palavras padrão.
 */
import { palavraDeCodigo, semAcento } from "./detectar";

export type OperadorFiltro = "contem" | "nao_contem";
export type CampoFiltro = "qualquer" | "assunto" | "remetente" | "corpo";

export interface RegraFiltro {
  operador: OperadorFiltro;
  campo: CampoFiltro;
  termo: string;
  ativo?: boolean;
}

export interface EmailParaFiltro {
  assunto: string;
  corpo: string;
  remetenteEmail: string | null;
  remetenteNome: string | null;
}

export interface ResultadoCaptura {
  capturar: boolean;
  /** Por que entrou (ou por que foi ignorado), para mostrar na tela. */
  motivo: string | null;
  /** O e-mail fala de código (só então o leitor procura o número). */
  ehCodigo: boolean;
}

export const ROTULO_CAMPO: Record<CampoFiltro, string> = {
  qualquer: "qualquer campo",
  assunto: "assunto",
  remetente: "remetente",
  corpo: "corpo",
};

function textoDoCampo(e: EmailParaFiltro, campo: CampoFiltro): string {
  const remetente = `${e.remetenteNome ?? ""} ${e.remetenteEmail ?? ""}`;
  switch (campo) {
    case "assunto":
      return e.assunto;
    case "remetente":
      return remetente;
    case "corpo":
      return e.corpo;
    default:
      return `${e.assunto}\n${remetente}\n${e.corpo}`;
  }
}

/** Termo útil: sem acento, minúsculo, espaços colapsados. Vazio/curto demais não vale. */
export function normalizarTermo(termo: string): string {
  return semAcento(termo).replace(/\s+/g, " ").trim();
}

function casa(e: EmailParaFiltro, r: RegraFiltro): boolean {
  const termo = normalizarTermo(r.termo);
  if (termo.length < 2) return false;
  return semAcento(textoDoCampo(e, r.campo)).replace(/\s+/g, " ").includes(termo);
}

export function descreverRegra(r: RegraFiltro): string {
  return `${ROTULO_CAMPO[r.campo]} ${r.operador === "contem" ? "contém" : "não contém"} "${r.termo.trim()}"`;
}

export function avaliarCaptura(
  e: EmailParaFiltro,
  regras: RegraFiltro[],
  usarPalavrasPadrao: boolean,
): ResultadoCaptura {
  const ativas = regras.filter((r) => r.ativo !== false);
  const palavra = palavraDeCodigo(e.assunto, e.corpo);
  const ehCodigo = palavra !== null;

  const barrou = ativas.find((r) => r.operador === "nao_contem" && casa(e, r));
  if (barrou) return { capturar: false, motivo: `ignorado: ${descreverRegra(barrou)}`, ehCodigo };

  const incluiu = ativas.find((r) => r.operador === "contem" && casa(e, r));
  if (incluiu) return { capturar: true, motivo: descreverRegra(incluiu), ehCodigo };

  if (usarPalavrasPadrao && palavra) {
    return { capturar: true, motivo: `palavra de código "${palavra}"`, ehCodigo };
  }
  return { capturar: false, motivo: null, ehCodigo };
}

/**
 * Partes do texto com o código marcado, para a tela destacar. Aceita o código escrito
 * com espaço ou hífen no meio ("482 917", "482-917") — como os bancos mandam.
 */
export function destacarCodigo(
  texto: string,
  codigo: string | null,
): { texto: string; codigo: boolean }[] {
  if (!texto) return [];
  const digitos = (codigo ?? "").replace(/\D/g, "");
  if (digitos.length < 4) return [{ texto, codigo: false }];
  const re = new RegExp(`(?<!\\d)${digitos.split("").join("[ -]?")}(?!\\d)`, "g");
  const partes: { texto: string; codigo: boolean }[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > ultimo) partes.push({ texto: texto.slice(ultimo, i), codigo: false });
    partes.push({ texto: m[0], codigo: true });
    ultimo = i + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo), codigo: false });
  return partes.length ? partes : [{ texto, codigo: false }];
}

/** Endereço IP (v4 ou v6) de rede interna, loopback, link-local ou reservado. */
export function ipInterno(ip: string): boolean {
  const v = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapeado) return ipInterno(mapeado[1]!);
  const p4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v);
  if (p4) {
    const [a, b] = [Number(p4[1]), Number(p4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v.includes(":")) {
    return (
      v === "::" ||
      v === "::1" ||
      v.startsWith("fe8") ||
      v.startsWith("fe9") ||
      v.startsWith("fea") ||
      v.startsWith("feb") ||
      v.startsWith("fc") ||
      v.startsWith("fd")
    );
  }
  return true; // formato desconhecido: não arrisca
}

/** Porta padrão do IMAP conforme o SSL. */
export function portaPadrao(ssl: boolean): number {
  return ssl ? 993 : 143;
}

/**
 * O que, numa caixa que já tem senha, só pode mudar com a senha digitada de novo.
 * Teste adversarial 23/10/2026: sem isso, quem pode editar apontava a caixa para um
 * servidor dele e o leitor entregava a senha guardada no login. Desligar o SSL também
 * (a senha passaria sem cifra pela rede), e trocar o usuário do login.
 */
export function trocaExigeSenha(
  atual: { email: string; usuario: string | null; imap_host: string; imap_port: number; imap_ssl: boolean },
  novo: { email: string; usuario?: string | null; imap_host: string; imap_port: number; imap_ssl: boolean },
): boolean {
  return (
    atual.email.toLowerCase() !== novo.email.toLowerCase() ||
    (atual.usuario ?? "").toLowerCase() !== (novo.usuario ?? "").trim().toLowerCase() ||
    atual.imap_host.toLowerCase() !== novo.imap_host.toLowerCase() ||
    atual.imap_port !== novo.imap_port ||
    (atual.imap_ssl && !novo.imap_ssl)
  );
}

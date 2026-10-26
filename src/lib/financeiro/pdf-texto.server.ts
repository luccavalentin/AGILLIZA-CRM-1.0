/**
 * Texto de um PDF, sem biblioteca externa (SÓ SERVIDOR): descomprime os fluxos
 * (FlateDecode) e junta as cadeias dos operadores de texto (Tj, TJ, ' e ").
 * Basta para boletos gerados por sistema (a linha digitável vem como texto). PDF
 * escaneado (imagem) ou com fonte sem mapa de caracteres não tem texto legível: a tela
 * avisa e pede a linha digitada/colada.
 */
import { inflateSync, inflateRawSync } from "node:zlib";

const LIMITE_FLUXOS = 400;
/** eco-aud: teto do fluxo descomprimido (bomba de descompressão) e do total lido. */
const LIMITE_FLUXO_BYTES = 8 * 1024 * 1024;
const LIMITE_TOTAL_BYTES = 32 * 1024 * 1024;

function decodificarLiteral(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = s[++i];
    if (n === undefined) break;
    if (n === "n") out += "\n";
    else if (n === "r") out += "\r";
    else if (n === "t") out += "\t";
    else if (n === "b" || n === "f") out += " ";
    else if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(s[i + 1] ?? "")) oct += s[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else if (n === "\r" || n === "\n") {
      if (n === "\r" && s[i + 1] === "\n") i++;
    } else out += n;
  }
  return out;
}

function decodificarHex(h: string): string {
  const limpo = h.replace(/[^0-9a-fA-F]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < limpo.length; i += 2) bytes.push(parseInt(limpo.slice(i, i + 2).padEnd(2, "0"), 16));
  // UTF-16BE (com BOM) ou fonte de 2 bytes com ASCII no byte baixo
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let s = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return s;
  }
  if (bytes.length >= 4 && bytes.length % 2 === 0 && bytes.every((b, i) => (i % 2 === 0 ? b === 0 : true))) {
    let s = "";
    for (let i = 1; i < bytes.length; i += 2) s += String.fromCharCode(bytes[i]);
    return s;
  }
  return String.fromCharCode(...bytes);
}

/** Cadeias de texto de um fluxo de conteúdo. */
export function textoDoConteudo(conteudo: string): string {
  const partes: string[] = [];
  // eco-aud: alternativas disjuntas ("(" só abre literal, "<" só abre hexadecimal, "[" não entra
  // no meio do vetor) e repetição limitada: antes "[" + "()"×40 sem "]…TJ" retrocedia
  // exponencialmente e "[[[[…" era quadrático — o servidor travava lendo um "boleto".
  const re =
    /\[((?:\((?:\\.|[^\\)]){0,4000}\)|<[0-9A-Fa-f\s]{0,4000}>|[^\]()<[]){0,2000})\]\s*TJ|(\((?:\\.|[^\\)]){0,4000}\)|<[0-9A-Fa-f\s]{0,4000}>)\s*(?:Tj|'|")|(ET|T\*|Td|TD)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(conteudo))) {
    if (m[1] !== undefined) {
      const itens = m[1].match(/\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>|-?\d+(?:\.\d+)?/g) ?? [];
      let linha = "";
      for (const it of itens) {
        if (it.startsWith("(")) linha += decodificarLiteral(it.slice(1, -1));
        else if (it.startsWith("<")) linha += decodificarHex(it.slice(1, -1));
        else if (Number(it) < -200) linha += " "; // espaçamento grande entre palavras
      }
      partes.push(linha);
    } else if (m[2] !== undefined) {
      const it = m[2];
      partes.push(it.startsWith("(") ? decodificarLiteral(it.slice(1, -1)) : decodificarHex(it.slice(1, -1)));
    } else if (m[3]) {
      partes.push(m[3] === "ET" ? "\n" : " ");
    }
  }
  return partes.join("").replace(/[ \t]+/g, " ");
}

/** Extrai o texto de todos os fluxos do PDF. */
export function extrairTextoPdf(arquivo: Uint8Array): string {
  const bin = Buffer.from(arquivo).toString("latin1");
  if (!bin.startsWith("%PDF")) throw new Error("O arquivo não é um PDF.");
  const textos: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  let n = 0;
  let lidos = 0;
  while ((m = re.exec(bin)) && n++ < LIMITE_FLUXOS && lidos < LIMITE_TOTAL_BYTES) {
    const ini = m.index + m[0].length;
    const fim = bin.indexOf("endstream", ini);
    if (fim < 0) break;
    const cabeca = bin.slice(Math.max(0, m.index - 300), m.index);
    const bruto = Buffer.from(bin.slice(ini, fim), "latin1");
    let conteudo: string | null = null;
    if (/FlateDecode/.test(cabeca)) {
      for (const f of [inflateSync, inflateRawSync]) {
        try {
          conteudo = f(bruto, { maxOutputLength: LIMITE_FLUXO_BYTES }).toString("latin1");
          break;
        } catch {
          /* tenta o próximo */
        }
      }
    } else if (!/\/Filter/.test(cabeca)) {
      conteudo = bruto.toString("latin1");
    }
    if (conteudo && conteudo.length > LIMITE_FLUXO_BYTES) conteudo = null;
    if (conteudo) lidos += conteudo.length;
    if (conteudo && /(Tj|TJ)/.test(conteudo)) textos.push(textoDoConteudo(conteudo));
    re.lastIndex = fim;
  }
  return textos.join("\n").trim();
}

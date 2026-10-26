/**
 * Leitura de extrato bancário (OFX e CSV) no navegador — só transforma o arquivo em
 * movimentações; quem importa, sugere e concilia é o banco (fin_importar_extrato e
 * fin_sugestoes_conciliacao), sempre com confirmação da pessoa.
 */

export interface MovimentoExtrato {
  /** AAAA-MM-DD */
  data: string;
  /** positivo = entrada; negativo = saída */
  valor: number;
  descricao: string;
  documento: string | null;
  fitid: string | null;
  /** posição no arquivo (duas movimentações idênticas no mesmo dia continuam distintas) */
  ordem: number;
}

export interface LeituraExtrato {
  formato: "ofx" | "csv";
  movimentos: MovimentoExtrato[];
  avisos: string[];
}

const MAX_MOVIMENTOS = 5000;

/** "1.234,56", "1,234.56", "-12,90", "(12,90)", "12,90 D", "R$ 3.500,00 C" → número. */
export function lerValor(bruto: string | null | undefined): number | null {
  if (bruto == null) return null;
  let s = String(bruto).trim();
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  const sufixo = s.match(/\s*([CD])$/i);
  if (sufixo) {
    if (sufixo[1].toUpperCase() === "D") negativo = true;
    s = s.slice(0, -sufixo[0].length);
  }
  s = s.replace(/R\$\s*/i, "").replace(/\s/g, "");
  if (s.startsWith("-")) {
    negativo = !negativo;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;
  const ultVirgula = s.lastIndexOf(",");
  const ultPonto = s.lastIndexOf(".");
  if (ultVirgula > ultPonto) s = s.replace(/\./g, "").replace(",", ".");
  else if (ultPonto > ultVirgula && ultVirgula >= 0) s = s.replace(/,/g, "");
  else if (ultVirgula === -1 && (s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round((negativo ? -n : n) * 100) / 100;
}

function dataValida(a: number, m: number, d: number): string | null {
  if (a < 100) a += 2000;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** "31/10/2026", "31/10/26", "2026-10-31", "31-10-2026", "20261031" → AAAA-MM-DD. */
export function lerData(bruto: string | null | undefined): string | null {
  const s = String(bruto ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return dataValida(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return dataValida(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return dataValida(+m[1], +m[2], +m[3]);
  return null;
}

function tagOfx(bloco: string, tag: string): string | null {
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  const v = m?.[1]?.trim();
  return v ? v : null;
}

function decodificarEntidades(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

/** OFX 1.x (SGML, sem fechar tags) e 2.x (XML). */
export function lerOfx(texto: string): LeituraExtrato {
  const avisos: string[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const movimentos: MovimentoExtrato[] = [];
  blocos.forEach((bruto, i) => {
    const bloco = bruto.split(/<\/STMTTRN>/i)[0];
    const data = lerData(tagOfx(bloco, "DTPOSTED") ?? tagOfx(bloco, "DTUSER"));
    const valor = lerValor(tagOfx(bloco, "TRNAMT"));
    if (!data || valor == null || valor === 0) {
      avisos.push(`Movimentação ${i + 1} sem data ou valor: ignorada.`);
      return;
    }
    const memo = decodificarEntidades(tagOfx(bloco, "MEMO") ?? "");
    const nome = decodificarEntidades(tagOfx(bloco, "NAME") ?? "");
    const descricao = [nome, memo].filter((x, j, arr) => x && arr.indexOf(x) === j).join(" · ") || "Sem descrição";
    movimentos.push({
      data,
      valor,
      descricao: descricao.slice(0, 300),
      documento: tagOfx(bloco, "CHECKNUM") ?? tagOfx(bloco, "REFNUM"),
      fitid: tagOfx(bloco, "FITID"),
      ordem: movimentos.length,
    });
  });
  if (!blocos.length) avisos.push("Nenhuma movimentação encontrada no OFX.");
  return { formato: "ofx", movimentos: movimentos.slice(0, MAX_MOVIMENTOS), avisos };
}

/** Divide uma linha CSV respeitando aspas. */
export function dividirLinhaCsv(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else aspas = !aspas;
    } else if (c === sep && !aspas) {
      out.push(atual);
      atual = "";
    } else atual += c;
  }
  out.push(atual);
  return out.map((x) => x.trim());
}

function normal(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

type Coluna = "data" | "descricao" | "valor" | "credito" | "debito" | "documento" | "tipo";

function identificarColuna(nome: string): Coluna | null {
  const n = normal(nome);
  if (/saldo/.test(n)) return null;
  if (/^(data|dt|date)/.test(n) || /data (do )?(lanc|mov)/.test(n)) return "data";
  if (/cred|entrada/.test(n)) return "credito";
  if (/deb|saida/.test(n)) return "debito";
  if (/^(valor|vlr|amount|quantia|montante)/.test(n)) return "valor";
  if (/hist|descr|lanc|memo|detal|estabelec|favorec/.test(n)) return "descricao";
  if (/doc|numero|n[ºo°]|ref|comprov/.test(n)) return "documento";
  if (/^(tipo|type|natureza|d\/c|c\/d|dc|cd)$/.test(n)) return "tipo";
  return null;
}

/** CSV de banco (separador ; , ou tab; com ou sem cabeçalho; decimal com vírgula). */
export function lerCsv(texto: string): LeituraExtrato {
  const avisos: string[] = [];
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return { formato: "csv", movimentos: [], avisos: ["Arquivo vazio."] };
  const amostra = linhas.slice(0, 10).join("\n");
  const sep = [";", "\t", ","]
    .map((s) => ({ s, n: (amostra.match(new RegExp(s === "\t" ? "\t" : `\\${s}`, "g")) ?? []).length }))
    .sort((a, b) => b.n - a.n)[0].s;

  // Cabeçalho: a primeira linha (entre as 15 primeiras) com coluna de data e de valor/crédito/débito
  let inicio = 0;
  let mapa: Partial<Record<Coluna, number>> = {};
  for (let i = 0; i < Math.min(15, linhas.length); i++) {
    const cols = dividirLinhaCsv(linhas[i], sep);
    const m: Partial<Record<Coluna, number>> = {};
    cols.forEach((c, j) => {
      const tipo = identificarColuna(c);
      if (tipo && m[tipo] === undefined) m[tipo] = j;
    });
    if (m.data !== undefined && (m.valor !== undefined || m.credito !== undefined || m.debito !== undefined)) {
      mapa = m;
      inicio = i + 1;
      break;
    }
  }
  if (inicio === 0) {
    // sem cabeçalho: data; descrição; [documento;] valor
    const n = dividirLinhaCsv(linhas[0], sep).length;
    mapa = n >= 4 ? { data: 0, descricao: 1, documento: 2, valor: n - 1 } : { data: 0, descricao: 1, valor: n - 1 };
    avisos.push("Arquivo sem cabeçalho: lido como data, descrição, (documento) e valor.");
  }

  const movimentos: MovimentoExtrato[] = [];
  for (let i = inicio; i < linhas.length && movimentos.length < MAX_MOVIMENTOS; i++) {
    const cols = dividirLinhaCsv(linhas[i], sep);
    const pega = (c: Coluna) => (mapa[c] !== undefined ? (cols[mapa[c]!] ?? "") : "");
    const descricao = pega("descricao") || "Sem descrição";
    if (/saldo/i.test(descricao)) continue;
    const data = lerData(pega("data"));
    let valor: number | null;
    if (mapa.valor !== undefined) {
      valor = lerValor(pega("valor"));
      const tipo = normal(pega("tipo"));
      if (valor != null && (tipo === "d" || tipo.startsWith("deb"))) valor = -Math.abs(valor);
      if (valor != null && (tipo === "c" || tipo.startsWith("cred"))) valor = Math.abs(valor);
    } else {
      const cr = lerValor(pega("credito"));
      const db = lerValor(pega("debito"));
      valor = cr ? Math.abs(cr) : db ? -Math.abs(db) : null;
    }
    if (!data || valor == null || valor === 0) {
      if (cols.some((c) => c)) avisos.push(`Linha ${i + 1} sem data ou valor reconhecível: ignorada.`);
      continue;
    }
    movimentos.push({
      data,
      valor,
      descricao: descricao.slice(0, 300),
      documento: pega("documento") || null,
      fitid: null,
      ordem: movimentos.length,
    });
  }
  if (linhas.length - inicio > MAX_MOVIMENTOS) avisos.push(`Só as primeiras ${MAX_MOVIMENTOS} movimentações foram lidas.`);
  return { formato: "csv", movimentos, avisos: avisos.slice(0, 20) };
}

/** Decide pelo conteúdo (e não só pela extensão). */
export function lerExtrato(nomeArquivo: string, texto: string): LeituraExtrato {
  if (/<OFX>|<STMTTRN>|OFXHEADER/i.test(texto) || /\.ofx$/i.test(nomeArquivo)) return lerOfx(texto);
  return lerCsv(texto);
}

/** SHA-256 em hexadecimal (o banco usa para avisar arquivo repetido). */
export async function sha256Hex(dados: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", dados);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

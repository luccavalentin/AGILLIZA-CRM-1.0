/**
 * Markdown dos artigos (Base de conhecimento, Agilliza News e respostas do Consultor IA).
 *
 * Analisador próprio, sem dependência e SEM HTML: o texto vira uma árvore de blocos que o
 * React desenha elemento por elemento — nada passa por `dangerouslySetInnerHTML`, então um
 * artigo não tem como injetar script. Links só http(s), mailto e caminhos internos; imagem
 * só https (ou caminho interno). O mesmo arquivo existe no Agilliza Tech
 * (`apps/web/src/lib/markdown-artigo.ts`): mudou aqui, mude lá.
 *
 * Suporta: títulos (# a ####), parágrafos, **negrito**, *itálico* ou _itálico_, `código`,
 * [links](https://…), ![imagens](https://…), listas (- / 1.), citação (>), avisos
 * (> [!INFO] / [!ATENCAO] / [!DICA]), tabelas (| a | b |), separador (---) e bloco de código.
 */

export type Inline =
  | { t: "texto"; v: string }
  | { t: "negrito"; c: Inline[] }
  | { t: "italico"; c: Inline[] }
  | { t: "codigo"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "imagem"; src: string; alt: string };

export type Alinhamento = "esquerda" | "centro" | "direita" | null;

export type Bloco =
  | { t: "titulo"; nivel: 1 | 2 | 3 | 4; c: Inline[]; ancora: string }
  | { t: "paragrafo"; c: Inline[] }
  | { t: "lista"; ordenada: boolean; inicio: number; itens: Inline[][] }
  | { t: "citacao"; blocos: Bloco[] }
  | { t: "aviso"; tipo: "info" | "atencao" | "dica"; blocos: Bloco[] }
  | { t: "tabela"; cabecalho: Inline[][]; alinhamentos: Alinhamento[]; linhas: Inline[][][] }
  | { t: "separador" }
  | { t: "codigo"; v: string }
  | { t: "figura"; src: string; alt: string };

/**
 * Caminho interno de verdade: começa com "/" e não tem barra invertida, controle (tab, quebra)
 * nem a barra/barra invertida codificada — o navegador normaliza "/\evil.com" e "/<tab>/evil.com"
 * para "//evil.com" e o link "interno" levava para fora (eco-aud).
 */
function caminhoInterno(s: string): boolean {
  return /^\/(?!\/)/.test(s) && !/[\\\u0000-\u001f\u007f]|%5c|%2f|%09|%0a|%0d/i.test(s);
}

/** Destino de link aceito (ou null): http(s), mailto, tel e caminho interno. */
export function hrefSeguro(bruto: string): string | null {
  const s = bruto.trim();
  if (!s || s.length > 2000) return null;
  if (s.startsWith("/")) return caminhoInterno(s) ? s : null;
  if (/^#/.test(s)) return s;
  if (/^mailto:[^\s]+$/i.test(s) || /^tel:\+?[\d\s()-]+$/i.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Imagem aceita (ou null): só https e caminho interno. */
export function srcSeguro(bruto: string): string | null {
  const s = bruto.trim();
  if (!s || s.length > 2000) return null;
  if (s.startsWith("/")) return caminhoInterno(s) ? s : null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Âncora do título (para o sumário): sem acento, minúsculas, hífens. */
export function ancoraDe(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const RE_IMAGEM = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;
const RE_LINK = /^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;

/** Texto inline → nós. Marcação sem par vira texto (nunca some conteúdo). */
export function analisarInline(s: string, profundidade = 0): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const soltar = () => {
    if (buf) out.push({ t: "texto", v: buf });
    buf = "";
  };
  let i = 0;
  while (i < s.length) {
    const resto = s.slice(i);
    const ch = s[i]!;
    if (ch === "\\" && i + 1 < s.length && /[\\`*_[\]()#!>|-]/.test(s[i + 1]!)) {
      buf += s[i + 1];
      i += 2;
      continue;
    }
    if (ch === "!" && s[i + 1] === "[") {
      const m = RE_IMAGEM.exec(resto);
      if (m) {
        const src = srcSeguro(m[2]!);
        soltar();
        if (src) out.push({ t: "imagem", src, alt: m[1]!.trim() });
        else out.push({ t: "texto", v: m[1]! });
        i += m[0].length;
        continue;
      }
    }
    if (ch === "[" && profundidade < 3) {
      const m = RE_LINK.exec(resto);
      if (m) {
        const href = hrefSeguro(m[2]!);
        soltar();
        const filhos = analisarInline(m[1]!, profundidade + 1);
        if (href) out.push({ t: "link", href, c: filhos });
        else out.push(...filhos);
        i += m[0].length;
        continue;
      }
    }
    if (ch === "`") {
      const fim = s.indexOf("`", i + 1);
      if (fim > i + 1) {
        soltar();
        out.push({ t: "codigo", v: s.slice(i + 1, fim) });
        i = fim + 1;
        continue;
      }
    }
    if (ch === "*" && s[i + 1] === "*" && profundidade < 3) {
      const fim = s.indexOf("**", i + 2);
      if (fim > i + 2) {
        soltar();
        out.push({ t: "negrito", c: analisarInline(s.slice(i + 2, fim), profundidade + 1) });
        i = fim + 2;
        continue;
      }
    }
    if ((ch === "*" || ch === "_") && profundidade < 3) {
      const antes = i > 0 ? s[i - 1]! : " ";
      // `_` dentro de palavra (snake_case, e-mail) não é itálico.
      const podeAbrir = ch === "*" ? s[i + 1] !== " " : !/[\p{L}\p{N}]/u.test(antes);
      if (podeAbrir) {
        let fim = s.indexOf(ch, i + 1);
        while (fim > 0 && ch === "*" && s[fim + 1] === "*") fim = s.indexOf(ch, fim + 2);
        const depois = fim > 0 ? (s[fim + 1] ?? " ") : " ";
        if (fim > i + 1 && s[fim - 1] !== " " && (ch === "*" || !/[\p{L}\p{N}]/u.test(depois))) {
          soltar();
          out.push({ t: "italico", c: analisarInline(s.slice(i + 1, fim), profundidade + 1) });
          i = fim + 1;
          continue;
        }
      }
    }
    buf += ch;
    i++;
  }
  soltar();
  return out;
}

const RE_TITULO = /^(#{1,4})\s+(.+?)\s*#*\s*$/;
const RE_SEPARADOR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const RE_ITEM_NAO_ORD = /^\s*[-*+]\s+(.*)$/;
const RE_ITEM_ORD = /^\s*(\d{1,4})[.)]\s+(.*)$/;
const RE_LINHA_TABELA_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const RE_FIGURA = /^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/;
const RE_AVISO = /^\[!(INFO|ATENCAO|ATENÇÃO|DICA|NOTA|AVISO)\]\s*(.*)$/i;

function celulas(linha: string): string[] {
  let l = linha.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|") && !l.endsWith("\\|")) l = l.slice(0, -1);
  return l.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

function alinhamento(c: string): Alinhamento {
  const e = c.startsWith(":");
  const d = c.endsWith(":");
  return e && d ? "centro" : d ? "direita" : e ? "esquerda" : null;
}

/** Texto markdown → blocos. Limita o tamanho para um artigo gigante não travar a tela. */
export function analisarMarkdown(texto: string, profundidade = 0): Bloco[] {
  const linhas = (texto ?? "").slice(0, 200_000).replace(/\r\n?/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ t: "paragrafo", c: analisarInline(paragrafo.join(" ")) });
    paragrafo = [];
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!;
    const l = linha.trim();

    if (l.startsWith("```")) {
      fecharParagrafo();
      const corpo: string[] = [];
      i++;
      while (i < linhas.length && !linhas[i]!.trim().startsWith("```")) corpo.push(linhas[i++]!);
      blocos.push({ t: "codigo", v: corpo.join("\n") });
      continue;
    }
    if (!l) {
      fecharParagrafo();
      continue;
    }
    const titulo = RE_TITULO.exec(l);
    if (titulo) {
      fecharParagrafo();
      const nivel = titulo[1]!.length as 1 | 2 | 3 | 4;
      blocos.push({
        t: "titulo",
        nivel,
        c: analisarInline(titulo[2]!),
        ancora: ancoraDe(titulo[2]!),
      });
      continue;
    }
    if (RE_SEPARADOR.test(l) && !paragrafo.length) {
      blocos.push({ t: "separador" });
      continue;
    }
    if (l.startsWith(">")) {
      fecharParagrafo();
      const dentro: string[] = [];
      while (i < linhas.length && linhas[i]!.trim().startsWith(">")) {
        dentro.push(linhas[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      const aviso = RE_AVISO.exec(dentro[0] ?? "");
      if (profundidade < 2) {
        if (aviso) {
          const k = aviso[1]!.toUpperCase();
          const tipo =
            k === "DICA" ? "dica" : k.startsWith("ATEN") || k === "AVISO" ? "atencao" : "info";
          dentro[0] = aviso[2]!;
          blocos.push({
            t: "aviso",
            tipo,
            blocos: analisarMarkdown(dentro.join("\n"), profundidade + 1),
          });
        } else {
          blocos.push({
            t: "citacao",
            blocos: analisarMarkdown(dentro.join("\n"), profundidade + 1),
          });
        }
      } else {
        blocos.push({ t: "paragrafo", c: analisarInline(dentro.join(" ")) });
      }
      continue;
    }
    if (l.includes("|") && i + 1 < linhas.length && RE_LINHA_TABELA_SEP.test(linhas[i + 1]!)) {
      fecharParagrafo();
      const cab = celulas(l);
      const alins = celulas(linhas[i + 1]!).map(alinhamento);
      const corpo: Inline[][][] = [];
      i += 2;
      while (i < linhas.length && linhas[i]!.includes("|") && linhas[i]!.trim()) {
        const cs = celulas(linhas[i]!);
        corpo.push(cab.map((_, k) => analisarInline(cs[k] ?? "")));
        i++;
      }
      i--;
      blocos.push({
        t: "tabela",
        cabecalho: cab.map((c) => analisarInline(c)),
        alinhamentos: cab.map((_, k) => alins[k] ?? null),
        linhas: corpo.slice(0, 500),
      });
      continue;
    }
    const naoOrd = RE_ITEM_NAO_ORD.exec(linha);
    const ord = RE_ITEM_ORD.exec(linha);
    if ((naoOrd || ord) && !RE_SEPARADOR.test(l)) {
      fecharParagrafo();
      const ordenada = !naoOrd;
      const inicio = ord ? Number(ord[1]) : 1;
      const itens: string[] = [];
      while (i < linhas.length) {
        const atual = linhas[i]!;
        const m = ordenada ? RE_ITEM_ORD.exec(atual) : RE_ITEM_NAO_ORD.exec(atual);
        if (m) {
          itens.push(ordenada ? m[2]! : m[1]!);
        } else if (atual.trim() && /^\s{2,}/.test(atual) && itens.length) {
          itens[itens.length - 1] += ` ${atual.trim()}`; // continuação do item
        } else break;
        i++;
      }
      i--;
      blocos.push({ t: "lista", ordenada, inicio, itens: itens.map((x) => analisarInline(x)) });
      continue;
    }
    const fig = RE_FIGURA.exec(l);
    if (fig && !paragrafo.length) {
      const src = srcSeguro(fig[2]!);
      if (src) {
        blocos.push({ t: "figura", src, alt: fig[1]!.trim() });
        continue;
      }
    }
    paragrafo.push(l);
  }
  fecharParagrafo();
  return blocos;
}

/** Texto puro (para busca, resumo e tempo de leitura). */
export function textoPuro(md: string): string {
  const plano = (c: Inline[]): string =>
    c
      .map((x) =>
        x.t === "texto" || x.t === "codigo" ? x.v : x.t === "imagem" ? x.alt : plano(x.c),
      )
      .join("");
  const bloco = (b: Bloco): string => {
    switch (b.t) {
      case "titulo":
      case "paragrafo":
        return plano(b.c);
      case "lista":
        return b.itens.map(plano).join(" ");
      case "citacao":
      case "aviso":
        return b.blocos.map(bloco).join(" ");
      case "tabela":
        return [...b.cabecalho.map(plano), ...b.linhas.flat().map(plano)].join(" ");
      case "codigo":
        return b.v;
      case "figura":
        return b.alt;
      default:
        return "";
    }
  };
  return analisarMarkdown(md).map(bloco).join(" ").replace(/\s+/g, " ").trim();
}

/** Minutos de leitura (200 palavras por minuto, mínimo 1). */
export function minutosDeLeitura(md: string): number {
  const palavras = textoPuro(md).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}

/** Sumário: os títulos de nível 2 e 3, com âncora. */
export function sumario(md: string): { nivel: 2 | 3; texto: string; ancora: string }[] {
  const plano = (c: Inline[]): string =>
    c
      .map((x) =>
        x.t === "texto" || x.t === "codigo" ? x.v : x.t === "imagem" ? x.alt : plano(x.c),
      )
      .join("");
  return analisarMarkdown(md)
    .filter(
      (b): b is Extract<Bloco, { t: "titulo" }> =>
        b.t === "titulo" && (b.nivel === 2 || b.nivel === 3),
    )
    .map((b) => ({ nivel: b.nivel as 2 | 3, texto: plano(b.c), ancora: b.ancora }));
}

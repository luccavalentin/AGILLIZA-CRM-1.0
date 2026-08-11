/**
 * Biblioteca de conhecimento — geração de PDF editorial.
 *
 * Dois formatos:
 *  - `gerarVerbetePDF`  → um único verbete, como um artigo institucional.
 *  - `gerarCompendioPDF` → coletânea (vários verbetes) com capa, sumário
 *    paginado e separadores por categoria.
 *
 * O conteúdo é markdown: o renderizador interpreta títulos, listas, citações,
 * tabelas e ênfases — sem numeração automática de "perguntas".
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AGILLIZA_LOGO_LIGHT, AGILLIZA_LOGO_RATIO } from "@/lib/relatorios/brand-logo";
import { getPdfPalette } from "@/lib/relatorios/pdf-theme";
import type { ItemBase } from "@/lib/consultor-ia/consultor-ia.functions";

const MARGEM = 56;
const HEADER_H = 46;

function slug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function rotuloCategoria(c: string): string {
  return c.replace(/_/g, " ");
}

function limparInline(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(?!\s)(.+?)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)")
    .replace(/^>\s?/, "")
    .trim();
}

interface Bloco {
  tipo: "h1" | "h2" | "h3" | "p" | "ul" | "ol" | "quote" | "tabela";
  texto?: string;
  itens?: string[];
  colunas?: string[];
  linhas?: string[][];
}

/** Converte markdown simples em blocos renderizáveis. */
function parseMarkdown(md: string): Bloco[] {
  const linhas = md.replace(/\r/g, "").split("\n");
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];
  let lista: string[] | null = null;
  let listaTipo: "ul" | "ol" = "ul";
  let citacao: string[] = [];

  const fecharParagrafo = () => {
    if (paragrafo.length) {
      blocos.push({ tipo: "p", texto: limparInline(paragrafo.join(" ")) });
      paragrafo = [];
    }
  };
  const fecharLista = () => {
    if (lista?.length) blocos.push({ tipo: listaTipo, itens: lista });
    lista = null;
  };
  const fecharCitacao = () => {
    if (citacao.length) {
      blocos.push({ tipo: "quote", texto: limparInline(citacao.join(" ")) });
      citacao = [];
    }
  };
  const fecharTudo = () => {
    fecharParagrafo();
    fecharLista();
    fecharCitacao();
  };

  for (let i = 0; i < linhas.length; i++) {
    const bruta = linhas[i];
    const l = bruta.trim();

    if (!l) {
      fecharTudo();
      continue;
    }

    // Tabela markdown
    if (
      l.startsWith("|") &&
      linhas[i + 1]?.trim().replace(/[^|:\- ]/g, "") === linhas[i + 1]?.trim()
    ) {
      const celulas = (linha: string) =>
        linha
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => limparInline(c));
      const colunas = celulas(l);
      const corpo: string[][] = [];
      i += 2;
      while (i < linhas.length && linhas[i].trim().startsWith("|")) {
        corpo.push(celulas(linhas[i]));
        i++;
      }
      i--;
      fecharTudo();
      blocos.push({ tipo: "tabela", colunas, linhas: corpo });
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) {
      fecharTudo();
      const nivel = h[1].length;
      blocos.push({
        tipo: nivel <= 1 ? "h1" : nivel === 2 ? "h2" : "h3",
        texto: limparInline(h[2]),
      });
      continue;
    }

    if (/^>\s?/.test(l)) {
      fecharParagrafo();
      fecharLista();
      citacao.push(l.replace(/^>\s?/, ""));
      continue;
    }

    const ol = /^(\d+)[.)]\s+(.*)$/.exec(l);
    const ul = /^[-*•]\s+(.*)$/.exec(l);
    if (ol || ul) {
      fecharParagrafo();
      fecharCitacao();
      const tipo: "ul" | "ol" = ol ? "ol" : "ul";
      if (!lista || listaTipo !== tipo) {
        fecharLista();
        lista = [];
        listaTipo = tipo;
      }
      lista.push(limparInline((ol ? ol[2] : ul![1]) ?? ""));
      continue;
    }

    if (/^[-–—_]{3,}$/.test(l)) {
      fecharTudo();
      continue;
    }

    fecharLista();
    fecharCitacao();
    paragrafo.push(l);
  }
  fecharTudo();
  return blocos;
}

interface Ctx {
  doc: jsPDF;
  P: ReturnType<typeof getPdfPalette>;
  pageW: number;
  pageH: number;
  util: number;
  y: number;
  titulo: string;
  paginaCapa: boolean;
}

function cabecalhoCorrente(ctx: Ctx) {
  const { doc, P, pageW } = ctx;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(P.cinza);
  doc.text("AGILLIZA · BIBLIOTECA DE CONHECIMENTO", MARGEM, HEADER_H - 14);
  const t = String(doc.splitTextToSize(ctx.titulo, ctx.util * 0.55)[0] ?? "");
  doc.text(t.toUpperCase(), pageW - MARGEM, HEADER_H - 14, { align: "right" });
  doc.setDrawColor(P.borda);
  doc.setLineWidth(0.6);
  doc.line(MARGEM, HEADER_H - 8, pageW - MARGEM, HEADER_H - 8);
}

function novaPagina(ctx: Ctx) {
  ctx.doc.addPage();
  cabecalhoCorrente(ctx);
  ctx.y = HEADER_H + 26;
}

function garantir(ctx: Ctx, altura: number) {
  if (ctx.y + altura > ctx.pageH - 62) novaPagina(ctx);
}

function texto(
  ctx: Ctx,
  conteudo: string,
  opts: {
    tamanho?: number;
    estilo?: "normal" | "bold" | "italic";
    cor?: string;
    recuo?: number;
    entrelinha?: number;
    depois?: number;
    largura?: number;
  } = {},
) {
  const { doc } = ctx;
  const tam = opts.tamanho ?? 10.5;
  const lh = opts.entrelinha ?? tam * 1.5;
  const recuo = opts.recuo ?? 0;
  doc.setFont("helvetica", opts.estilo ?? "normal");
  doc.setFontSize(tam);
  doc.setTextColor(opts.cor ?? ctx.P.texto);
  const linhas = doc.splitTextToSize(conteudo, (opts.largura ?? ctx.util) - recuo) as string[];
  for (const l of linhas) {
    garantir(ctx, lh + 2);
    doc.setFont("helvetica", opts.estilo ?? "normal");
    doc.setFontSize(tam);
    doc.setTextColor(opts.cor ?? ctx.P.texto);
    doc.text(l, MARGEM + recuo, ctx.y);
    ctx.y += lh;
  }
  ctx.y += opts.depois ?? 6;
}

function renderBlocos(ctx: Ctx, blocos: Bloco[]) {
  const { doc, P } = ctx;
  for (const b of blocos) {
    switch (b.tipo) {
      case "h1":
      case "h2": {
        garantir(ctx, 46);
        ctx.y += 8;
        doc.setFillColor(P.coral);
        doc.rect(MARGEM, ctx.y - 9, 3, 13, "F");
        texto(ctx, b.texto ?? "", {
          tamanho: b.tipo === "h1" ? 14 : 12.5,
          estilo: "bold",
          cor: P.destaque,
          recuo: 12,
          entrelinha: 17,
          depois: 8,
        });
        break;
      }
      case "h3":
        garantir(ctx, 30);
        ctx.y += 4;
        texto(ctx, b.texto ?? "", {
          tamanho: 11,
          estilo: "bold",
          cor: P.texto,
          entrelinha: 15,
          depois: 5,
        });
        break;
      case "p":
        texto(ctx, b.texto ?? "", { depois: 9 });
        break;
      case "ul":
      case "ol": {
        for (const [i, item] of (b.itens ?? []).entries()) {
          const marcador = b.tipo === "ol" ? `${i + 1}.` : "—";
          const linhas = doc.splitTextToSize(item, ctx.util - 26) as string[];
          garantir(ctx, linhas.length * 15 + 4);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(P.destaque);
          doc.text(marcador, MARGEM + 2, ctx.y);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(P.texto);
          doc.text(linhas, MARGEM + 26, ctx.y);
          ctx.y += linhas.length * 15 + 3;
        }
        ctx.y += 8;
        break;
      }
      case "quote": {
        const linhas = doc.splitTextToSize(b.texto ?? "", ctx.util - 34) as string[];
        garantir(ctx, linhas.length * 15 + 22);
        const yIni = ctx.y - 12;
        const alt = linhas.length * 15 + 16;
        doc.setFillColor(P.card);
        doc.rect(MARGEM, yIni, ctx.util, alt, "F");
        doc.setFillColor(P.destaque);
        doc.rect(MARGEM, yIni, 3, alt, "F");
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(P.cinza);
        doc.text(linhas, MARGEM + 18, ctx.y + 2);
        ctx.y = yIni + alt + 14;
        break;
      }
      case "tabela": {
        garantir(ctx, 70);
        autoTable(doc, {
          head: [b.colunas ?? []],
          body: b.linhas ?? [],
          startY: ctx.y,
          margin: { left: MARGEM, right: MARGEM, top: HEADER_H + 26 },
          styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 6,
            textColor: P.texto,
            lineColor: P.borda,
            lineWidth: 0.4,
          },
          headStyles: {
            fillColor: P.azul,
            textColor: "#FFFFFF",
            fontStyle: "bold",
            fontSize: 9,
          },
          alternateRowStyles: { fillColor: P.card },
          didDrawPage: () => cabecalhoCorrente(ctx),
        });
        ctx.y = ((doc as any).lastAutoTable?.finalY ?? ctx.y) + 18;
        break;
      }
    }
  }
}

function capa(
  ctx: Ctx,
  opts: { chapeu: string; titulo: string; subtitulo: string; meta: string[] },
) {
  const { doc, P, pageW, pageH } = ctx;
  doc.setFillColor(P.azul);
  doc.rect(0, 0, pageW, pageH, "F");

  // marca d'água tipográfica + malha discreta
  doc.setDrawColor(P.sep);
  doc.setLineWidth(0.5);
  for (let x = -pageH; x < pageW; x += 34) doc.line(x, pageH, x + pageH, 0);
  doc.setFillColor(P.azul);
  doc.rect(0, pageH * 0.22, pageW, pageH * 0.62, "F");
  doc.setTextColor(P.sep);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(120);
  doc.text("A", pageW - 96, pageH - 96, { align: "center" });

  try {
    const logoH = 40;
    doc.addImage(AGILLIZA_LOGO_LIGHT, "PNG", MARGEM, 62, logoH * AGILLIZA_LOGO_RATIO, logoH);
  } catch {
    /* ignora */
  }

  doc.setFillColor(P.coral);
  doc.rect(MARGEM, pageH * 0.36, 54, 3, "F");

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(opts.chapeu.toUpperCase(), MARGEM, pageH * 0.34);

  doc.setFontSize(30);
  const tit = doc.splitTextToSize(opts.titulo, pageW - MARGEM * 2 - 40) as string[];
  doc.text(tit.slice(0, 5), MARGEM, pageH * 0.42 + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(P.subHead);
  const sub = doc.splitTextToSize(opts.subtitulo, pageW - MARGEM * 2 - 60) as string[];
  doc.text(sub.slice(0, 3), MARGEM, pageH * 0.42 + 34 + tit.slice(0, 5).length * 32);

  doc.setFontSize(9);
  let my = pageH - 110;
  for (const m of opts.meta) {
    doc.text(m, MARGEM, my);
    my += 15;
  }
  doc.setDrawColor(P.sep);
  doc.setLineWidth(0.8);
  doc.line(MARGEM, pageH - 62, pageW - MARGEM, pageH - 62);
  doc.setTextColor("#FFFFFF");
  doc.setFontSize(8.5);
  doc.text("Agilliza · Crédito Imobiliário", MARGEM, pageH - 44);
  doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, pageW - MARGEM, pageH - 44, {
    align: "right",
  });
}

function rodapes(ctx: Ctx, legenda: string) {
  const { doc, P, pageW, pageH } = ctx;
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    const fy = pageH - 34;
    doc.setDrawColor(P.borda);
    doc.setLineWidth(0.5);
    doc.line(MARGEM, fy, pageW - MARGEM, fy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(P.cinza);
    doc.text(legenda, MARGEM, fy + 13);
    doc.text(`${i - 1} / ${total - 1}`, pageW - MARGEM, fy + 13, { align: "right" });
  }
}

function criarCtx(titulo: string): Ctx {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    compress: true,
  });
  return {
    doc,
    P: getPdfPalette(),
    pageW: doc.internal.pageSize.getWidth(),
    pageH: doc.internal.pageSize.getHeight(),
    util: doc.internal.pageSize.getWidth() - MARGEM * 2,
    y: 0,
    titulo,
    paginaCapa: true,
  };
}

function fichaTecnica(ctx: Ctx, item: ItemBase) {
  const { doc, P } = ctx;
  const alt = 46;
  garantir(ctx, alt + 16);
  doc.setFillColor(P.card);
  doc.rect(MARGEM, ctx.y - 12, ctx.util, alt, "F");
  doc.setFillColor(P.destaque);
  doc.rect(MARGEM, ctx.y - 12, 3, alt, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(P.cinza);
  doc.text("CATEGORIA", MARGEM + 16, ctx.y + 1);
  doc.text("ATUALIZADO EM", MARGEM + 190, ctx.y + 1);
  doc.text("ABRANGÊNCIA", MARGEM + 340, ctx.y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(P.texto);
  doc.text(rotuloCategoria(item.categoria), MARGEM + 16, ctx.y + 16);
  doc.text(new Date(item.updated_at).toLocaleDateString("pt-BR"), MARGEM + 190, ctx.y + 16);
  doc.text(item.correspondente_id === null ? "Global" : "Correspondente", MARGEM + 340, ctx.y + 16);
  ctx.y += alt + 18;

  if (item.tags.length) {
    texto(ctx, `Palavras-chave: ${item.tags.join(" · ")}`, {
      tamanho: 9,
      cor: P.cinza,
      estilo: "italic",
      depois: 12,
    });
  }
}

/** PDF de um único verbete, no formato de artigo institucional. */
export function gerarVerbetePDF(item: ItemBase, filename?: string) {
  const ctx = criarCtx(item.titulo);
  capa(ctx, {
    chapeu: `Biblioteca de conhecimento · ${rotuloCategoria(item.categoria)}`,
    titulo: item.titulo,
    subtitulo:
      item.tags.length > 0 ? item.tags.join(" · ") : "Referência técnica de crédito imobiliário",
    meta: [
      `Atualizado em ${new Date(item.updated_at).toLocaleDateString("pt-BR")}`,
      item.correspondente_id === null
        ? "Conteúdo global — válido para toda a operação"
        : "Conteúdo do correspondente",
    ],
  });

  novaPagina(ctx);
  fichaTecnica(ctx, item);
  renderBlocos(ctx, parseMarkdown(item.conteudo));

  ctx.y += 10;
  texto(
    ctx,
    "Material orientativo. Taxas, prazos e políticas variam por banco e data — confirme sempre o normativo vigente.",
    { tamanho: 8.5, estilo: "italic", cor: ctx.P.cinza },
  );

  rodapes(ctx, "Agilliza · Biblioteca de Conhecimento");
  ctx.doc.save(filename ?? `${slug(item.titulo) || "verbete"}.pdf`);
}

/** PDF de coletânea: capa, sumário e verbetes agrupados por categoria. */
export function gerarCompendioPDF(
  itens: ItemBase[],
  opts: { titulo?: string; subtitulo?: string; filtro?: string; filename?: string } = {},
) {
  const titulo = opts.titulo ?? "Biblioteca de Conhecimento";
  const ctx = criarCtx(titulo);
  const { doc, P } = ctx;

  const grupos = new Map<string, ItemBase[]>();
  for (const it of itens) {
    const lista = grupos.get(it.categoria) ?? [];
    lista.push(it);
    grupos.set(it.categoria, lista);
  }
  for (const lista of grupos.values()) {
    lista.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
  }
  const categorias = [...grupos.keys()].sort((a, b) => a.localeCompare(b));

  capa(ctx, {
    chapeu: "Coletânea técnica · Crédito imobiliário",
    titulo,
    subtitulo:
      opts.subtitulo ??
      (opts.filtro ? `Seleção sobre “${opts.filtro}”` : "Verbetes curados pela equipe Agilliza"),
    meta: [
      `${itens.length} verbete${itens.length === 1 ? "" : "s"} · ${categorias.length} categoria${categorias.length === 1 ? "" : "s"}`,
      "Consultor IA — conhecimento fundamentado",
    ],
  });

  // Sumário
  novaPagina(ctx);
  texto(ctx, "Sumário", { tamanho: 17, estilo: "bold", cor: P.destaque, depois: 14 });
  const paginasSumario: { item: ItemBase; slot: { pagina: number; y: number } }[] = [];
  for (const cat of categorias) {
    garantir(ctx, 34);
    texto(ctx, rotuloCategoria(cat).toUpperCase(), {
      tamanho: 8.5,
      estilo: "bold",
      cor: P.cinza,
      depois: 4,
    });
    for (const it of grupos.get(cat)!) {
      garantir(ctx, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(P.texto);
      const linha = String(doc.splitTextToSize(it.titulo, ctx.util - 70)[0] ?? it.titulo);
      doc.text(linha, MARGEM + 10, ctx.y);
      const larguraTexto = doc.getTextWidth(linha);
      doc.setDrawColor(P.borda);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([1, 2], 0);
      doc.line(MARGEM + 16 + larguraTexto, ctx.y - 2, ctx.pageW - MARGEM - 26, ctx.y - 2);
      doc.setLineDashPattern([], 0);
      paginasSumario.push({
        item: it,
        slot: { pagina: doc.getNumberOfPages(), y: ctx.y },
      });
      ctx.y += 17;
    }
    ctx.y += 8;
  }

  // Verbetes
  const paginaDoItem = new Map<string, number>();
  for (const cat of categorias) {
    novaPagina(ctx);
    doc.setFillColor(P.card);
    doc.rect(MARGEM, ctx.y - 14, ctx.util, 42, "F");
    doc.setFillColor(P.coral);
    doc.rect(MARGEM, ctx.y - 14, 3, 42, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(P.destaque);
    doc.text(rotuloCategoria(cat), MARGEM + 16, ctx.y + 12);
    ctx.y += 52;

    for (const [idx, it] of grupos.get(cat)!.entries()) {
      if (idx > 0) novaPagina(ctx);
      paginaDoItem.set(it.id, doc.getNumberOfPages());
      texto(ctx, it.titulo, {
        tamanho: 16,
        estilo: "bold",
        cor: P.texto,
        entrelinha: 21,
        depois: 12,
      });
      fichaTecnica(ctx, it);
      renderBlocos(ctx, parseMarkdown(it.conteudo));
    }
  }

  // Preenche números de página no sumário
  for (const { item, slot } of paginasSumario) {
    const pag = paginaDoItem.get(item.id);
    if (!pag) continue;
    doc.setPage(slot.pagina);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(P.destaque);
    doc.text(String(pag - 1), ctx.pageW - MARGEM, slot.y, { align: "right" });
  }
  doc.setPage(doc.getNumberOfPages());

  rodapes(ctx, `Agilliza · ${titulo}`);
  doc.save(opts.filename ?? `${slug(titulo) || "biblioteca"}.pdf`);
}

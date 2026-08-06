/**
 * E-book PDF do verbete de FAQ gerado pelo Consultor IA.
 *
 * Documento institucional: capa com marca d'água, sumário, seções com tabelas,
 * exemplos, gráficos vetoriais, FAQ, glossário, checklist e fontes.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AGILLIZA_LOGO_LIGHT, AGILLIZA_LOGO_RATIO } from "@/lib/relatorios/brand-logo";
import { getPdfPalette } from "@/lib/relatorios/pdf-theme";
import { drawBrandHeader } from "@/lib/relatorios/report-pdf";
import type { EbookFaq, EbookGrafico } from "@/lib/consultor-ia/ebook.server";

const HEADER_H = 74;
const MARGEM = 48;

function fmtNum(v: number): string {
  return Math.abs(v) >= 1000
    ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
    : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function gerarEbookFaqPDF(ebook: EbookFaq, filename?: string) {
  const P = getPdfPalette();
  const doc = new jsPDF({ 
    unit: "pt", 
    format: "a4",
    compress: true
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const larguraUtil = pageW - MARGEM * 2;
  let y = 0;

  /* ───────────────────── Capa ───────────────────── */
  doc.setFillColor(P.azul);
  doc.rect(0, 0, pageW, pageH, "F");
  // marca d'água (círculos concêntricos)
  doc.setDrawColor(P.sep);
  doc.setLineWidth(1);
  for (let r = 90; r <= 320; r += 46) doc.circle(pageW - 60, pageH - 90, r, "S");
  doc.setFillColor(P.coral);
  doc.rect(0, pageH * 0.62, pageW, 4, "F");

  try {
    const logoH = 44;
    doc.addImage(AGILLIZA_LOGO_LIGHT, "PNG", MARGEM, 60, logoH * AGILLIZA_LOGO_RATIO, logoH);
  } catch {
    /* ignora */
  }

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BASE DE CONHECIMENTO · CRÉDITO IMOBILIÁRIO", MARGEM, pageH * 0.42);
  doc.setFontSize(28);
  const tituloCapa = doc.splitTextToSize(ebook.titulo, larguraUtil) as string[];
  doc.text(tituloCapa, MARGEM, pageH * 0.47 + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(P.subHead);
  const subCapa = doc.splitTextToSize(ebook.subtitulo, larguraUtil) as string[];
  doc.text(subCapa.slice(0, 3), MARGEM, pageH * 0.47 + 18 + tituloCapa.length * 30);

  doc.setFontSize(9.5);
  doc.text(
    `Categoria: ${ebook.categoria.replace(/_/g, " ")}`,
    MARGEM,
    pageH * 0.68,
  );
  if (ebook.tags.length) {
    const tags = doc.splitTextToSize(`Palavras-chave: ${ebook.tags.join(" · ")}`, larguraUtil) as string[];
    doc.text(tags.slice(0, 2), MARGEM, pageH * 0.68 + 16);
  }
  doc.text(
    `Agilliza · Crédito Imobiliário — Emitido em ${new Date().toLocaleDateString("pt-BR")}`,
    MARGEM,
    pageH - 54,
  );

  /* ─────────────── Helpers de conteúdo ─────────────── */
  function novaPagina() {
    doc.addPage();
    if (P.pageBg) {
      doc.setFillColor(P.pageBg);
      doc.rect(0, 0, pageW, pageH, "F");
    }
    drawBrandHeader(doc, pageW, HEADER_H, ebook.titulo, ebook.subtitulo);
    y = HEADER_H + 34;
  }

  function garantir(altura: number) {
    if (y + altura > pageH - 60) novaPagina();
  }

  function tituloSecao(texto: string) {
    garantir(56);
    doc.setFillColor(P.coral);
    doc.rect(MARGEM, y - 10, 3.5, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13.5);
    doc.setTextColor(P.destaque);
    const linhas = doc.splitTextToSize(texto, larguraUtil - 14) as string[];
    doc.text(linhas, MARGEM + 12, y + 2);
    y += linhas.length * 16 + 12;
  }

  function paragrafo(texto: string, opts: { cor?: string; tamanho?: number; italico?: boolean } = {}) {
    doc.setFont("helvetica", opts.italico ? "italic" : "normal");
    doc.setFontSize(opts.tamanho ?? 10);
    doc.setTextColor(opts.cor ?? P.texto);
    const linhas = doc.splitTextToSize(texto, larguraUtil) as string[];
    for (const l of linhas) {
      garantir(16);
      doc.text(l, MARGEM, y);
      y += 14.5;
    }
    y += 6;
  }

  function bullets(itens: string[], marcador = "•") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(P.texto);
    for (const item of itens) {
      const linhas = doc.splitTextToSize(item, larguraUtil - 18) as string[];
      garantir(linhas.length * 14 + 6);
      doc.setTextColor(P.destaque);
      doc.text(marcador, MARGEM + 2, y);
      doc.setTextColor(P.texto);
      doc.text(linhas, MARGEM + 18, y);
      y += linhas.length * 14 + 4;
    }
    y += 6;
  }

  function caixa(titulo: string, corpo: () => void) {
    garantir(70);
    const yIni = y;
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(P.destaque);
    doc.text(titulo, MARGEM + 14, y);
    y += 16;
    corpo();
    y += 6;
    // moldura (apenas quando não quebrou a página)
    if (y > yIni) {
      doc.setDrawColor(P.borda);
      doc.setLineWidth(0.8);
      doc.roundedRect(MARGEM, yIni, larguraUtil, y - yIni, 6, 6, "S");
    }
    y += 16;
  }

  function tabela(colunas: string[], linhas: string[][], titulo?: string) {
    if (titulo) {
      garantir(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(P.cinza);
      doc.text(titulo, MARGEM, y);
      y += 12;
    }
    autoTable(doc, {
      head: [colunas],
      body: linhas,
      startY: y,
      margin: { left: MARGEM, right: MARGEM, top: HEADER_H + 30 },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: P.texto, lineColor: P.borda, lineWidth: 0.4 },
      headStyles: { fillColor: P.azul, textColor: "#FFFFFF", fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: P.card },
      didDrawPage: () => {
        if (doc.getNumberOfPages() > 1) drawBrandHeader(doc, pageW, HEADER_H, ebook.titulo, ebook.subtitulo);
      },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 20;
  }

  function grafico(g: EbookGrafico) {
    const alturaArea = g.tipo === "pizza" ? 190 : 170;
    garantir(alturaArea + 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(P.destaque);
    doc.text(g.titulo, MARGEM, y);
    y += 14;

    const x0 = MARGEM + 46;
    const largura = larguraUtil - 60;
    const topo = y;
    const base = y + alturaArea - 40;
    const max = Math.max(...g.series.map((s) => s.valor));
    const min = Math.min(0, ...g.series.map((s) => s.valor));
    const span = max - min || 1;

    if (g.tipo === "pizza") {
      const total = g.series.reduce((a, s) => a + Math.abs(s.valor), 0) || 1;
      const cx = MARGEM + 100;
      const cy = topo + 78;
      const raio = 62;
      let ang = -Math.PI / 2;
      g.series.forEach((s, i) => {
        const fatia = (Math.abs(s.valor) / total) * Math.PI * 2;
        const passos = Math.max(2, Math.ceil((fatia / (Math.PI * 2)) * 60));
        const pontos: [number, number][] = [[cx, cy]];
        for (let k = 0; k <= passos; k++) {
          const a = ang + (fatia * k) / passos;
          pontos.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio]);
        }
        doc.setFillColor(i % 2 === 0 ? P.azul : P.coral);
        const rel = pontos.slice(1).map((p, idx) => [p[0] - pontos[idx][0], p[1] - pontos[idx][1]]);
        doc.lines(rel as any, pontos[0][0], pontos[0][1], [1, 1], "F", true);
        ang += fatia;
      });
      // legenda
      let ly = topo + 24;
      g.series.forEach((s, i) => {
        doc.setFillColor(i % 2 === 0 ? P.azul : P.coral);
        doc.rect(cx + 100, ly - 7, 9, 9, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(P.texto);
        const pct = ((Math.abs(s.valor) / total) * 100).toFixed(1);
        doc.text(`${s.rotulo} — ${fmtNum(s.valor)}${g.unidade ? ` ${g.unidade}` : ""} (${pct}%)`, cx + 116, ly);
        ly += 16;
      });
    } else {
      // eixos + grade
      doc.setDrawColor(P.borda);
      doc.setLineWidth(0.5);
      for (let i = 0; i <= 4; i++) {
        const gy = base - ((base - topo) * i) / 4;
        doc.line(x0, gy, x0 + largura, gy);
        doc.setFontSize(7.5);
        doc.setTextColor(P.cinza);
        doc.text(fmtNum(min + (span * i) / 4), x0 - 6, gy + 3, { align: "right" });
      }
      const passo = largura / g.series.length;
      if (g.tipo === "barras") {
        const larguraBarra = Math.min(46, passo * 0.55);
        g.series.forEach((s, i) => {
          const h = ((s.valor - min) / span) * (base - topo);
          const bx = x0 + passo * i + (passo - larguraBarra) / 2;
          doc.setFillColor(i % 2 === 0 ? P.azul : P.coral);
          doc.roundedRect(bx, base - h, larguraBarra, Math.max(h, 1), 2, 2, "F");
          doc.setFontSize(7.5);
          doc.setTextColor(P.texto);
          doc.text(fmtNum(s.valor), bx + larguraBarra / 2, base - h - 5, { align: "center" });
        });
      } else {
        doc.setDrawColor(P.azul);
        doc.setLineWidth(1.6);
        let ant: [number, number] | null = null;
        g.series.forEach((s, i) => {
          const px = x0 + passo * i + passo / 2;
          const py = base - ((s.valor - min) / span) * (base - topo);
          if (ant) doc.line(ant[0], ant[1], px, py);
          ant = [px, py];
        });
        g.series.forEach((s, i) => {
          const px = x0 + passo * i + passo / 2;
          const py = base - ((s.valor - min) / span) * (base - topo);
          doc.setFillColor(P.coral);
          doc.circle(px, py, 2.6, "F");
          doc.setFontSize(7.5);
          doc.setTextColor(P.texto);
          doc.text(fmtNum(s.valor), px, py - 7, { align: "center" });
        });
      }
      // rótulos do eixo X
      doc.setFontSize(7.5);
      doc.setTextColor(P.cinza);
      g.series.forEach((s, i) => {
        const px = x0 + passo * i + passo / 2;
        const rot = (doc.splitTextToSize(s.rotulo, passo + 10) as string[]).slice(0, 2);
        doc.text(rot, px, base + 12, { align: "center" });
      });
    }

    y = topo + alturaArea + 6;
    if (g.nota) paragrafo(g.nota, { cor: P.cinza, tamanho: 8.5, italico: true });
    y += 6;
  }

  /* ───────────────────── Miolo ───────────────────── */
  novaPagina();

  if (ebook.resumo_executivo) {
    tituloSecao("Resumo executivo");
    paragrafo(ebook.resumo_executivo);
  }
  if (ebook.pontos_chave.length) {
    tituloSecao("Pontos-chave");
    bullets(ebook.pontos_chave);
  }

  // Sumário
  if (ebook.secoes.length) {
    tituloSecao("Neste documento");
    bullets(
      ebook.secoes.map((s, i) => `${i + 1}. ${s.titulo}`).concat(
        ebook.exemplos.length ? ["Exemplos práticos"] : [],
        ebook.graficos.length ? ["Dados e gráficos"] : [],
        ebook.perguntas_frequentes.length ? ["Perguntas frequentes"] : [],
        ebook.checklist.length ? ["Checklist operacional"] : [],
        ebook.glossario.length ? ["Glossário"] : [],
        ebook.fontes_pesquisa.length ? ["Fontes de pesquisa"] : [],
      ),
      "›",
    );
  }

  ebook.secoes.forEach((s, i) => {
    tituloSecao(`${i + 1}. ${s.titulo}`);
    s.paragrafos.forEach((p) => paragrafo(p));
    if (s.bullets.length) bullets(s.bullets);
    if (s.tabela) tabela(s.tabela.colunas, s.tabela.linhas, s.tabela.titulo);
  });

  if (ebook.exemplos.length) {
    tituloSecao("Exemplos práticos");
    for (const ex of ebook.exemplos) {
      caixa(ex.titulo, () => {
        if (ex.cenario) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(P.texto);
          const linhas = doc.splitTextToSize(ex.cenario, larguraUtil - 28) as string[];
          for (const l of linhas) {
            garantir(14);
            doc.text(l, MARGEM + 14, y);
            y += 13.5;
          }
          y += 4;
        }
        ex.passos.forEach((p, i) => {
          const linhas = doc.splitTextToSize(`${i + 1}. ${p}`, larguraUtil - 34) as string[];
          garantir(linhas.length * 13 + 4);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(P.texto);
          doc.text(linhas, MARGEM + 20, y);
          y += linhas.length * 13 + 2;
        });
        if (ex.resultado) {
          y += 6;
          const linhas = doc.splitTextToSize(`Resultado: ${ex.resultado}`, larguraUtil - 28) as string[];
          garantir(linhas.length * 14);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(P.destaque);
          doc.text(linhas, MARGEM + 14, y);
          y += linhas.length * 14;
        }
      });
    }
  }

  if (ebook.graficos.length) {
    tituloSecao("Dados e gráficos");
    ebook.graficos.forEach((g) => grafico(g));
  }

  if (ebook.perguntas_frequentes.length) {
    tituloSecao("Perguntas frequentes");
    for (const f of ebook.perguntas_frequentes) {
      garantir(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(P.texto);
      const perg = doc.splitTextToSize(f.pergunta, larguraUtil) as string[];
      doc.text(perg, MARGEM, y);
      y += perg.length * 14 + 2;
      paragrafo(f.resposta, { cor: P.cinza, tamanho: 9.5 });
    }
  }

  if (ebook.checklist.length) {
    tituloSecao("Checklist operacional");
    for (const item of ebook.checklist) {
      const linhas = doc.splitTextToSize(item, larguraUtil - 24) as string[];
      garantir(linhas.length * 14 + 6);
      doc.setDrawColor(P.destaque);
      doc.setLineWidth(0.8);
      doc.roundedRect(MARGEM, y - 8, 9, 9, 1.5, 1.5, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(P.texto);
      doc.text(linhas, MARGEM + 18, y);
      y += linhas.length * 14 + 4;
    }
    y += 8;
  }

  if (ebook.glossario.length) {
    tituloSecao("Glossário");
    tabela(["Termo", "Definição"], ebook.glossario.map((g) => [g.termo, g.definicao]));
  }

  if (ebook.fontes_pesquisa.length || ebook.fontes_base.length) {
    tituloSecao("Fontes de pesquisa");
    if (ebook.fontes_pesquisa.length) {
      bullets(ebook.fontes_pesquisa.map((f) => (f.referencia ? `${f.titulo} — ${f.referencia}` : f.titulo)));
    }
    if (ebook.fontes_base.length) {
      paragrafo("Conteúdo interno consultado na base de conhecimento:", { cor: P.cinza, tamanho: 9 });
      bullets(ebook.fontes_base.map((f) => `${f.categoria.replace(/_/g, " ")} — ${f.titulo}`));
    }
    paragrafo(
      "Este material tem caráter orientativo. Taxas, prazos e políticas variam por banco e data; confirme sempre com o normativo vigente.",
      { cor: P.cinza, tamanho: 8.5, italico: true },
    );
  }

  /* ───────────────── Rodapés ───────────────── */
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    const fy = pageH - 26;
    doc.setDrawColor(P.borda);
    doc.setLineWidth(0.5);
    doc.line(MARGEM, fy, pageW - MARGEM, fy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(P.cinza);
    doc.text("Agilliza · Base de Conhecimento — Consultor IA", MARGEM, fy + 12);
    doc.text(`Página ${i - 1} de ${total - 1}`, pageW - MARGEM, fy + 12, { align: "right" });
  }

  const nome =
    filename ??
    `ebook-${ebook.titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)}.pdf`;
  doc.save(nome);
}

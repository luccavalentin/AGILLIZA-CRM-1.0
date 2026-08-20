import { jsPDF } from "jspdf";
import {
  AGILLIZA_LOGO_LIGHT,
  AGILLIZA_LOGO_DARK,
  AGILLIZA_LOGO_RATIO,
} from "@/lib/relatorios/brand-logo";
import {
  getPapelTimbradoModelo,
  type PapelTimbradoModelo,
  type PapelTimbradoModeloId,
} from "@/lib/formularios/papel-timbrado-modelos";

export interface PapelTimbradoDados {
  destinatario?: string;
  referencia?: string;
  cidade?: string;
  data?: string;
  saudacao?: string;
  mensagem?: string;
  despedida?: string;
  assinante?: string;
  cargo?: string;
  /** Modelo visual do papel timbrado. Padrão: institucional. */
  modelo?: PapelTimbradoModeloId;
}

const HEADER_H = 84;
const MARGEM = 48;
/** Margem interna dos modelos "real" (moldura ornamental). */
const MARGEM_REAL = 66;
const MOLDURA = 26;

/** Converte "#RRGGBB" em [r,g,b]. */
function hex(c: string): [number, number, number] {
  const m = c.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

function setOpacity(doc: jsPDF, opacity: number) {
  try {
    const g = doc as unknown as {
      GState: new (o: { opacity: number }) => unknown;
      setGState: (s: unknown) => void;
    };
    g.setGState(new g.GState({ opacity }));
  } catch {
    /* noop */
  }
}

/** Marca d'água central: símbolo/logo Agilliza em opacidade muito baixa. */
function drawWatermark(doc: jsPDF, pageW: number, pageH: number, cor: string) {
  const anyDoc = doc as unknown as {
    saveGraphicsState?: () => void;
    restoreGraphicsState?: () => void;
  };
  anyDoc.saveGraphicsState?.();
  setOpacity(doc, 0.06);
  const [r, g, b] = hex(cor);
  doc.setTextColor(r, g, b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(120);
  const texto = "AGILLIZA";
  const larguraTexto = doc.getTextWidth(texto);
  const cx = pageW / 2;
  const cy = pageH / 2;
  // jsPDF rotate: coordenada em torno do próprio ponto (x,y)
  doc.text(texto, cx - larguraTexto / 2, cy, { angle: 30 });
  // Segunda camada mais fina — decorativa
  setOpacity(doc, 0.04);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  const sub = "CRÉDITO IMOBILIÁRIO · CRÉDITO IMOBILIÁRIO · CRÉDITO IMOBILIÁRIO";
  const larguraSub = doc.getTextWidth(sub);
  doc.text(sub, cx - larguraSub / 2, cy + 18, { angle: 30 });
  anyDoc.restoreGraphicsState?.();
  // Reset
  doc.setTextColor(0, 0, 0);
}

/** Marca d'água heráldica (linha Real): selo/brasão gravado ao centro. */
function drawWatermarkReal(doc: jsPDF, pageW: number, pageH: number, m: PapelTimbradoModelo) {
  const anyDoc = doc as unknown as {
    saveGraphicsState?: () => void;
    restoreGraphicsState?: () => void;
  };
  const cx = pageW / 2;
  const cy = pageH / 2 + 10;
  const [r, g, b] = hex(m.marcaDagua);

  anyDoc.saveGraphicsState?.();
  setOpacity(doc, 0.075);
  doc.setDrawColor(r, g, b);
  doc.setTextColor(r, g, b);

  // Anéis concêntricos do selo
  doc.setLineWidth(2.2);
  doc.circle(cx, cy, 150, "S");
  doc.setLineWidth(0.6);
  doc.circle(cx, cy, 142, "S");
  doc.circle(cx, cy, 112, "S");

  // Raios finos (guilhoché simplificado)
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const x1 = cx + Math.cos(a) * 112;
    const y1 = cy + Math.sin(a) * 112;
    const x2 = cx + Math.cos(a) * (i % 6 === 0 ? 142 : 132);
    const y2 = cy + Math.sin(a) * (i % 6 === 0 ? 142 : 132);
    doc.setLineWidth(i % 6 === 0 ? 0.8 : 0.3);
    doc.line(x1, y1, x2, y2);
  }

  // Ornamento central conforme modelo
  if (m.ornamento === "coroa") {
    // Coroa estilizada
    const w = 96;
    const base = cy + 26;
    doc.setLineWidth(2);
    doc.line(cx - w / 2, base, cx + w / 2, base);
    doc.line(cx - w / 2, base - 10, cx + w / 2, base - 10);
    const pontas = [-1, -0.5, 0, 0.5, 1];
    pontas.forEach((p, i) => {
      const x = cx + (p * w) / 2;
      const h = i === 2 ? 62 : i % 2 === 0 ? 40 : 50;
      doc.setLineWidth(1.6);
      doc.line(x, base - 10, x, base - 10 - h);
      doc.circle(x, base - 16 - h, 5, "S");
    });
  } else if (m.ornamento === "laurel") {
    for (const lado of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const t = i / 9;
        const ang = Math.PI * (0.25 + t * 0.5) * lado;
        const rr = 78;
        const x = cx + Math.sin(ang) * rr * lado;
        const y = cy + 40 - t * 110;
        doc.setLineWidth(1.1);
        doc.ellipse(x, y, 13, 5.5, "S");
      }
    }
  } else if (m.ornamento === "selo") {
    doc.setLineWidth(1.4);
    doc.circle(cx, cy, 78, "S");
    doc.setLineWidth(0.6);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      doc.line(
        cx + Math.cos(a) * 78,
        cy + Math.sin(a) * 78,
        cx + Math.cos(a + Math.PI / 3) * 78,
        cy + Math.sin(a + Math.PI / 3) * 78,
      );
    }
  } else {
    // brasão / escudo
    doc.setLineWidth(1.8);
    const w = 88;
    const top = cy - 78;
    const bot = cy + 86;
    doc.line(cx - w, top, cx + w, top);
    doc.line(cx - w, top, cx - w, cy + 6);
    doc.line(cx + w, top, cx + w, cy + 6);
    doc.line(cx - w, cy + 6, cx, bot);
    doc.line(cx + w, cy + 6, cx, bot);
  }

  // Monograma A elegante
  doc.setFont("times", "bolditalic");
  doc.setFontSize(m.ornamento === "monograma" ? 210 : 140);
  doc.text("A", cx, cy + (m.ornamento === "monograma" ? 70 : 50), { align: "center" });

  // Texto circular inferior (aproximação em arco reto)
  setOpacity(doc, 0.12);
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("AGILLIZA · EXCELÊNCIA EM CRÉDITO", cx, cy + 130, {
    align: "center",
    charSpace: 3,
  });

  anyDoc.restoreGraphicsState?.();
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
}

/** Moldura ornamental dupla com cantos trabalhados (linha Real). */
function drawMolduraReal(doc: jsPDF, pageW: number, pageH: number, m: PapelTimbradoModelo) {
  const [pr, pg, pb] = hex(m.primaria);
  const [mr, mg, mb] = hex(m.metalico ?? m.destaque);

  // Fundo pergaminho
  if (m.fundo) {
    const [fr, fg, fb] = hex(m.fundo);
    doc.setFillColor(fr, fg, fb);
    doc.rect(0, 0, pageW, pageH, "F");
  }

  const x = MOLDURA;
  const y = MOLDURA;
  const w = pageW - MOLDURA * 2;
  const h = pageH - MOLDURA * 2;

  // Filete externo grosso + interno fino
  doc.setDrawColor(pr, pg, pb);
  doc.setLineWidth(1.8);
  doc.rect(x, y, w, h, "S");
  doc.setDrawColor(mr, mg, mb);
  doc.setLineWidth(0.7);
  doc.rect(x + 6, y + 6, w - 12, h - 12, "S");
  doc.setLineWidth(0.35);
  doc.rect(x + 10, y + 10, w - 20, h - 20, "S");

  // Cantos trabalhados (losangos + arcos)
  const cantos: Array<[number, number, number, number]> = [
    [x + 6, y + 6, 1, 1],
    [x + w - 6, y + 6, -1, 1],
    [x + 6, y + h - 6, 1, -1],
    [x + w - 6, y + h - 6, -1, -1],
  ];
  doc.setDrawColor(mr, mg, mb);
  for (const [cx0, cy0, sx, sy] of cantos) {
    doc.setLineWidth(0.9);
    doc.line(cx0 + sx * 22, cy0, cx0, cy0 + sy * 22);
    doc.setLineWidth(0.5);
    doc.line(cx0 + sx * 30, cy0 + sy * 4, cx0 + sx * 4, cy0 + sy * 30);
    doc.setFillColor(mr, mg, mb);
    doc.circle(cx0 + sx * 13, cy0 + sy * 13, 2.1, "F");
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.5);
    doc.line(cx0 + sx * 13, cy0 + sy * 34, cx0 + sx * 34, cy0 + sy * 13);
    doc.setDrawColor(mr, mg, mb);
  }
  doc.setLineWidth(0.2);
}

/** Cabeçalho régio centralizado. Retorna o Y inicial do corpo. */
function drawHeaderReal(doc: jsPDF, pageW: number, m: PapelTimbradoModelo): number {
  const [pr, pg, pb] = hex(m.primaria);
  const [mr, mg, mb] = hex(m.metalico ?? m.destaque);
  const cx = pageW / 2;

  const logoH = 30;
  const logoW = logoH * AGILLIZA_LOGO_RATIO;
  try {
    doc.addImage(AGILLIZA_LOGO_DARK, "PNG", cx - logoW / 2, 58, logoW, logoH);
  } catch {}

  doc.setTextColor(pr, pg, pb);
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.text("AGILLIZA", cx, 118, { align: "center", charSpace: 8 });

  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(mr, mg, mb);
  doc.text("SOLUÇÕES EM CRÉDITO IMOBILIÁRIO", cx, 134, { align: "center", charSpace: 4 });

  // Divisor ornamental: linha — losango — linha
  const yDiv = 148;
  const meia = (pageW - MARGEM_REAL * 2) / 2;
  doc.setDrawColor(mr, mg, mb);
  doc.setLineWidth(0.7);
  doc.line(MARGEM_REAL, yDiv, cx - 22, yDiv);
  doc.line(cx + 22, yDiv, MARGEM_REAL + meia * 2, yDiv);
  doc.setFillColor(mr, mg, mb);
  doc.circle(cx, yDiv, 3.2, "F");
  doc.setDrawColor(pr, pg, pb);
  doc.setLineWidth(0.4);
  doc.circle(cx, yDiv, 7.5, "S");
  doc.line(cx - 14, yDiv, cx - 9, yDiv);
  doc.line(cx + 9, yDiv, cx + 14, yDiv);

  if (m.lema) {
    doc.setFont("times", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(150, 140, 120);
    doc.text(m.lema, cx, yDiv + 16, { align: "center", charSpace: 1.2 });
  }

  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.2);
  return yDiv + 42;
}

/** Cabeçalho institucional por modelo. Retorna o Y inicial do corpo. */
function drawHeader(doc: jsPDF, pageW: number, m: PapelTimbradoModelo): number {
  if (m.estilo === "real") return drawHeaderReal(doc, pageW, m);

  const [r, g, b] = hex(m.primaria);
  const [rd, gd, bd] = hex(m.primariaEscura);

  if (m.estilo === "faixa") {
    // Faixa preenchida (com meia-faixa mais escura à direita para dar profundidade)
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageW, HEADER_H, "F");
    doc.setFillColor(rd, gd, bd);
    doc.rect(pageW * 0.55, 0, pageW * 0.45, HEADER_H, "F");
    // Linha coral/destaque abaixo
    const [dr, dg, db] = hex(m.destaque);
    doc.setFillColor(dr, dg, db);
    doc.rect(0, HEADER_H, pageW, 3, "F");

    // Logo branca à esquerda
    const logoH = 34;
    const logoW = logoH * AGILLIZA_LOGO_RATIO;
    try {
      doc.addImage(AGILLIZA_LOGO_LIGHT, "PNG", 32, (HEADER_H - logoH) / 2, logoW, logoH);
    } catch {}
    // Título
    doc.setTextColor("#FFFFFF");
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("Agilliza · Crédito Imobiliário", 32 + logoW + 22, HEADER_H / 2 - 3);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Documento Oficial", 32 + logoW + 22, HEADER_H / 2 + 13);
  } else if (m.estilo === "hairline") {
    // Cabeçalho branco com hairline colorido e logo escura
    const logoH = 30;
    const logoW = logoH * AGILLIZA_LOGO_RATIO;
    try {
      doc.addImage(AGILLIZA_LOGO_DARK, "PNG", 32, 30, logoW, logoH);
    } catch {}
    // Título à direita
    doc.setTextColor(r, g, b);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("AGILLIZA", pageW - 32, 40, { align: "right" });
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("Correspondente · Crédito Imobiliário", pageW - 32, 54, { align: "right" });
    // Hairline dupla
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(1.2);
    doc.line(32, HEADER_H, pageW - 32, HEADER_H);
    doc.setLineWidth(0.4);
    doc.line(32, HEADER_H + 4, pageW - 32, HEADER_H + 4);
  } else {
    // Borda-lateral: barra vertical colorida à esquerda + logo escura
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, 14, HEADER_H + 14, "F");
    const [dr, dg, db] = hex(m.destaque);
    doc.setFillColor(dr, dg, db);
    doc.rect(0, HEADER_H, 14, 14, "F");

    const logoH = 30;
    const logoW = logoH * AGILLIZA_LOGO_RATIO;
    try {
      doc.addImage(AGILLIZA_LOGO_DARK, "PNG", 32, 28, logoW, logoH);
    } catch {}
    doc.setTextColor(r, g, b);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Agilliza · Crédito Imobiliário", pageW - 32, 40, { align: "right" });
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("Documento Oficial", pageW - 32, 54, { align: "right" });
    // Hairline discreto
    doc.setDrawColor(220, 220, 226);
    doc.setLineWidth(0.5);
    doc.line(32, HEADER_H + 2, pageW - 32, HEADER_H + 2);
  }
  return HEADER_H + 44;
}

/** Pinta fundo + marca d'água + moldura + cabeçalho de uma página. */
function drawPagina(doc: jsPDF, pageW: number, pageH: number, m: PapelTimbradoModelo): number {
  if (m.estilo === "real") {
    drawMolduraReal(doc, pageW, pageH, m);
    drawWatermarkReal(doc, pageW, pageH, m);
  } else {
    drawWatermark(doc, pageW, pageH, m.marcaDagua);
  }
  return drawHeader(doc, pageW, m);
}

/**
 * Gera um PDF de papel timbrado Agilliza. Se `dados` estiver vazio ou omitido
 * (fora `modelo`), emite apenas o cabeçalho + marca d'água + rodapé.
 */
export function gerarPapelTimbradoPDF(dados: PapelTimbradoDados = {}, filename?: string) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const modelo = getPapelTimbradoModelo(dados.modelo);

  const [rDest, gDest, bDest] = hex(modelo.destaqueTexto);
  const [rTxt, gTxt, bTxt] = [11, 11, 15];
  const [rCinza, gCinza, bCinza] = [107, 114, 128];
  const [rBorda, gBorda, bBorda] = [228, 230, 239];

  const ehReal = modelo.estilo === "real";
  const margem = ehReal ? MARGEM_REAL : MARGEM;

  // Página 1
  let y = drawPagina(doc, pageW, pageH, modelo);
  const largura = pageW - margem * 2;
  const fonteCorpo = ehReal ? "times" : "helvetica";

  const linhaCabecalho = [dados.cidade?.trim(), dados.data?.trim()].filter(Boolean).join(", ");
  if (linhaCabecalho) {
    doc.setFont(fonteCorpo, "normal");
    doc.setFontSize(11);
    doc.setTextColor(rTxt, gTxt, bTxt);
    doc.text(linhaCabecalho, pageW - margem, y, { align: "right" });
    y += 28;
  }

  if (dados.destinatario?.trim()) {
    doc.setFont(fonteCorpo, "normal");
    doc.setFontSize(11);
    doc.setTextColor(rTxt, gTxt, bTxt);
    const linhas = doc.splitTextToSize(dados.destinatario.trim(), largura) as string[];
    linhas.forEach((l) => {
      doc.text(l, margem, y);
      y += 14;
    });
    y += 10;
  }

  if (dados.referencia?.trim()) {
    doc.setFont(fonteCorpo, "bold");
    doc.setFontSize(11);
    doc.setTextColor(rDest, gDest, bDest);
    doc.text("Ref.:", margem, y);
    doc.setFont(fonteCorpo, "normal");
    doc.setTextColor(rTxt, gTxt, bTxt);
    const refLinhas = doc.splitTextToSize(dados.referencia.trim(), largura - 40) as string[];
    refLinhas.forEach((l, i) => {
      doc.text(l, margem + 40, y + i * 14);
    });
    y += Math.max(20, refLinhas.length * 14 + 8);
  }

  if (dados.saudacao?.trim()) {
    doc.setFont(fonteCorpo, "normal");
    doc.setFontSize(11);
    doc.setTextColor(rTxt, gTxt, bTxt);
    doc.text(dados.saudacao.trim(), margem, y);
    y += 22;
  }

  if (dados.mensagem?.trim()) {
    doc.setFont(fonteCorpo, "normal");
    doc.setFontSize(11);
    doc.setTextColor(rTxt, gTxt, bTxt);
    const paragrafos = dados.mensagem.trim().split(/\n{2,}/);
    for (const par of paragrafos) {
      const linhas = doc.splitTextToSize(par.replace(/\n/g, " "), largura) as string[];
      for (const l of linhas) {
        if (y > pageH - (ehReal ? 160 : 140)) {
          doc.addPage();
          y = drawPagina(doc, pageW, pageH, modelo);
          doc.setFont(fonteCorpo, "normal");
          doc.setFontSize(11);
          doc.setTextColor(rTxt, gTxt, bTxt);
        }
        doc.text(l, margem, y, { maxWidth: largura });
        y += 16;
      }
      y += 8;
    }
    y += 8;
  }

  if (dados.despedida?.trim()) {
    doc.setFont(fonteCorpo, "normal");
    doc.setFontSize(11);
    doc.setTextColor(rTxt, gTxt, bTxt);
    doc.text(dados.despedida.trim(), margem, y);
    y += 40;
  }

  if (dados.assinante?.trim() || dados.cargo?.trim()) {
    if (ehReal) {
      const [mr, mg, mb] = hex(modelo.metalico ?? modelo.destaque);
      doc.setDrawColor(mr, mg, mb);
    } else {
      doc.setDrawColor(rBorda, gBorda, bBorda);
    }
    doc.setLineWidth(0.75);
    doc.line(margem, y, margem + 240, y);
    y += 14;
    if (dados.assinante?.trim()) {
      doc.setFont(fonteCorpo, "bold");
      doc.setFontSize(11);
      doc.setTextColor(rDest, gDest, bDest);
      doc.text(dados.assinante.trim(), margem, y);
      y += 14;
    }
    if (dados.cargo?.trim()) {
      doc.setFont(fonteCorpo, "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(rCinza, gCinza, bCinza);
      doc.text(dados.cargo.trim(), margem, y);
    }
  }

  // Rodapé institucional (por página)
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const yF = pageH - (ehReal ? 56 : 30);
    if (ehReal) {
      const [mr, mg, mb] = hex(modelo.metalico ?? modelo.destaque);
      doc.setDrawColor(mr, mg, mb);
      doc.setLineWidth(0.5);
      doc.line(margem, yF, pageW - margem, yF);
      doc.setFillColor(mr, mg, mb);
      doc.circle(pageW / 2, yF, 2.2, "F");
      doc.setFont("times", "normal");
    } else {
      doc.setDrawColor(rBorda, gBorda, bBorda);
      doc.setLineWidth(0.5);
      doc.line(margem, yF, pageW - margem, yF);
      doc.setFont("helvetica", "normal");
    }
    doc.setFontSize(7.5);
    doc.setTextColor(rCinza, gCinza, bCinza);
    const emitido = new Date().toLocaleString("pt-BR");
    doc.text(`${modelo.rodape}  —  Emitido em ${emitido}`, margem, yF + 14);
    doc.text(`Página ${i} de ${total}`, pageW - margem, yF + 14, { align: "right" });
  }

  const suf = modelo.id;
  const nome =
    filename ??
    (temConteudo(dados)
      ? `papel-timbrado-agilliza-${suf}.pdf`
      : `papel-timbrado-agilliza-${suf}-em-branco.pdf`);
  doc.save(nome);
}

function temConteudo(d: PapelTimbradoDados): boolean {
  return Object.entries(d).some(
    ([k, v]) => k !== "modelo" && typeof v === "string" && v.trim().length > 0,
  );
}

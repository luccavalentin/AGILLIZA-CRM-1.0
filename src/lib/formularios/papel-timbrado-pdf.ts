import { jsPDF } from "jspdf";
import { AGILLIZA_LOGO_LIGHT, AGILLIZA_LOGO_DARK, AGILLIZA_LOGO_RATIO } from "@/lib/relatorios/brand-logo";
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

/** Converte "#RRGGBB" em [r,g,b]. */
function hex(c: string): [number, number, number] {
  const m = c.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

/** Marca d'água central: símbolo/logo Agilliza em opacidade muito baixa. */
function drawWatermark(doc: jsPDF, pageW: number, pageH: number, cor: string) {
  const gState = (doc as unknown as {
    GState: new (opts: { opacity: number }) => unknown;
    setGState: (g: unknown) => void;
  });
  const anyDoc = doc as unknown as {
    saveGraphicsState?: () => void;
    restoreGraphicsState?: () => void;
  };
  anyDoc.saveGraphicsState?.();
  try {
    gState.setGState(new gState.GState({ opacity: 0.06 }));
  } catch {
    /* fallback: apenas cor clara */
  }
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
  try {
    gState.setGState(new gState.GState({ opacity: 0.04 }));
  } catch {}
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  const sub = "CRÉDITO IMOBILIÁRIO · CRÉDITO IMOBILIÁRIO · CRÉDITO IMOBILIÁRIO";
  const larguraSub = doc.getTextWidth(sub);
  doc.text(sub, cx - larguraSub / 2, cy + 18, { angle: 30 });
  anyDoc.restoreGraphicsState?.();
  // Reset
  doc.setTextColor(0, 0, 0);
}

/** Cabeçalho institucional por modelo. */
function drawHeader(doc: jsPDF, pageW: number, m: PapelTimbradoModelo) {
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
}

/**
 * Gera um PDF de papel timbrado Agilliza. Se `dados` estiver vazio ou omitido
 * (fora `modelo`), emite apenas o cabeçalho + marca d'água + rodapé.
 */
export function gerarPapelTimbradoPDF(dados: PapelTimbradoDados = {}, filename?: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const modelo = getPapelTimbradoModelo(dados.modelo);

  const [rDest, gDest, bDest] = hex(modelo.destaqueTexto);
  const [rTxt, gTxt, bTxt] = [11, 11, 15];
  const [rCinza, gCinza, bCinza] = [107, 114, 128];
  const [rBorda, gBorda, bBorda] = [228, 230, 239];

  // Página 1
  drawWatermark(doc, pageW, pageH, modelo.marcaDagua);
  drawHeader(doc, pageW, modelo);

  let y = HEADER_H + 44;
  const largura = pageW - MARGEM * 2;

  const linhaCabecalho = [dados.cidade?.trim(), dados.data?.trim()].filter(Boolean).join(", ");
  if (linhaCabecalho) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(rTxt, gTxt, bTxt);
    doc.text(linhaCabecalho, pageW - MARGEM, y, { align: "right" });
    y += 28;
  }

  if (dados.destinatario?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(rDest, gDest, bDest);
    doc.text("Ao(À):", MARGEM, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(rTxt, gTxt, bTxt);
    const linhas = doc.splitTextToSize(dados.destinatario.trim(), largura) as string[];
    linhas.forEach((l) => {
      doc.text(l, MARGEM, y);
      y += 14;
    });
    y += 10;
  }

  if (dados.referencia?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(rDest, gDest, bDest);
    doc.text("Ref.:", MARGEM, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(rTxt, gTxt, bTxt);
    const refLinhas = doc.splitTextToSize(dados.referencia.trim(), largura - 40) as string[];
    refLinhas.forEach((l, i) => {
      doc.text(l, MARGEM + 40, y + i * 14);
    });
    y += Math.max(20, refLinhas.length * 14 + 8);
  }

  if (dados.saudacao?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(rTxt, gTxt, bTxt);
    doc.text(dados.saudacao.trim(), MARGEM, y);
    y += 22;
  }

  if (dados.mensagem?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(rTxt, gTxt, bTxt);
    const paragrafos = dados.mensagem.trim().split(/\n{2,}/);
    for (const par of paragrafos) {
      const linhas = doc.splitTextToSize(par.replace(/\n/g, " "), largura) as string[];
      for (const l of linhas) {
        if (y > pageH - 140) {
          doc.addPage();
          drawWatermark(doc, pageW, pageH, modelo.marcaDagua);
          drawHeader(doc, pageW, modelo);
          y = HEADER_H + 44;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(rTxt, gTxt, bTxt);
        }
        doc.text(l, MARGEM, y, { maxWidth: largura });
        y += 16;
      }
      y += 8;
    }
    y += 8;
  }

  if (dados.despedida?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(rTxt, gTxt, bTxt);
    doc.text(dados.despedida.trim(), MARGEM, y);
    y += 40;
  }

  if (dados.assinante?.trim() || dados.cargo?.trim()) {
    doc.setDrawColor(rBorda, gBorda, bBorda);
    doc.setLineWidth(0.75);
    doc.line(MARGEM, y, MARGEM + 240, y);
    y += 14;
    if (dados.assinante?.trim()) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(rDest, gDest, bDest);
      doc.text(dados.assinante.trim(), MARGEM, y);
      y += 14;
    }
    if (dados.cargo?.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(rCinza, gCinza, bCinza);
      doc.text(dados.cargo.trim(), MARGEM, y);
    }
  }

  // Rodapé institucional (por página)
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const yF = pageH - 30;
    doc.setDrawColor(rBorda, gBorda, bBorda);
    doc.setLineWidth(0.5);
    doc.line(MARGEM, yF, pageW - MARGEM, yF);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(rCinza, gCinza, bCinza);
    const emitido = new Date().toLocaleString("pt-BR");
    doc.text(`${modelo.rodape}  —  Emitido em ${emitido}`, MARGEM, yF + 12);
    doc.text(`Página ${i} de ${total}`, pageW - MARGEM, yF + 12, { align: "right" });
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

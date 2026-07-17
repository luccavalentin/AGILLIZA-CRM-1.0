import { jsPDF } from "jspdf";
import { drawBrandHeader } from "@/lib/relatorios/report-pdf";
import { getPdfPalette } from "@/lib/relatorios/pdf-theme";

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
}

const HEADER_H = 84;
const MARGEM = 48;

/**
 * Gera um PDF de papel timbrado Agilliza. Se `dados` estiver vazio ou omitido,
 * emite apenas o cabeçalho institucional + rodapé (papel timbrado em branco,
 * pronto para escrita manual).
 */
export function gerarPapelTimbradoPDF(dados: PapelTimbradoDados = {}, filename?: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const P = getPdfPalette();

  // Cabeçalho institucional
  drawBrandHeader(doc, pageW, HEADER_H, "Agilliza · Crédito Imobiliário", "Documento Oficial");

  let y = HEADER_H + 44;

  const largura = pageW - MARGEM * 2;

  const linhaCabecalho = [dados.cidade?.trim(), dados.data?.trim()].filter(Boolean).join(", ");
  if (linhaCabecalho) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(P.texto);
    doc.text(linhaCabecalho, pageW - MARGEM, y, { align: "right" });
    y += 28;
  }

  if (dados.destinatario?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(P.destaque);
    doc.text("Ao(À):", MARGEM, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(P.texto);
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
    doc.setTextColor(P.destaque);
    doc.text("Ref.:", MARGEM, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(P.texto);
    const refLinhas = doc.splitTextToSize(dados.referencia.trim(), largura - 40) as string[];
    refLinhas.forEach((l, i) => {
      doc.text(l, MARGEM + 40, y + i * 14);
    });
    y += Math.max(20, refLinhas.length * 14 + 8);
  }

  if (dados.saudacao?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(P.texto);
    doc.text(dados.saudacao.trim(), MARGEM, y);
    y += 22;
  }

  if (dados.mensagem?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(P.texto);
    const paragrafos = dados.mensagem.trim().split(/\n{2,}/);
    for (const par of paragrafos) {
      const linhas = doc.splitTextToSize(par.replace(/\n/g, " "), largura) as string[];
      for (const l of linhas) {
        if (y > pageH - 140) {
          doc.addPage();
          drawBrandHeader(doc, pageW, HEADER_H, "Agilliza · Crédito Imobiliário", "Documento Oficial");
          y = HEADER_H + 44;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(P.texto);
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
    doc.setTextColor(P.texto);
    doc.text(dados.despedida.trim(), MARGEM, y);
    y += 40;
  }

  if (dados.assinante?.trim() || dados.cargo?.trim()) {
    // linha de assinatura
    doc.setDrawColor(P.borda);
    doc.setLineWidth(0.75);
    doc.line(MARGEM, y, MARGEM + 240, y);
    y += 14;
    if (dados.assinante?.trim()) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(P.destaque);
      doc.text(dados.assinante.trim(), MARGEM, y);
      y += 14;
    }
    if (dados.cargo?.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(P.cinza);
      doc.text(dados.cargo.trim(), MARGEM, y);
    }
  }

  // Rodapé institucional
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const yF = pageH - 30;
    doc.setDrawColor(P.borda);
    doc.setLineWidth(0.5);
    doc.line(MARGEM, yF, pageW - MARGEM, yF);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(P.cinza);
    const emitido = new Date().toLocaleString("pt-BR");
    doc.text(`Agilliza · Crédito Imobiliário  —  Emitido em ${emitido}`, MARGEM, yF + 12);
    doc.text(`Página ${i} de ${total}`, pageW - MARGEM, yF + 12, { align: "right" });
  }

  const nome = filename ?? (temConteudo(dados) ? "papel-timbrado-agilliza.pdf" : "papel-timbrado-agilliza-em-branco.pdf");
  doc.save(nome);
}

function temConteudo(d: PapelTimbradoDados): boolean {
  return Object.values(d).some((v) => typeof v === "string" && v.trim().length > 0);
}

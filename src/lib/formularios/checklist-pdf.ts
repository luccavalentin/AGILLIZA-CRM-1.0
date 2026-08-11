import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AGILLIZA_LOGO_LIGHT, AGILLIZA_LOGO_RATIO } from "@/lib/relatorios/brand-logo";
import { resolveBancoBrand } from "@/lib/relatorios/banco-brand";
import { CHECKLISTS_BANCOS } from "@/lib/formularios/checklists.functions";

export async function gerarChecklistBancoPDF(
  bancoId: string,
  clienteNome?: string,
  docsCustom?: (string | { nome: string; obrigatorio: boolean })[],
) {
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGIN = 20;

  const checklistRaw = docsCustom ? { docs: docsCustom } : CHECKLISTS_BANCOS[bancoId];
  if (!checklistRaw) throw new Error("Checklist não encontrado para este banco.");

  const docsProcessados = checklistRaw.docs.map((item) => {
    if (typeof item === "string") return { nome: item, obrigatorio: true };
    return item;
  });

  const bancoBrand = resolveBancoBrand(bancoId);

  // Cores da Agilliza
  const AGILLIZA_NAVY = "#0F172A";
  const AGILLIZA_CORAL = "#F97316";

  // Header Agilliza (Azul Marinho)
  doc.setFillColor(AGILLIZA_NAVY);
  doc.rect(0, 0, pageW, 40, "F");

  // Linha Coral (Agilliza)
  doc.setFillColor(AGILLIZA_CORAL);
  doc.rect(0, 40, pageW, 2, "F");

  // Logo Agilliza (Superior Esquerda)
  const logoH = 18;
  const logoW = logoH * AGILLIZA_LOGO_RATIO;
  try {
    doc.addImage(AGILLIZA_LOGO_LIGHT, "PNG", MARGIN, 11, logoW, logoH);
  } catch (e) {}

  let y = 58;

  // Título do Checklist (Abaixo do Header, alinhado à esquerda)
  doc.setTextColor(AGILLIZA_NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const bancoNome = (bancoId === "itau" ? "Itaú" : bancoId).toUpperCase();
  const tituloTexto = `CHECKLIST DE DOCUMENTAÇÃO - ${bancoNome}`;
  doc.text(tituloTexto, MARGIN, y);

  // Logo do Banco (Logo após o nome, com alinhamento vertical corrigido)
  if (bancoBrand?.logo) {
    try {
      const bLogoH = 8; // Ligeiramente menor para alinhar melhor com o texto
      const bLogoW = bLogoH * (bancoBrand.ratio || 1);
      const textWidth = doc.getTextWidth(tituloTexto);
      // Alinhamento vertical da logo com o texto (baseline do texto é y, altura da logo é bLogoH)
      // O offset de -bLogoH + 1.5 geralmente coloca a logo centralizada visualmente com letras maiúsculas
      doc.addImage(
        bancoBrand.logo,
        "PNG",
        MARGIN + textWidth + 8,
        y - bLogoH + 1.5,
        bLogoW,
        bLogoH,
      );
    } catch (e) {}
  }

  y += 12;

  // Removida a frase: "Relação de documentos necessários para análise de crédito imobiliário."

  // Dados do Cliente
  if (clienteNome) {
    doc.setTextColor(AGILLIZA_NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Cliente: ${clienteNome.toUpperCase()}`, MARGIN, y);
    y += 8;
  }

  // Tabela de Documentos (Cores da Agilliza)
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["", "Documento Necessário", "Obrigatório"]],
    body: docsProcessados.map((item) => ["[  ]", item.nome, item.obrigatorio ? "Sim" : "Não"]),
    theme: "striped",
    headStyles: {
      fillColor: AGILLIZA_NAVY,
      textColor: "#FFFFFF",
      fontSize: 10,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: "#334155",
    },
    columnStyles: {
      0: { cellWidth: 15, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
    },
    alternateRowStyles: {
      fillColor: "#F8FAFC",
    },
  });

  // Download
  const filename = `Checklist - ${bancoId.toUpperCase()} - ${clienteNome || "Documentos"}.pdf`;
  doc.save(filename);
}

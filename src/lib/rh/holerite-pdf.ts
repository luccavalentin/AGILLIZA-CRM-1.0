/**
 * Gera o PDF do holerite (recibo de pagamento) com identidade Agilliza.
 * Client-side (jsPDF + autoTable). Retorna um Blob para upload ao Storage
 * ou download direto pelo usuário.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { drawBrandHeader } from "@/lib/relatorios/report-pdf";
import { getPdfPalette, type PdfPalette } from "@/lib/relatorios/pdf-theme";
import { formatBRL } from "@/lib/simulacao/format";

const MESES_LONGOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface HoleriteInput {
  competencia: { mes: number; ano: number };
  correspondente_nome?: string | null;
  funcionario: {
    nome: string;
    numero?: string | null;
    cpf?: string | null;
    cargo?: string | null;
    departamento?: string | null;
  };
  salario_base: number;
  detalhamento: {
    beneficios_valor?: number;
    beneficios_desconto?: number;
    adiantamentos?: number;
    descontos_lancados?: number;
    proventos_avulsos?: number;
    descontos_avulsos?: number;
  };
  ajustes?: Array<{ tipo: "provento" | "desconto"; descricao: string; valor: number }>;
  liquido: number;
}

function fmtCpf(cpf?: string | null): string {
  if (!cpf) return "—";
  const d = String(cpf).replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function gerarHoleritePdf(input: HoleriteInput): { blob: Blob; filename: string } {
  const P: PdfPalette = getPdfPalette();
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  if (P.pageBg) {
    doc.setFillColor(P.pageBg);
    doc.rect(0, 0, pageW, pageH, "F");
  }

  const HEADER_H = 70;
  const compLabel = `${MESES_LONGOS[input.competencia.mes - 1]}/${input.competencia.ano}`;
  drawBrandHeader(
    doc,
    pageW,
    HEADER_H,
    "Holerite · Recibo de pagamento",
    `Competência ${compLabel}`,
  );

  let y = HEADER_H + 26;

  // Bloco de identificação do funcionário
  const boxX = 32;
  const boxW = pageW - 64;
  const boxH = 78;
  doc.setFillColor(P.card);
  doc.setDrawColor(P.borda);
  doc.setLineWidth(0.75);
  doc.roundedRect(boxX, y, boxW, boxH, 6, 6, "FD");
  doc.setFillColor(P.coral);
  doc.rect(boxX, y + 12, 3, boxH - 24, "F");

  const infos: Array<{ label: string; value: string }> = [
    { label: "FUNCIONÁRIO", value: input.funcionario.nome },
    { label: "MATRÍCULA", value: input.funcionario.numero ?? "—" },
    { label: "CPF", value: fmtCpf(input.funcionario.cpf) },
    { label: "CARGO", value: input.funcionario.cargo ?? "—" },
    { label: "DEPARTAMENTO", value: input.funcionario.departamento ?? "—" },
    { label: "COMPETÊNCIA", value: compLabel },
  ];
  const cols = 3;
  const rows = Math.ceil(infos.length / cols);
  const colW = (boxW - 32) / cols;
  const rowH = (boxH - 20) / rows;
  infos.forEach((it, i) => {
    const cx = boxX + 16 + (i % cols) * colW;
    const cy = y + 10 + Math.floor(i / cols) * rowH;
    doc.setTextColor(P.cinza);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(it.label, cx, cy + 10);
    doc.setTextColor(P.destaque);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const val = doc.splitTextToSize(String(it.value), colW - 12)[0] ?? it.value;
    doc.text(val, cx, cy + 24);
  });
  y += boxH + 18;

  // Monta linhas de proventos e descontos
  const d = input.detalhamento;
  const proventos: Array<{ desc: string; ref: string; valor: number }> = [];
  const descontos: Array<{ desc: string; ref: string; valor: number }> = [];

  proventos.push({ desc: "Salário base", ref: "30 dias", valor: input.salario_base });
  if ((d.beneficios_valor ?? 0) > 0) {
    proventos.push({ desc: "Benefícios (provento)", ref: "—", valor: d.beneficios_valor ?? 0 });
  }
  if ((d.proventos_avulsos ?? 0) > 0) {
    (input.ajustes ?? [])
      .filter((a) => a.tipo === "provento")
      .forEach((a) => proventos.push({ desc: a.descricao, ref: "avulso", valor: a.valor }));
  }
  if ((d.beneficios_desconto ?? 0) > 0) {
    descontos.push({ desc: "Benefícios (desconto)", ref: "—", valor: d.beneficios_desconto ?? 0 });
  }
  if ((d.descontos_lancados ?? 0) > 0) {
    descontos.push({ desc: "Descontos lançados", ref: "—", valor: d.descontos_lancados ?? 0 });
  }
  if ((d.adiantamentos ?? 0) > 0) {
    descontos.push({ desc: "Adiantamentos", ref: "—", valor: d.adiantamentos ?? 0 });
  }
  if ((d.descontos_avulsos ?? 0) > 0) {
    (input.ajustes ?? [])
      .filter((a) => a.tipo === "desconto")
      .forEach((a) => descontos.push({ desc: a.descricao, ref: "avulso", valor: a.valor }));
  }

  const totalProv = proventos.reduce((s, r) => s + r.valor, 0);
  const totalDesc = descontos.reduce((s, r) => s + r.valor, 0);

  // Tabela de proventos e descontos lado a lado (usando uma tabela única com 4 colunas)
  const linhas = Math.max(proventos.length, descontos.length);
  const body: any[] = [];
  for (let i = 0; i < linhas; i++) {
    const p = proventos[i];
    const de = descontos[i];
    body.push([
      p ? p.desc : "",
      p ? formatBRL(p.valor) : "",
      de ? de.desc : "",
      de ? formatBRL(de.valor) : "",
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Proventos", "Valor (R$)", "Descontos", "Valor (R$)"]],
    body,
    theme: "grid",
    headStyles: {
      fillColor: P.azul as any,
      textColor: "#FFFFFF",
      halign: "left",
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 9, textColor: P.destaque as any, cellPadding: 5 },
    alternateRowStyles: { fillColor: P.card as any },
    columnStyles: {
      0: { cellWidth: (pageW - 64) * 0.32 },
      1: { cellWidth: (pageW - 64) * 0.18, halign: "right" },
      2: { cellWidth: (pageW - 64) * 0.32 },
      3: { cellWidth: (pageW - 64) * 0.18, halign: "right" },
    },
    foot: [[
      { content: "Total de proventos", styles: { fontStyle: "bold" } },
      { content: formatBRL(totalProv), styles: { halign: "right", fontStyle: "bold" } },
      { content: "Total de descontos", styles: { fontStyle: "bold" } },
      { content: formatBRL(totalDesc), styles: { halign: "right", fontStyle: "bold" } },
    ]],
    footStyles: {
      fillColor: P.card as any,
      textColor: P.destaque as any,
      fontSize: 9,
    },
    margin: { left: 32, right: 32 },
  });

  y = (doc as any).lastAutoTable.finalY + 18;

  // Painel líquido a receber
  const netH = 58;
  doc.setFillColor(P.azul);
  doc.roundedRect(32, y, pageW - 64, netH, 6, 6, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("LÍQUIDO A RECEBER", 48, y + 22);
  doc.setFontSize(20);
  doc.text(formatBRL(input.liquido), pageW - 48, y + 32, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Salário base ${formatBRL(input.salario_base)} · Proventos ${formatBRL(totalProv)} · Descontos ${formatBRL(totalDesc)}`,
    48,
    y + 42,
  );
  y += netH + 24;

  // Assinaturas
  const assinY = pageH - 130;
  doc.setDrawColor(P.borda);
  doc.setLineWidth(0.6);
  doc.line(48, assinY, 240, assinY);
  doc.line(pageW - 240, assinY, pageW - 48, assinY);
  doc.setFontSize(8);
  doc.setTextColor(P.cinza);
  doc.setFont("helvetica", "normal");
  doc.text("Assinatura do funcionário", 48, assinY + 12);
  doc.text("Assinatura da empresa", pageW - 240, assinY + 12);
  doc.setFontSize(7);
  doc.text(
    "Declaro ter recebido a importância líquida discriminada acima referente à competência informada.",
    48,
    assinY - 12,
    { maxWidth: pageW - 96 },
  );

  // Rodapé institucional
  const footY = pageH - 32;
  doc.setDrawColor(P.borda);
  doc.line(32, footY - 12, pageW - 32, footY - 12);
  doc.setFontSize(7);
  doc.setTextColor(P.cinza);
  const emitido = new Date().toLocaleString("pt-BR");
  doc.text(`Agilliza · Recibo de pagamento — Emitido em ${emitido}`, 32, footY);
  doc.text("Documento gerado eletronicamente", pageW - 32, footY, { align: "right" });

  const blob = doc.output("blob");
  const mm = String(input.competencia.mes).padStart(2, "0");
  const safeNome = input.funcionario.nome.replace(/[^\w\s.-]/g, "").replace(/\s+/g, "_").slice(0, 40);
  const filename = `Holerite_${input.competencia.ano}-${mm}_${safeNome}.pdf`;
  return { blob, filename };
}

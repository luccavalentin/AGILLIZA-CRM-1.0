/**
 * Gera o PDF do holerite (Recibo de Pagamento de Salário) no formato clássico
 * da CLT: quadro do empregador, quadro do funcionário, tabela única com
 * Código / Descrição / Referência / Vencimentos / Descontos, totais, líquido,
 * bases de cálculo (INSS, FGTS, IRRF) e recibo de quitação com assinatura.
 *
 * Client-side (jsPDF + autoTable). Retorna um Blob para upload ao Storage
 * ou download direto pelo usuário.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getPdfPalette, type PdfPalette } from "@/lib/relatorios/pdf-theme";
import { AGILLIZA_LOGO_LIGHT, AGILLIZA_LOGO_RATIO } from "@/lib/relatorios/brand-logo";
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
    inss?: number;
    irrf?: number;
    base_irrf?: number;
    base_inss?: number;
    fgts?: number;
    dependentes_ir?: number;
  };
  ajustes?: Array<{ tipo: "provento" | "desconto"; descricao: string; valor: number }>;
  /**
   * Linhas explícitas de proventos/descontos (holerite manual do DP).
   * Quando informado, substitui a montagem automática a partir de
   * `detalhamento`, permitindo códigos e referências no padrão CLT.
   */
  linhas?: {
    proventos: Array<{ codigo?: string; descricao: string; referencia?: string; valor: number }>;
    descontos: Array<{ codigo?: string; descricao: string; referencia?: string; valor: number }>;
  };
  liquido: number;
}

interface Linha {
  codigo: string;
  desc: string;
  ref: string;
  valor: number;
}

function fmtCpf(cpf?: string | null): string {
  if (!cpf) return "—";
  const d = String(cpf).replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Desenha um bloco rotulado (rótulo pequeno em cima, valor embaixo). */
function campo(
  doc: jsPDF,
  P: PdfPalette,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(P.cinza);
  doc.text(label.toUpperCase(), x + 4, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(P.texto);
  const v = doc.splitTextToSize(String(value ?? "—"), w - 8)[0] ?? "—";
  doc.text(v, x + 4, y + 19);
}

export function gerarHoleritePdf(input: HoleriteInput): { blob: Blob; filename: string } {
  const P: PdfPalette = getPdfPalette();
  const doc = new jsPDF({ 
    orientation: "portrait", 
    unit: "pt", 
    format: "a4",
    compress: true
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const M = 32; // margem
  const W = pageW - M * 2;
  const compLabel = `${MESES_LONGOS[input.competencia.mes - 1]}/${input.competencia.ano}`;
  const empregador = input.correspondente_nome?.trim() || "Agilliza";

  doc.setFillColor("#FFFFFF");
  doc.rect(0, 0, pageW, pageH, "F");

  let y = M;

  // ---------------------------------------------------------------- cabeçalho
  const headH = 54;
  doc.setDrawColor(P.borda);
  doc.setLineWidth(0.9);
  doc.setFillColor(P.card);
  doc.rect(M, y, W, headH, "FD");
  // faixa de identidade coral
  doc.setFillColor(P.coral);
  doc.rect(M, y, 4, headH, "F");

  // Logo da empresa
  const logoH = 26;
  const logoW = logoH * AGILLIZA_LOGO_RATIO;
  try {
    // Fundo azul para o logo ser visível se for o LIGHT logo
    doc.setFillColor(P.azul);
    doc.roundedRect(M + 12, y + 8, logoW + 8, logoH + 8, 4, 4, "F");
    doc.addImage(AGILLIZA_LOGO_LIGHT, "PNG", M + 16, y + 12, logoW, logoH, undefined, "FAST");
  } catch {
    /* fallback */
  }

  const textOffset = logoW + 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(P.destaque);
  doc.text(empregador.toUpperCase(), M + textOffset, y + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(P.cinza);
  doc.text("Empregador · Departamento Pessoal", M + textOffset, y + 34);
  doc.text("Documento gerado eletronicamente pelo sistema Agilliza", M + textOffset, y + 44);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(P.texto);
  doc.text("RECIBO DE PAGAMENTO DE SALÁRIO", pageW - M - 12, y + 22, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(P.cinza);
  doc.text(`Competência: ${compLabel}`, pageW - M - 12, y + 35, { align: "right" });
  doc.text("Art. 464 da CLT", pageW - M - 12, y + 45, { align: "right" });

  y += headH;

  // ------------------------------------------------------- quadro funcionário
  const rowH = 26;
  doc.setDrawColor(P.borda);
  doc.setFillColor("#FFFFFF");
  doc.rect(M, y, W, rowH * 2, "FD");

  const c1 = W * 0.16;
  const c2 = W * 0.46;
  const c3 = W * 0.19;
  const c4 = W - c1 - c2 - c3;

  // divisórias
  doc.setLineWidth(0.5);
  doc.line(M, y + rowH, M + W, y + rowH);
  [c1, c1 + c2, c1 + c2 + c3].forEach((off) => {
    doc.line(M + off, y, M + off, y + rowH * 2);
  });

  campo(doc, P, M, y, c1, "Matrícula", input.funcionario.numero ?? "—");
  campo(doc, P, M + c1, y, c2, "Nome do funcionário", input.funcionario.nome);
  campo(doc, P, M + c1 + c2, y, c3, "CPF", fmtCpf(input.funcionario.cpf));
  campo(doc, P, M + c1 + c2 + c3, y, c4, "Competência", compLabel);

  campo(doc, P, M, y + rowH, c1, "Cód. cargo", "—");
  campo(doc, P, M + c1, y + rowH, c2, "Cargo / Função", input.funcionario.cargo ?? "—");
  campo(doc, P, M + c1 + c2, y + rowH, c3, "Departamento", input.funcionario.departamento ?? "—");
  campo(doc, P, M + c1 + c2 + c3, y + rowH, c4, "Salário base", formatBRL(input.salario_base));

  y += rowH * 2 + 10;

  // ------------------------------------------------- linhas de verbas (CLT)
  const d = input.detalhamento;
  const proventos: Linha[] = [];
  const descontos: Linha[] = [];

  const manual = input.linhas;
  if (manual) {
    manual.proventos.forEach((l, i) =>
      proventos.push({
        codigo: l.codigo ?? String(1 + i).padStart(3, "0"),
        desc: l.descricao,
        ref: l.referencia ?? "",
        valor: l.valor,
      }),
    );
    manual.descontos.forEach((l, i) =>
      descontos.push({
        codigo: l.codigo ?? String(101 + i),
        desc: l.descricao,
        ref: l.referencia ?? "",
        valor: l.valor,
      }),
    );
  } else {
    proventos.push({ codigo: "001", desc: "Salário base", ref: "30 dias", valor: input.salario_base });
    if ((d.beneficios_valor ?? 0) > 0) {
      proventos.push({ codigo: "070", desc: "Benefícios (provento)", ref: "", valor: d.beneficios_valor ?? 0 });
    }
    if ((d.proventos_avulsos ?? 0) > 0) {
      (input.ajustes ?? [])
        .filter((a) => a.tipo === "provento")
        .forEach((a, i) =>
          proventos.push({ codigo: String(90 + i).padStart(3, "0"), desc: a.descricao, ref: "avulso", valor: a.valor }),
        );
    }
    if ((d.inss ?? 0) > 0) {
      descontos.push({ codigo: "110", desc: "I.N.S.S.", ref: "tab. progressiva", valor: d.inss ?? 0 });
    }
    if ((d.irrf ?? 0) > 0) {
      descontos.push({
        codigo: "111",
        desc: "I.R.R.F. sobre salário",
        ref: (d.dependentes_ir ?? 0) > 0 ? `${d.dependentes_ir} dep.` : "tab. mensal",
        valor: d.irrf ?? 0,
      });
    }
    if ((d.beneficios_desconto ?? 0) > 0) {
      descontos.push({ codigo: "120", desc: "Benefícios (desconto)", ref: "", valor: d.beneficios_desconto ?? 0 });
    }
    if ((d.descontos_lancados ?? 0) > 0) {
      descontos.push({ codigo: "190", desc: "Descontos lançados", ref: "", valor: d.descontos_lancados ?? 0 });
    }
    if ((d.adiantamentos ?? 0) > 0) {
      descontos.push({ codigo: "140", desc: "Adiantamento salarial", ref: "", valor: d.adiantamentos ?? 0 });
    }
    if ((d.descontos_avulsos ?? 0) > 0) {
      (input.ajustes ?? [])
        .filter((a) => a.tipo === "desconto")
        .forEach((a, i) =>
          descontos.push({ codigo: String(191 + i), desc: a.descricao, ref: "avulso", valor: a.valor }),
        );
    }
  }

  const totalProv = proventos.reduce((s, r) => s + r.valor, 0);
  const totalDesc = descontos.reduce((s, r) => s + r.valor, 0);
  const liquido = Number.isFinite(input.liquido) ? input.liquido : totalProv - totalDesc;

  // Tabela única no padrão do holerite: vencimentos e descontos em colunas.
  const body = [
    ...proventos.map((l) => [l.codigo, l.desc, l.ref, formatBRL(l.valor), ""]),
    ...descontos.map((l) => [l.codigo, l.desc, l.ref, "", formatBRL(l.valor)]),
  ];
  // Linhas em branco para o holerite manter a "cara" de formulário.
  const MIN_LINHAS = 14;
  for (let i = body.length; i < MIN_LINHAS; i++) body.push(["", "", "", "", ""]);

  autoTable(doc, {
    startY: y,
    head: [["Cód.", "Descrição", "Referência", "Vencimentos", "Descontos"]],
    body,
    theme: "grid",
    styles: {
      lineColor: P.borda as any,
      lineWidth: 0.4,
      font: "helvetica",
    },
    headStyles: {
      fillColor: P.azul as any,
      textColor: "#FFFFFF",
      fontSize: 8,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: { fontSize: 8.5, textColor: P.texto as any, cellPadding: 4, minCellHeight: 16 },
    columnStyles: {
      0: { cellWidth: W * 0.08, halign: "center" },
      1: { cellWidth: W * 0.42 },
      2: { cellWidth: W * 0.16, halign: "center", textColor: P.cinza as any },
      3: { cellWidth: W * 0.17, halign: "right" },
      4: { cellWidth: W * 0.17, halign: "right" },
    },
    margin: { left: M, right: M },
    tableWidth: W,
  });

  y = (doc as any).lastAutoTable.finalY;

  // --------------------------------------------------- totais + valor líquido
  const totH = 30;
  doc.setDrawColor(P.borda);
  doc.setLineWidth(0.6);
  doc.setFillColor(P.card);
  doc.rect(M, y, W, totH, "FD");

  const colTot = W * 0.17;
  const xVenc = M + W - colTot * 2;
  const xDesc = M + W - colTot;
  doc.line(xVenc, y, xVenc, y + totH);
  doc.line(xDesc, y, xDesc, y + totH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(P.cinza);
  doc.text("TOTAL DE VENCIMENTOS", xVenc + colTot - 6, y + 11, { align: "right" });
  doc.text("TOTAL DE DESCONTOS", xDesc + colTot - 6, y + 11, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(P.texto);
  doc.text(formatBRL(totalProv), xVenc + colTot - 6, y + 24, { align: "right" });
  doc.text(formatBRL(totalDesc), xDesc + colTot - 6, y + 24, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(P.cinza);
  doc.text("MÊS DE REFERÊNCIA", M + 8, y + 11);
  doc.setFontSize(10);
  doc.setTextColor(P.texto);
  doc.text(compLabel, M + 8, y + 24);

  y += totH;

  // faixa do líquido
  const netH = 32;
  doc.setFillColor(P.azul);
  doc.rect(M, y, W, netH, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("VALOR LÍQUIDO A RECEBER", M + 8, y + 20);
  doc.setFontSize(15);
  doc.text(formatBRL(liquido), M + W - 8, y + 22, { align: "right" });

  y += netH + 10;

  // ------------------------------------------------------ bases de cálculo
  const baseInss = d.base_inss ?? 0;
  const baseIrrf = d.base_irrf ?? 0;
  const fgts = d.fgts ?? 0;
  const basesH = 34;
  doc.setDrawColor(P.borda);
  doc.setLineWidth(0.6);
  doc.setFillColor("#FFFFFF");
  doc.rect(M, y, W, basesH, "FD");

  const bases = [
    { l: "Salário base", v: formatBRL(input.salario_base) },
    { l: "Base INSS", v: formatBRL(baseInss) },
    { l: "Base FGTS", v: formatBRL(baseInss) },
    { l: "FGTS do mês", v: formatBRL(fgts) },
    { l: "Base IRRF", v: formatBRL(baseIrrf) },
    { l: "Faixa IRRF", v: (d.dependentes_ir ?? 0) > 0 ? `${d.dependentes_ir} dep.` : "tab. mensal" },
  ];
  const bw = W / bases.length;
  bases.forEach((b, i) => {
    const bx = M + i * bw;
    if (i > 0) doc.line(bx, y, bx, y + basesH);
    campo(doc, P, bx, y + 3, bw, b.l, b.v);
  });

  y += basesH + 16;

  // ------------------------------------------------------------- quitação
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(P.cinza);
  doc.text(
    "Declaro ter recebido a importância líquida discriminada neste recibo, referente à competência acima, " +
      "estando quitadas as verbas nele especificadas nos termos do art. 464 da CLT.",
    M,
    y,
    { maxWidth: W },
  );

  const assinY = Math.max(y + 60, pageH - 110);
  doc.setDrawColor(P.borda);
  doc.setLineWidth(0.6);
  doc.line(M + 16, assinY, M + W * 0.42, assinY);
  doc.line(M + W * 0.58, assinY, M + W - 16, assinY);
  doc.setFontSize(7.5);
  doc.setTextColor(P.cinza);
  doc.text("Assinatura do funcionário", M + 16, assinY + 11);
  doc.text(
    `Data: ____/____/${input.competencia.ano}`,
    M + 16,
    assinY + 24,
  );
  doc.text(`${empregador} — Assinatura do empregador`, M + W * 0.58, assinY + 11);

  // ---------------------------------------------------------------- rodapé
  const footY = pageH - 28;
  doc.setDrawColor(P.borda);
  doc.line(M, footY - 12, pageW - M, footY - 12);
  doc.setFontSize(6.5);
  doc.setTextColor(P.cinza);
  doc.text(
    `Recibo de pagamento de salário · ${empregador} · Emitido em ${new Date().toLocaleString("pt-BR")}`,
    M,
    footY,
  );
  doc.text("Via do funcionário", pageW - M, footY, { align: "right" });

  const blob = doc.output("blob");
  const mm = String(input.competencia.mes).padStart(2, "0");
  const safeNome = input.funcionario.nome.replace(/[^\w\s.-]/g, "").replace(/\s+/g, "_").slice(0, 40);
  const filename = `Holerite_${input.competencia.ano}-${mm}_${safeNome}.pdf`;
  return { blob, filename };
}

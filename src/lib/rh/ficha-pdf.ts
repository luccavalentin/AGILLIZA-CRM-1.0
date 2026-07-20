/**
 * Gera a ficha completa do funcionário em PDF, com marca d'água "AGILLIZA",
 * cabeçalho institucional e dados profissionais/pessoais.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { drawBrandHeader } from "@/lib/relatorios/report-pdf";
import { getPdfPalette, type PdfPalette } from "@/lib/relatorios/pdf-theme";
import { formatBRL } from "@/lib/simulacao/format";
import type { Funcionario } from "@/lib/rh/funcionarios.functions";

const CONTRATO: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
  autonomo: "Autônomo",
  temporario: "Temporário",
  aprendiz: "Aprendiz",
};

const STATUS: Record<string, string> = {
  ativo: "Ativo",
  experiencia: "Em experiência",
  afastado: "Afastado",
  ferias: "Em férias",
  desligado: "Desligado",
};

function fmtCpf(cpf?: string | null) {
  if (!cpf) return "—";
  const d = String(cpf).replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return v;
  }
}

function drawWatermark(doc: jsPDF, palette: PdfPalette) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState?.();
  // @ts-ignore jspdf types
  doc.setGState?.(new (doc as any).GState({ opacity: 0.06 }));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(90);
  doc.setTextColor(palette.headerBg ?? "#000F9F");
  doc.text("AGILLIZA", pageW / 2, pageH / 2, {
    align: "center",
    angle: 30,
  });
  doc.restoreGraphicsState?.();
  doc.setTextColor(palette.text ?? "#0F172A");
}

export function gerarFichaFuncionarioPdf(input: {
  funcionario: Funcionario;
  dependentes?: Array<{ nome: string; parentesco: string; cpf: string | null; data_nascimento: string | null }>;
}): { blob: Blob; filename: string } {
  const P = getPdfPalette();
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  if (P.pageBg) {
    doc.setFillColor(P.pageBg);
    doc.rect(0, 0, pageW, pageH, "F");
  }

  drawWatermark(doc, P);

  const HEADER_H = 70;
  drawBrandHeader(
    doc,
    pageW,
    HEADER_H,
    "Ficha do Funcionário",
    `${input.funcionario.nome} · Nº ${input.funcionario.numero}`,
  );

  const f = input.funcionario;
  let y = HEADER_H + 24;

  const linhas: Array<[string, string]> = [
    ["Nome completo", f.nome],
    ["Nome social", f.nome_social ?? "—"],
    ["CPF", fmtCpf(f.cpf)],
    ["RG", [f.rg, f.rg_orgao, f.rg_uf].filter(Boolean).join(" ") || "—"],
    ["Nascimento", fmtDate(f.data_nascimento)],
    ["Nacionalidade", f.nacionalidade ?? "—"],
    ["Estado civil", f.estado_civil ?? "—"],
    ["Nome da mãe", f.nome_mae ?? "—"],
    ["Nome do pai", f.nome_pai ?? "—"],
    ["E-mail pessoal", f.email_pessoal ?? "—"],
    ["Telefone", f.telefone ?? "—"],
    [
      "Endereço",
      [
        [f.logradouro, f.numero_endereco].filter(Boolean).join(", "),
        f.complemento,
        f.bairro,
        [f.cidade, f.uf].filter(Boolean).join(" / "),
        f.cep,
      ]
        .filter((s) => s && s.trim())
        .join(" — ") || "—",
    ],
  ];

  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: 4, textColor: P.texto },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 } },
    body: linhas,
    didDrawPage: () => drawWatermark(doc, P),
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // Bloco profissional.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(P.texto);
  doc.text("Dados profissionais", 32, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: 4, textColor: P.texto },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 } },
    body: [
      ["Matrícula", f.matricula ?? "—"],
      ["Cargo", f.cargo_nome ?? "—"],
      ["Departamento", f.departamento_nome ?? "—"],
      ["Gestor", f.gestor_nome ?? "—"],
      ["Tipo de contrato", CONTRATO[f.tipo_contrato] ?? f.tipo_contrato],
      ["Status", STATUS[f.status] ?? f.status],
      ["Admissão", fmtDate(f.data_admissao)],
      ["Fim da experiência", fmtDate(f.fim_experiencia)],
      ["CTPS", [f.ctps_numero, f.ctps_serie, f.ctps_uf].filter(Boolean).join(" / ") || "—"],
      ["PIS", f.pis ?? "—"],
      ["Jornada", f.jornada_descricao ?? "—"],
      ["Salário atual", formatBRL(Number(f.salario_atual ?? 0))],
      ["Salário desde", fmtDate(f.salario_desde)],
      ["Dia pagamento salário", f.dia_pagamento_salario ? String(f.dia_pagamento_salario) : "—"],
      [
        "Dia pagamento adiantamento",
        f.dia_pagamento_adiantamento ? String(f.dia_pagamento_adiantamento) : "—",
      ],
      ["E-mail corporativo", f.email_corporativo ?? "—"],
    ],
    didDrawPage: () => drawWatermark(doc, P),
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // Bancário.
  doc.setFont("helvetica", "bold");
  doc.text("Dados bancários", 32, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: 4, textColor: P.texto },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 } },
    body: [
      ["Banco", f.banco_nome ?? "—"],
      ["Agência", f.banco_agencia ?? "—"],
      ["Conta", `${f.banco_conta ?? "—"} (${f.banco_tipo_conta ?? "—"})`],
      ["Chave Pix", f.banco_pix ?? "—"],
    ],
    didDrawPage: () => drawWatermark(doc, P),
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  if (input.dependentes && input.dependentes.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Dependentes", 32, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 4, textColor: P.texto },
      headStyles: { fillColor: P.azul, textColor: "#FFFFFF" },
      head: [["Nome", "Parentesco", "CPF", "Nascimento"]],
      body: input.dependentes.map((d) => [
        d.nome,
        d.parentesco,
        fmtCpf(d.cpf),
        fmtDate(d.data_nascimento),
      ]),
      didDrawPage: () => drawWatermark(doc, P),
    });
  }

  // Rodapé em todas as páginas.
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(P.cinza);
    const emitido = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    doc.text(
      `Agilliza · Ficha funcional confidencial — Emitido em ${emitido}`,
      32,
      pageH - 20,
    );
    doc.text(`Página ${i} de ${total}`, pageW - 32, pageH - 20, { align: "right" });
  }

  const blob = doc.output("blob");
  const safe = (f.nome || "funcionario").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "_");
  return { blob, filename: `Ficha_${safe}_${f.numero}.pdf` };
}

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { formatBRL } from "@/lib/simulacao/format";
import { extrairDetalheBanco, normalizarSistemaAmortizacao } from "@/lib/simulacao/detalhe-banco";
import { AGILLIZA_LOGO_LIGHT, AGILLIZA_LOGO_RATIO } from "@/lib/relatorios/brand-logo";
import { resolveBancoBrand } from "@/lib/relatorios/banco-brand";
import { getPdfPalette, type PdfPalette } from "@/lib/relatorios/pdf-theme";
import { ORDEM_STATUS, type PropostaStatus } from "@/lib/propostas/state-machine";
import { nomeDescritivo } from "@/lib/simulacao/simulacao-pdf";

/**
 * PDF **oficial da proposta** — focado na proposta em si (cadastro dos
 * proponentes, checklist de documentação e etapas), com apenas um resumo
 * financeiro condensado no cabeçalho. Complementa (e não substitui) o
 * cronograma detalhado de parcelas gerado pelo módulo de simulação.
 */
interface Input {
  proposta: any;
  bancos: any[];
  envolvidos: any[];
  documentos: any[];
  followups?: any[];
}

const HEADER_H = 68;
const MARGIN = 36;
let P: PdfPalette = getPdfPalette();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function dataTxt(v: unknown): string {
  if (!v) return "—";
  const s = String(v);
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function dataHoraTxt(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function brl(v: number | null | undefined): string {
  return v == null || Number.isNaN(Number(v)) ? "—" : formatBRL(Number(v));
}

function up(v: unknown): string {
  const s = (v ?? "").toString().trim();
  return s ? s.toUpperCase() : "—";
}

function pct(v: number | null | undefined, sufixo = "a.a."): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}% ${sufixo}`.trim();
}

function tituloStatus(s: PropostaStatus | string | null | undefined): string {
  const m: Record<string, string> = {
    rascunho: "Rascunho",
    erro_envio: "Erro no envio",
    enviada_banco: "Enviada ao banco",
    em_analise_credito: "Em análise de crédito",
    credito_aprovado: "Crédito aprovado",
    credito_recusado: "Crédito recusado",
    aguardando_documentos: "Coleta de documentos",
    engenharia_vistoria: "Engenharia / vistoria",
    analise_juridica: "Análise jurídica",
    contrato_emitido: "Contrato emitido",
    cancelada: "Cancelada",
  };
  return m[String(s ?? "")] ?? String(s ?? "—");
}

function tituloQualificacao(v: string | null | undefined): string {
  const m: Record<string, string> = {
    titular: "Titular / Comprador",
    conjuge: "Cônjuge",
    coobrigado: "Coobrigado",
    vendedor: "Vendedor",
    procurador: "Procurador",
    fiador: "Fiador",
  };
  return m[String(v ?? "")] ?? (v ? String(v) : "—");
}

function estadoCivilLabel(v: string | null | undefined): string {
  const m: Record<string, string> = {
    solteiro: "Solteiro(a)",
    casado: "Casado(a)",
    divorciado: "Divorciado(a)",
    viuvo: "Viúvo(a)",
    separado: "Separado(a)",
    uniao_estavel: "União estável",
  };
  return m[String(v ?? "")] ?? (v ? String(v) : "—");
}

function bancoPrincipal(bancos: any[]): any | null {
  if (!bancos?.length) return null;
  const prioridade = [
    "credito_aprovado",
    "aceita",
    "em_analise",
    "simulada",
    "enviada",
    "aguardando",
  ];
  for (const s of prioridade) {
    const b = bancos.find((x) => String(x.status_banco ?? "").toLowerCase() === s);
    if (b) return b;
  }
  return bancos[0];
}

/* -------------------------------------------------------------------------- */
/* Cabeçalho / rodapé                                                          */
/* -------------------------------------------------------------------------- */

function drawHeader(doc: jsPDF, pageW: number) {
  P = getPdfPalette();
  doc.setFillColor(P.azul);
  doc.rect(0, 0, pageW, HEADER_H, "F");
  doc.setFillColor(P.coral);
  doc.rect(0, HEADER_H, pageW, 3, "F");

  const slogan = "Crédito Inteligente é na";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const textW = doc.getTextWidth(slogan);
  const logoH = 34;
  const logoW = logoH * AGILLIZA_LOGO_RATIO;
  const gap = 14;
  const groupW = textW + gap + logoW;
  const startX = (pageW - groupW) / 2;
  const midY = HEADER_H / 2;
  doc.setTextColor("#FFFFFF");
  doc.text(slogan, startX, midY + 3.5);
  try {
    doc.addImage(AGILLIZA_LOGO_LIGHT, "PNG", startX + textW + gap, midY - logoH / 2, logoW, logoH);
  } catch {
    /* silencioso */
  }
}

function drawFooter(doc: jsPDF, pageW: number, pageH: number, pageNum: number, total: number) {
  const y = pageH - 22;
  doc.setDrawColor(P.borda);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(P.cinza);
  const emitido = new Date().toLocaleString("pt-BR");
  doc.text(`Agilliza · Crédito Imobiliário  —  Emitido em ${emitido}`, MARGIN, y + 12);
  doc.text(`Página ${pageNum} de ${total}`, pageW - MARGIN, y + 12, { align: "right" });
}

/* -------------------------------------------------------------------------- */
/* Blocos                                                                      */
/* -------------------------------------------------------------------------- */

function drawTituloProposta(doc: jsPDF, pageW: number, proposta: any, y: number): number {
  doc.setTextColor(P.destaque);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Ficha da Proposta de Financiamento", MARGIN, y);

  const numero = String(proposta?.numero_proposta ?? "—");
  doc.setTextColor(P.texto);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Proposta Nº ${numero}`, pageW - MARGIN, y - 4, { align: "right" });
  doc.setTextColor(P.cinza);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Emitida em ${dataTxt(proposta?.created_at)}`, pageW - MARGIN, y + 8, { align: "right" });
  return y + 16;
}

function drawStatusBadge(doc: jsPDF, x: number, y: number, status: string): number {
  const label = tituloStatus(status);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const w = doc.getTextWidth(label) + 16;
  const h = 16;
  doc.setFillColor(P.destaque);
  doc.roundedRect(x, y, w, h, 8, 8, "F");
  doc.setTextColor("#FFFFFF");
  doc.text(label, x + w / 2, y + h / 2 + 3, { align: "center" });
  return w;
}

/** Caixa compacta com o banco selecionado + resumo financeiro essencial. */
function drawResumoFinanceiro(
  doc: jsPDF,
  pageW: number,
  proposta: any,
  bancos: any[],
  y: number,
): number {
  const w = pageW - MARGIN * 2;
  const boxH = 78;
  doc.setFillColor(P.card);
  doc.setDrawColor(P.borda);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, w, boxH, 4, 4, "FD");
  doc.setFillColor(P.coral);
  doc.rect(MARGIN, y + 10, 3, boxH - 20, "F");

  const banco = bancoPrincipal(bancos);
  const brand = resolveBancoBrand(banco?.nome_banco ?? proposta?.nome_banco);
  const nomeBanco = up(banco?.nome_banco ?? proposta?.nome_banco ?? "—");

  // Faixa: logo + nome do banco
  const topY = y + 10;
  const logoH = 22;
  const logoW = brand ? logoH * brand.ratio : 0;
  let cursorX = MARGIN + 14;
  if (brand) {
    try {
      doc.addImage(brand.logo, "PNG", cursorX, topY, logoW, logoH);
      cursorX += logoW + 10;
    } catch {
      /* silencioso */
    }
  }
  doc.setTextColor(P.destaque);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(nomeBanco, cursorX, topY + logoH / 2 + 4);

  // Badge de status à direita da faixa
  drawStatusBadge(doc, pageW - MARGIN - 14 - doc.getTextWidth(tituloStatus(proposta?.status)) - 16, topY + 3, proposta?.status);

  // Grid inferior com 5 métricas essenciais
  const detalhe = banco ? extrairDetalheBanco(banco) : null;
  const parcela =
    detalhe?.primeiraParcela ??
    (Array.isArray(detalhe?.parcelas) && detalhe!.parcelas[0]?.parcela) ??
    banco?.valor_parcela ??
    null;
  const sistema = normalizarSistemaAmortizacao(detalhe?.sistemaAmortizacao, proposta?.sistema_amortizacao);
  const prazo = detalhe?.prazoMeses ?? proposta?.prazo ?? banco?.prazo_meses ?? null;
  const taxa = detalhe?.taxaJurosAno ?? banco?.taxa_juros_ano ?? null;
  const financiamento =
    detalhe?.financiamentoTotal ?? detalhe?.valorFinanciamento ?? proposta?.valor_financiamento ?? null;

  const metricas: { label: string; valor: string }[] = [
    { label: "PARCELA INICIAL", valor: brl(parcela as number | null) },
    { label: "VALOR FINANCIADO", valor: brl(financiamento as number | null) },
    { label: "PRAZO", valor: prazo != null ? `${prazo} meses` : "—" },
    { label: "TAXA EFETIVA (a.a.)", valor: pct(taxa as number | null) },
    { label: "SISTEMA", valor: sistema },
  ];

  const gridY = y + 40;
  const gridH = boxH - 46;
  const cellW = (w - 20) / metricas.length;
  metricas.forEach((m, i) => {
    const x = MARGIN + 10 + i * cellW;
    if (i > 0) {
      doc.setDrawColor(P.borda);
      doc.setLineWidth(0.5);
      doc.line(x, gridY + 4, x, gridY + gridH - 4);
    }
    doc.setTextColor(P.cinza);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(m.label, x + 8, gridY + 12);
    doc.setTextColor(P.destaque);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(m.valor, x + 8, gridY + 26, { maxWidth: cellW - 12 });
  });

  return y + boxH + 12;
}

/** Bloco com os dados do imóvel financiado. */
function drawImovel(doc: jsPDF, pageW: number, proposta: any, y: number): number {
  const w = pageW - MARGIN * 2;
  doc.setTextColor(P.destaque);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Imóvel financiado", MARGIN, y);
  y += 8;

  const endereco = [
    proposta?.endereco_imovel,
    proposta?.numero_imovel && `nº ${proposta.numero_imovel}`,
    proposta?.complemento_imovel,
    proposta?.bairro_imovel,
    (proposta?.cidade_imovel || proposta?.municipio_imovel) &&
      `${proposta.cidade_imovel ?? proposta.municipio_imovel}${proposta?.uf ? ` / ${proposta.uf}` : ""}`,
    proposta?.cep_imovel && `CEP ${proposta.cep_imovel}`,
  ]
    .filter(Boolean)
    .join(", ") || "—";

  const itens: { label: string; valor: string }[] = [
    { label: "Tipo", valor: up(proposta?.tipo_imovel) },
    { label: "Uso", valor: up(proposta?.uso_imovel) },
    { label: "Situação", valor: up(proposta?.situacao_imovel) },
    { label: "Valor de C&V", valor: brl(proposta?.valor_imovel) },
  ];

  const gap = 8;
  const cardW = (w - gap * 3) / 4;
  const cardH = 32;
  itens.forEach((it, i) => {
    const x = MARGIN + i * (cardW + gap);
    doc.setFillColor(P.card);
    doc.setDrawColor(P.borda);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, "FD");
    doc.setTextColor(P.cinza);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(it.label.toUpperCase(), x + 8, y + 12);
    doc.setTextColor(P.destaque);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(it.valor, x + 8, y + 24, { maxWidth: cardW - 16 });
  });
  y += cardH + 8;

  doc.setFillColor(P.card);
  doc.setDrawColor(P.borda);
  const enderecoH = 26;
  doc.roundedRect(MARGIN, y, w, enderecoH, 3, 3, "FD");
  doc.setTextColor(P.cinza);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("ENDEREÇO", MARGIN + 8, y + 10);
  doc.setTextColor(P.texto);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(endereco, w - 16);
  doc.text(lines.slice(0, 2), MARGIN + 8, y + 20);
  return y + enderecoH + 12;
}

/** Linha do tempo horizontal das 7 etapas da oportunidade. */
function drawEtapas(doc: jsPDF, pageW: number, proposta: any, y: number): number {
  const etapas: { status: PropostaStatus; label: string }[] = [
    { status: "rascunho", label: "Simulação" },
    { status: "enviada_banco", label: "Envio ao banco" },
    { status: "em_analise_credito", label: "Análise de crédito" },
    { status: "credito_aprovado", label: "Crédito aprovado" },
    { status: "aguardando_documentos", label: "Coleta de documentos" },
    { status: "engenharia_vistoria", label: "Engenharia / vistoria" },
    { status: "analise_juridica", label: "Análise jurídica" },
    { status: "contrato_emitido", label: "Contrato emitido" },
  ];

  const atualIdx = ORDEM_STATUS.indexOf(proposta?.status as PropostaStatus);
  const recusada = proposta?.status === "credito_recusado";
  const cancelada = proposta?.status === "cancelada";

  doc.setTextColor(P.destaque);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Etapas da proposta", MARGIN, y);
  y += 8;

  const w = pageW - MARGIN * 2;
  const step = w / etapas.length;
  const dotY = y + 12;
  const dotR = 6;

  // linha base
  doc.setDrawColor(P.borda);
  doc.setLineWidth(1.5);
  doc.line(MARGIN + step / 2, dotY, MARGIN + step * (etapas.length - 0.5), dotY);

  etapas.forEach((et, i) => {
    const cx = MARGIN + step * (i + 0.5);
    const passou = atualIdx >= 0 && ORDEM_STATUS.indexOf(et.status) <= atualIdx;
    const atual = ORDEM_STATUS.indexOf(et.status) === atualIdx;
    const cor = passou ? P.destaque : P.borda;

    // segmento colorido
    if (i > 0 && passou) {
      doc.setDrawColor(P.destaque);
      doc.setLineWidth(2);
      doc.line(MARGIN + step * (i - 0.5), dotY, cx, dotY);
    }

    doc.setFillColor(cor);
    doc.setDrawColor(cor);
    doc.circle(cx, dotY, dotR, "F");
    if (atual) {
      doc.setDrawColor(P.coral);
      doc.setLineWidth(1.5);
      doc.circle(cx, dotY, dotR + 2, "S");
    }

    // check
    if (passou && !atual) {
      doc.setTextColor("#FFFFFF");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("✓", cx, dotY + 2.5, { align: "center" });
    }

    // rótulo
    doc.setTextColor(atual ? P.destaque : P.texto);
    doc.setFont("helvetica", atual ? "bold" : "normal");
    doc.setFontSize(6.8);
    const lines = doc.splitTextToSize(et.label, step - 6);
    doc.text(lines, cx, dotY + 16, { align: "center" });
  });

  if (recusada || cancelada) {
    y += 42;
    doc.setFillColor(recusada ? "#FEE2E2" : "#F3F4F6");
    doc.setDrawColor(recusada ? "#DC2626" : P.cinza);
    doc.roundedRect(MARGIN, y, w, 22, 3, 3, "FD");
    doc.setTextColor(recusada ? "#991B1B" : P.texto);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(recusada ? "Proposta com crédito recusado pelo banco." : "Proposta cancelada.", MARGIN + 10, y + 14);
    return y + 30;
  }

  return y + 48;
}

/* -------------------------------------------------------------------------- */
/* Tabelas (proponentes / documentos / follow-ups)                             */
/* -------------------------------------------------------------------------- */

function tabelaProponentes(doc: jsPDF, pageW: number, envolvidos: any[], y: number): number {
  doc.setTextColor(P.destaque);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Cadastro dos envolvidos", MARGIN, y);
  y += 6;

  const linhas =
    (envolvidos ?? []).map((e) => [
      tituloQualificacao(e.tipo_qualificacao),
      up(e.nome),
      e.cpf_cnpj ?? "—",
      dataTxt(e.data_nascimento),
      estadoCivilLabel(e.estado_civil),
      e.renda != null ? brl(Number(e.renda)) : "—",
      e.celular ?? e.email ?? "—",
    ]) ?? [];

  autoTable(doc, {
    startY: y + 4,
    head: [["Papel", "Nome", "CPF/CNPJ", "Nascimento", "Estado civil", "Renda", "Contato"]],
    body: linhas.length ? linhas : [["—", "Nenhum envolvido cadastrado.", "—", "—", "—", "—", "—"]],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4,
      textColor: P.texto,
      lineColor: P.borda,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: P.azul,
      textColor: "#FFFFFF",
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: P.card },
    columnStyles: {
      0: { cellWidth: 78, fontStyle: "bold" },
      2: { cellWidth: 78 },
      3: { cellWidth: 56 },
      5: { cellWidth: 60, halign: "right" },
    },
  });
  return (doc as any).lastAutoTable.finalY + 14;
}

function statusDocLabel(v: string | null | undefined): { label: string; fill: string; text: string } {
  const s = String(v ?? "").toLowerCase();
  if (["aprovado", "aceito", "validado"].includes(s))
    return { label: "Aprovado", fill: "#DCFCE7", text: "#166534" };
  if (["reprovado", "recusado", "rejeitado"].includes(s))
    return { label: "Reprovado", fill: "#FEE2E2", text: "#991B1B" };
  if (["enviado", "em_analise", "analise"].includes(s))
    return { label: "Em análise", fill: "#DBEAFE", text: "#1E40AF" };
  if (["pendente", "aguardando", ""].includes(s))
    return { label: "Pendente", fill: "#FEF3C7", text: "#92400E" };
  return { label: v ? String(v) : "—", fill: P.card, text: P.texto };
}

function tabelaDocumentos(doc: jsPDF, pageW: number, documentos: any[], y: number): number {
  doc.setTextColor(P.destaque);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Checklist de documentação", MARGIN, y);
  y += 4;

  const totais = (documentos ?? []).reduce(
    (acc, d) => {
      const s = statusDocLabel(d.status).label;
      acc[s] = (acc[s] ?? 0) + 1;
      acc.total += 1;
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );

  doc.setTextColor(P.cinza);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const legendas = ["Aprovado", "Em análise", "Pendente", "Reprovado"]
    .map((k) => `${k}: ${totais[k] ?? 0}`)
    .concat(`Total: ${totais.total ?? 0}`)
    .join("   •   ");
  doc.text(legendas, MARGIN, y + 8);
  y += 12;

  const linhas =
    (documentos ?? []).map((d) => {
      const st = statusDocLabel(d.status);
      return [
        up(d.tipo_documento ?? d.nome_documento ?? "—"),
        d.parte ? up(d.parte) : "—",
        d.obrigatorio ? "Sim" : "Não",
        st.label,
        dataTxt(d.enviado_em),
      ];
    }) ?? [];

  autoTable(doc, {
    startY: y,
    head: [["Documento", "Parte", "Obrigatório", "Situação", "Enviado em"]],
    body: linhas.length
      ? linhas
      : [["—", "Nenhum documento cadastrado ainda.", "—", "—", "—"]],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4,
      textColor: P.texto,
      lineColor: P.borda,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: P.azul,
      textColor: "#FFFFFF",
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: P.card },
    columnStyles: {
      2: { cellWidth: 62, halign: "center" },
      3: { cellWidth: 74, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 68 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const st = statusDocLabel((documentos ?? [])[data.row.index]?.status);
        (data.cell.styles as any).fillColor = st.fill;
        (data.cell.styles as any).textColor = st.text;
      }
    },
  });
  return (doc as any).lastAutoTable.finalY + 14;
}

function tabelaFollowups(doc: jsPDF, pageW: number, followups: any[], y: number): number {
  doc.setTextColor(P.destaque);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Follow-ups e próximos passos", MARGIN, y);
  y += 6;

  const linhas =
    (followups ?? []).slice(0, 40).map((f) => [
      dataTxt(f.data_previsao ?? f.created_at),
      up(f.tipo ?? "—"),
      f.titulo ?? "—",
      f.comentario ?? "—",
    ]) ?? [];

  autoTable(doc, {
    startY: y + 4,
    head: [["Data", "Tipo", "Título", "Comentário"]],
    body: linhas.length
      ? linhas
      : [["—", "—", "Nenhum follow-up registrado.", "—"]],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4,
      textColor: P.texto,
      lineColor: P.borda,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: P.azul,
      textColor: "#FFFFFF",
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: P.card },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 70, fontStyle: "bold" },
    },
  });
  return (doc as any).lastAutoTable.finalY + 10;
}

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

export function baixarPropostaOficialPDF(input: Input) {
  const proposta = input?.proposta ?? {};
  const bancos = Array.isArray(input?.bancos) ? input.bancos : [];
  const envolvidos = Array.isArray(input?.envolvidos) ? input.envolvidos : [];
  const documentos = Array.isArray(input?.documentos) ? input.documentos : [];
  void input?.followups;

  P = getPdfPalette();
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const safe = <T,>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch (err) {
      console.error("[proposta-oficial-pdf] bloco falhou:", err);
      return fallback;
    }
  };

  const FOOTER_RESERVA = 60;
  const ensureSpace = (yAtual: number, necessario: number): number => {
    if (yAtual + necessario <= pageH - FOOTER_RESERVA) return yAtual;
    doc.addPage();
    safe(() => drawHeader(doc, pageW), undefined);
    return HEADER_H + 24;
  };

  // ---------------- Ficha da proposta (fluxo contínuo) ----------------
  safe(() => drawHeader(doc, pageW), undefined);
  let y = HEADER_H + 24;
  y = safe(() => drawTituloProposta(doc, pageW, proposta, y), y + 20);
  y = safe(() => drawResumoFinanceiro(doc, pageW, proposta, bancos, y), y + 90);
  y = safe(() => drawImovel(doc, pageW, proposta, y), y + 80);
  y = safe(() => drawEtapas(doc, pageW, proposta, y), y + 60);

  // Proponentes — segue no fluxo, quebra página só se não couber o cabeçalho + 1 linha
  y = ensureSpace(y, 120);
  y = safe(() => tabelaProponentes(doc, pageW, envolvidos, y), y);

  // Checklist de documentação — mesma lógica
  y = ensureSpace(y, 120);
  y = safe(() => tabelaDocumentos(doc, pageW, documentos, y), y);

  // Rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    safe(() => drawFooter(doc, pageW, pageH, i, total), undefined);
  }

  // Nome do arquivo: "{Nº proposta} - Ficha - {descritivo}.pdf"
  let nome = "Ficha da Proposta";
  try {
    const numero = String(proposta?.numero_proposta ?? "").trim();
    const descritivo = nomeDescritivo(proposta, bancos);
    nome = [numero, "Ficha", descritivo].filter(Boolean).join(" - ") || nome;
  } catch (err) {
    console.error("[proposta-oficial-pdf] falha no nome do arquivo:", err);
  }
  doc.save(`${nome}.pdf`);
}

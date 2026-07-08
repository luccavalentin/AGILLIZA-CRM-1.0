import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { exportPDF, drawBrandHeader } from "@/lib/relatorios/report-pdf";
import { formatBRL, formatPercent } from "@/lib/simulacao/format";
import type { ReportColumn, ReportKpi, ReportRow } from "@/lib/relatorios/shared";
import { extrairDetalheBanco, normalizarSistemaAmortizacao, calcularCET, type DetalheBanco } from "@/lib/simulacao/detalhe-banco";
import { avaliarRendaMinima } from "@/lib/simulacao/renda";
import { AGILLIZA_LOGO_LIGHT, AGILLIZA_LOGO_RATIO } from "@/lib/relatorios/brand-logo";
import { resolveBancoBrand } from "@/lib/relatorios/banco-brand";

interface SimulacaoPdfInput {
  simulacao: any;
  bancos: any[];
  /** Rótulos opcionais para reutilizar o layout em outros documentos (ex.: Propostas). */
  docLabel?: string;
  numeroDoc?: string;
  filePrefix?: string;
  dataLabel?: string;
}

const LABEL_STATUS_BANCO: Record<string, string> = {
  aguardando: "Aguardando",
  simulada: "Simulação",
  erro: "Erro",
  expirada: "Expirada",
};

// Paleta institucional fixa (independe do tema do usuário)
const AZUL = "#000F9F";
const CORAL = "#F5333F";
const GRAFITE = "#0B0B0F";
const CINZA = "#6B7280";
const ZEBRA = "#F7F8FA";
const BORDA = "#E4E6EF";
const HEADER_H = 68;
const MARGIN = 36;

// ---------------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------------

function pctTxt(v: number | null | undefined, sufixo = "a.a.", casas = 4): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: casas })}% ${sufixo}`.trim();
}

function dataTxt(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR");
}

function produtoLabel(s: any): string {
  return s.produto === "home_equity"
    ? "Home Equity"
    : s.produto === "financiamento_imobiliario"
      ? "Financiamento imobiliário"
      : "Operação de crédito";
}

// ---------------------------------------------------------------------------
// Cabeçalho e rodapé institucionais (voltados ao cliente final)
// ---------------------------------------------------------------------------

/** Faixa azul com o slogan "Crédito Inteligente é na" + logo Agilliza centralizados. */
function drawClienteHeader(doc: jsPDF, pageW: number) {
  doc.setFillColor(AZUL);
  doc.rect(0, 0, pageW, HEADER_H, "F");
  doc.setFillColor(CORAL);
  doc.rect(0, HEADER_H, pageW, 3, "F");

  const slogan = "Crédito Inteligente é na";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const textW = doc.getTextWidth(slogan);

  // Logo maior e legível (mantém a proporção original da marca).
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
    /* fallback silencioso */
  }
}

function drawFooter(doc: jsPDF, pageW: number, pageH: number, pageNum: number, total: number) {
  const y = pageH - 22;
  doc.setDrawColor(BORDA);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(CINZA);
  const emitido = new Date().toLocaleString("pt-BR");
  doc.text(`Agilliza · Crédito Imobiliário  —  Emitido em ${emitido}`, MARGIN, y + 12);
  doc.text(`Página ${pageNum} de ${total}`, pageW - MARGIN, y + 12, { align: "right" });
}

const DISCLAIMER =
  "Importante: este documento é apenas uma simulação. A efetivação do resultado apresentado está " +
  "condicionada à análise e aprovação da proposta de financiamento pela instituição financeira. " +
  "As taxas e valores apresentados têm caráter meramente informativo e podem sofrer alterações.";

// ---------------------------------------------------------------------------
// Blocos reutilizáveis (título, dados do cliente, informações do financiamento)
// ---------------------------------------------------------------------------

function drawTituloExtrato(
  doc: jsPDF,
  pageW: number,
  s: any,
  y: number,
  titulo = "Extrato da Simulação de Financiamento",
  dataLabel = "Data da Simulação",
): number {
  doc.setTextColor(AZUL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, MARGIN, y);
  doc.setTextColor(GRAFITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`${dataLabel}: ${dataTxt(s.created_at ?? new Date())}`, pageW - MARGIN, y, {
    align: "right",
  });
  return y + 12;
}

/** Caixa formal com os dados do cliente em destaque. */
function drawDadosCliente(doc: jsPDF, pageW: number, s: any, y: number): number {
  const w = pageW - MARGIN * 2;
  const boxH = 44;
  doc.setFillColor(ZEBRA);
  doc.setDrawColor(BORDA);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, w, boxH, 4, 4, "FD");
  doc.setFillColor(CORAL);
  doc.rect(MARGIN, y + 8, 3, boxH - 16, "F");

  const colX = [MARGIN + 14, MARGIN + w * 0.5, MARGIN + w * 0.75];
  const rotulos = ["CLIENTE", "DATA DE NASCIMENTO", "CPF / CNPJ"];
  const valores = [
    (s.nome_cliente ?? "—").toString().toUpperCase(),
    dataTxt(s.data_nascimento),
    s.cpf_cnpj ?? "—",
  ];
  rotulos.forEach((r, i) => {
    doc.setTextColor(CINZA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(r, colX[i], y + 16);
    doc.setTextColor(AZUL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(i === 0 ? 11 : 10);
    doc.text(String(valores[i]), colX[i], y + 32, { maxWidth: (i === 0 ? w * 0.5 : w * 0.25) - 16 });
  });
  return y + boxH + 12;
}

/** Formata em BRL, mas devolve "—" quando o valor não veio da API (evita inventar R$ 0,00). */
function brlOuTraco(v: number | null | undefined): string {
  return v == null ? "—" : formatBRL(v);
}

/** Normaliza o sistema de amortização para os termos conhecidos (SAC / PRICE). */
function sistemaAmortizacaoLabel(
  apiValor: string | null | undefined,
  requisitado: string | null | undefined,
): string {
  return normalizarSistemaAmortizacao(apiValor, requisitado);
}

/**
 * Grade de "Informações do Financiamento".
 * Só exibe o que vem diretamente do retorno do banco (ou o que o próprio usuário
 * informou na operação); campos ausentes aparecem como "—", nunca com valores inventados.
 */
function drawInfoFinanciamento(
  doc: jsPDF,
  pageW: number,
  s: any,
  b: any,
  d: DetalheBanco | null,
  y: number,
): number {
  const w = pageW - MARGIN * 2;
  const itens: { label: string; valor: string }[] = [
    { label: "Valor de compra e venda", valor: brlOuTraco(d?.valorImovel ?? s.valor_imovel) },
    { label: "Despesas financiadas", valor: brlOuTraco(d?.despesasFinanciadas) },
    {
      label: "Valor de financiamento total",
      valor: brlOuTraco(d?.financiamentoTotal ?? d?.valorFinanciamento ?? s.valor_financiamento),
    },
    { label: "Entrada", valor: brlOuTraco(d?.valorEntrada ?? s.valor_entrada) },
    { label: "Tipo da parcela", valor: d?.tipoParcela ?? d?.indexador ?? "—" },
    {
      label: "Prazo total",
      valor: (d?.prazoMeses ?? s.prazo) != null ? `${d?.prazoMeses ?? s.prazo} meses` : "—",
    },
    {
      label: "Sistema de amortização",
      valor: sistemaAmortizacaoLabel(d?.sistemaAmortizacao, s.sistema_amortizacao),
    },
    { label: "Taxa efetiva anual", valor: pctTxt(d?.taxaJurosAno ?? b?.taxa_juros_ano) },
    { label: "Taxa de juros mensal", valor: pctTxt(d?.taxaJurosMes, "a.m.") },
    {
      label: "CET (Custo Efetivo Total)",
      valor: pctTxt(
        d?.cet ?? calcularCET(d?.valorFinanciamento ?? s.valor_financiamento, d?.parcelas),
      ),
    },
  ];

  // Tarifa de avaliação de garantia (custo à vista, não financiado).
  if (d?.tarifaAvaliacao != null) {
    itens.splice(2, 0, {
      label: "Tarifa de av. de garantia (não financiada)",
      valor: brlOuTraco(d.tarifaAvaliacao),
    });
  }


  doc.setTextColor(AZUL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Informações do Financiamento", MARGIN, y);
  y += 8;

  const gap = 8;
  const cols = 3;
  const cardW = (w - gap * (cols - 1)) / cols;
  const cardH = 34;
  itens.forEach((it, i) => {
    const col = i % cols;
    const rowIdx = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gap);
    const cy = y + rowIdx * (cardH + gap);
    doc.setFillColor(ZEBRA);
    doc.setDrawColor(BORDA);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, cy, cardW, cardH, 3, 3, "FD");
    doc.setTextColor(CINZA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(it.label.toUpperCase(), x + 8, cy + 12, { maxWidth: cardW - 14 });
    doc.setTextColor(AZUL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(it.valor, x + 8, cy + 27, { maxWidth: cardW - 14 });
  });
  const linhas = Math.ceil(itens.length / cols);
  return y + linhas * (cardH + gap) + 8;
}

/** Faixa com o nome do banco centralizado: fundo branco, borda e texto na cor institucional do banco, com sua logo. */
function drawFaixaBanco(doc: jsPDF, pageW: number, nomeBanco: string, y: number): number {
  const w = pageW - MARGIN * 2;
  const h = 30;
  const brand = resolveBancoBrand(nomeBanco);
  const cor = brand?.cor ?? AZUL;

  // Fundo branco com borda na cor institucional do banco
  doc.setFillColor("#FFFFFF");
  doc.setDrawColor(cor);
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN, y, w, h, 3, 3, "FD");
  doc.setLineWidth(0.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const textW = doc.getTextWidth(nomeBanco);

  const logoH = 18;
  const logoW = brand ? logoH * brand.ratio : 0;
  const gap = brand ? 10 : 0;
  const groupW = logoW + gap + textW;
  const startX = MARGIN + (w - groupW) / 2;
  const midY = y + h / 2;

  if (brand) {
    try {
      doc.addImage(brand.logo, "PNG", startX, midY - logoH / 2, logoW, logoH);
    } catch {
      /* fallback silencioso */
    }
  }
  doc.setTextColor(cor);
  doc.text(nomeBanco, startX + logoW + gap, midY + 4.5);
  return y + h + 12;
}

function drawDisclaimer(doc: jsPDF, pageW: number, y: number) {
  doc.setTextColor(CINZA);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text(DISCLAIMER, MARGIN, y, { maxWidth: pageW - MARGIN * 2, lineHeightFactor: 1.4 });
}

// ---------------------------------------------------------------------------
// Consolidado (comparativo entre bancos) — usado na listagem
// ---------------------------------------------------------------------------

/** Cabeçalho landscape das páginas de detalhamento (mesma faixa azul do comparativo). */
const DETALHE_HEADER_H = 84;

/** Anexa uma página landscape por banco com o detalhamento completo da simulação. */
function anexarDetalhesBancos(doc: jsPDF, pageW: number, pageH: number, s: any, bancos: any[]) {
  const lista = bancosParaExtrato(bancos);
  lista.forEach((b) => {
    doc.addPage("a4", "landscape");
    const d = extrairDetalheBanco(b?.raw_response);
    drawBrandHeader(
      doc,
      pageW,
      DETALHE_HEADER_H,
      "Detalhamento da Simulação",
      `${produtoLabel(s)} · ${s.nome_cliente ?? "Cliente não informado"}`,
    );
    let y = DETALHE_HEADER_H + 24;
    y = drawFaixaBanco(doc, pageW, b?.nome_banco ?? "Banco", y);
    y = drawInfoFinanciamento(doc, pageW, s, b, d, y);

    // Resumo do pagamento (valores fornecidos pela instituição — sem recálculo)
    const resumo: { label: string; valor: string }[] = [
      { label: "1ª parcela", valor: brlOuTraco(d?.primeiraParcela ?? b?.valor_parcela) },
      { label: "Última parcela", valor: brlOuTraco(d?.ultimaParcela) },
      { label: "Somatório das parcelas", valor: brlOuTraco(d?.somatorioParcelas) },
    ];
    doc.setTextColor(AZUL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Resumo do Pagamento", MARGIN, y);
    y += 8;
    const w = pageW - MARGIN * 2;
    const gap = 8;
    const cardW = (w - gap * 2) / 3;
    const cardH = 40;
    resumo.forEach((it, i) => {
      const x = MARGIN + i * (cardW + gap);
      doc.setFillColor(ZEBRA);
      doc.setDrawColor(BORDA);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, cardW, cardH, 3, 3, "FD");
      doc.setTextColor(CINZA);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(it.label.toUpperCase(), x + 10, y + 15, { maxWidth: cardW - 16 });
      doc.setTextColor(AZUL);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(it.valor, x + 10, y + 32, { maxWidth: cardW - 16 });
    });
    y += cardH + 20;

    drawDisclaimer(doc, pageW, y);
  });
}

/** Gera e baixa um PDF institucional consolidado (dados + comparativo de bancos). */
export function baixarSimulacaoPDF(input: SimulacaoPdfInput) {
  const { simulacao: s, bancos } = input;

  // Com um único banco não há o que comparar: emitir o extrato detalhado com o
  // plano completo de parcelas em vez de uma tabela comparativa de uma linha.
  if ((bancos ?? []).length === 1) {
    baixarSimulacaoDetalhadaPDF(input);
    return;
  }

  const produto = produtoLabel(s);


  const meta = [
    `Nº ${s.numero_simulacao ?? "—"}`,
    `Cliente: ${s.nome_cliente ?? "—"}`,
    `Produto: ${produto}`,
    `UF: ${s.uf ?? "—"}`,
  ];

  const kpis: ReportKpi[] = [
    { label: "Valor do imóvel", valor: formatBRL(s.valor_imovel) },
    { label: "Financiamento", valor: formatBRL(s.valor_financiamento) },
    { label: "Entrada", valor: formatBRL(s.valor_entrada) },
    { label: "Prazo", valor: s.prazo ? `${s.prazo} meses` : "—" },
    { label: "Sistema", valor: s.sistema_amortizacao === "P" ? "PRICE" : "SAC" },
    { label: "FGTS", valor: s.utiliza_fgts === "S" ? "Sim" : "Não" },
  ];

  const columns: ReportColumn[] = [
    { key: "banco", label: "Banco" },
    { key: "situacao", label: "Situação" },
    { key: "parcela", label: "Parcela", align: "right" },
    { key: "taxa", label: "Taxa a.a.", align: "right" },
    { key: "prazo", label: "Prazo máx", align: "right" },
    { key: "financiamento", label: "Financ. máx", align: "right" },
  ];

  const rows: ReportRow[] = (bancos ?? []).map((b) => ({
    banco: b.nome_banco ?? "—",
    situacao: LABEL_STATUS_BANCO[b.status_banco ?? ""] ?? (b.status_banco || "—"),
    parcela: b.valor_parcela != null ? formatBRL(b.valor_parcela) : "—",
    taxa: b.taxa_juros_ano != null ? formatPercent(b.taxa_juros_ano / 100) : "—",
    prazo: b.prazo_pagamento_max ? `${b.prazo_pagamento_max}m` : "—",
    financiamento: b.valor_financiamento_max != null ? formatBRL(b.valor_financiamento_max) : "—",
  }));

  const firstColLogos: Record<string, { logo: string; ratio: number }> = {};
  (bancos ?? []).forEach((b) => {
    const nome = b.nome_banco ?? "—";
    const brand = resolveBancoBrand(nome);
    if (brand) firstColLogos[nome] = { logo: brand.logo, ratio: brand.ratio };
  });

  exportPDF(
    "Comparativo de Financiamento",
    `${produto} · ${s.nome_cliente ?? "Cliente não informado"}`,
    meta,
    kpis,
    columns,
    rows,
    sanitizarNomeArquivo(nomeDescritivo(s, bancos ?? [])),
    DISCLAIMER,
    firstColLogos,
    (doc, pageW, pageH) => anexarDetalhesBancos(doc, pageW, pageH, s, bancos ?? []),
  );

}

// ---------------------------------------------------------------------------
// Extrato SIMPLIFICADO / DETALHADO (voltado ao cliente, 1 banco por folha)
// ---------------------------------------------------------------------------

function bancosParaExtrato(bancos: any[]): any[] {
  const validos = (bancos ?? []).filter((b) => extrairDetalheBanco(b?.raw_response));
  return validos.length ? validos : (bancos ?? []);
}

/** Baixa o extrato simplificado: cabeçalho com CET/CESH/taxas + resumo, um banco por folha. */
export function baixarSimulacaoSimplificadaPDF({
  simulacao: s,
  bancos,
  docLabel,
  filePrefix,
  dataLabel,
}: SimulacaoPdfInput) {
  const lista = bancosParaExtrato(bancos);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  lista.forEach((b, idx) => {
    if (idx > 0) doc.addPage();
    const d = extrairDetalheBanco(b?.raw_response);
    drawClienteHeader(doc, pageW);
    let y = HEADER_H + 26;
    y = drawTituloExtrato(doc, pageW, s, y, docLabel, dataLabel);
    y = drawFaixaBanco(doc, pageW, b?.nome_banco ?? "Banco", y);
    y = drawDadosCliente(doc, pageW, s, y);
    y = drawInfoFinanciamento(doc, pageW, s, b, d, y);

    // Resumo das parcelas (valores fornecidos pela instituição — sem recálculo)
    const resumo: { label: string; valor: string }[] = [
      { label: "1ª parcela", valor: brlOuTraco(d?.primeiraParcela ?? b?.valor_parcela) },
      { label: "Última parcela", valor: brlOuTraco(d?.ultimaParcela) },
      { label: "Somatório das parcelas", valor: brlOuTraco(d?.somatorioParcelas) },
    ];
    doc.setTextColor(AZUL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Resumo do Pagamento", MARGIN, y);
    y += 8;
    const w = pageW - MARGIN * 2;
    const gap = 8;
    const cardW = (w - gap * 2) / 3;
    const cardH = 40;
    resumo.forEach((it, i) => {
      const x = MARGIN + i * (cardW + gap);
      doc.setFillColor(ZEBRA);
      doc.setDrawColor(BORDA);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, cardW, cardH, 3, 3, "FD");
      doc.setTextColor(CINZA);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(it.label.toUpperCase(), x + 10, y + 15, { maxWidth: cardW - 16 });
      doc.setTextColor(AZUL);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(it.valor, x + 10, y + 32, { maxWidth: cardW - 16 });
    });
    y += cardH + 20;

    drawDisclaimer(doc, pageW, y);
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, pageW, pageH, p, total);
  }

  return salvar(doc, s, "simplificada", lista);
}

/** Baixa o extrato detalhado: cabeçalho + TODAS as parcelas, um banco por folha. */
export function baixarSimulacaoDetalhadaPDF({
  simulacao: s,
  bancos,
  docLabel,
  filePrefix,
  dataLabel,
}: SimulacaoPdfInput) {
  const lista = bancosParaExtrato(bancos);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  lista.forEach((b, idx) => {
    if (idx > 0) doc.addPage();
    const d = extrairDetalheBanco(b?.raw_response);
    const nomeBanco = b?.nome_banco ?? "Banco";

    drawClienteHeader(doc, pageW);
    let y = HEADER_H + 26;
    y = drawTituloExtrato(doc, pageW, s, y, docLabel, dataLabel);
    y = drawFaixaBanco(doc, pageW, nomeBanco, y);
    y = drawDadosCliente(doc, pageW, s, y);
    y = drawInfoFinanciamento(doc, pageW, s, b, d, y);

    const parcelas = d?.parcelas ?? [];
    doc.setTextColor(AZUL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Plano de Pagamento (${parcelas.length} parcelas)`, MARGIN, y);
    if (d?.parcelasEstimadas) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(CINZA);
      doc.text(
        "Projeção calculada a partir da taxa e do sistema informados pelo banco (1ª/última parcela reais).",
        pageW - MARGIN,
        y,
        { align: "right" },
      );
    }
    y += 8;


    if (parcelas.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(CINZA);
      doc.text("Detalhamento de parcelas indisponível para esta simulação.", MARGIN, y + 16);
    } else {
      autoTable(doc, {
        startY: y,
        head: [
          [
            "Parc.",
            "Data",
            "Amortização",
            "Juros",
            "Parcela",
            "Saldo devedor",
          ],
        ],
        body: parcelas.map((p) => [
          String(p.numero),
          p.data ? dataTxt(p.data) : "—",
          formatBRL(p.amortizacao),
          formatBRL(p.juros),
          formatBRL(p.parcela),
          formatBRL(p.saldoDevedor),
        ]),
        margin: { left: MARGIN, right: MARGIN, top: HEADER_H + 16, bottom: 40 },
        styles: {
          fontSize: 6.5,
          cellPadding: 3,
          textColor: GRAFITE,
          lineColor: BORDA,
          lineWidth: 0.25,
        },
        headStyles: { fillColor: AZUL, textColor: "#FFFFFF", fontStyle: "bold", fontSize: 6.5 },
        alternateRowStyles: { fillColor: ZEBRA },
        columnStyles: {
          0: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
        // Redesenha o cabeçalho institucional quando o plano quebra em novas páginas
        didDrawPage: (hook) => {
          if (hook.pageNumber > 1 || parcelas.length > 0) drawClienteHeader(doc, pageW);
        },
      });
    }
  });

  // Disclaimer legal na última página, acima do rodapé.
  const disclaimerY = pageH - 64;
  const finalY = (doc as any).lastAutoTable?.finalY ?? 0;
  if (finalY > disclaimerY - 6) doc.addPage();
  drawDisclaimer(doc, pageW, pageH - 58);

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, pageW, pageH, p, total);
  }

  return salvar(doc, s, "detalhada", lista);
}

/** Abrevia um valor monetário em "k"/"mi" para uso no nome do arquivo. */
function abreviarValor(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "-";
  if (v >= 1_000_000) {
    const mi = v / 1_000_000;
    return `${Number.isInteger(mi) ? mi : mi.toFixed(1).replace(/\.0$/, "")}mi`;
  }
  const k = v / 1_000;
  return `${Math.round(k)}k`;
}

/** Sistema de amortização em rótulo curto (SAC/PRICE) para o nome do arquivo. */
function tabelaLabel(s: any, bancos: any[]): string {
  const d = bancos.map((b) => extrairDetalheBanco(b?.raw_response)).find(Boolean);
  return normalizarSistemaAmortizacao(d?.sistemaAmortizacao, s.sistema_amortizacao) || "-";
}

/**
 * Renda mínima ESTIMADA: derivada da parcela estimada localmente pelo sistema
 * de amortização (taxa/prazo/valor financiado), não da parcela informada pelo
 * banco. Usa a maior renda mínima entre os bancos (1ª parcela estimada / 30%).
 */
function rendaNecessaria(s: any, bancos: any[]): number | null {
  let renda: number | null = null;
  for (const b of bancos) {
    const d = extrairDetalheBanco(b?.raw_response);
    if (!d) continue;
    const av = avaliarRendaMinima({
      valor_financiamento:
        d.financiamentoTotal ?? d.valorFinanciamento ?? (Number(s.valor_financiamento) || 0),
      prazo_meses: d.prazoMeses ?? (Number(s.prazo) || 0),
      taxa_ano: d.taxaJurosAno ?? 0,
      sistema: normalizarSistemaAmortizacao(
        d.sistemaAmortizacao,
        s.sistema_amortizacao,
      ) as any,
    });
    const r = av?.rendaMinima ?? null;
    if (r != null && r > 0 && (renda == null || r > renda)) renda = r;
  }
  return renda;
}

/**
 * Nome de arquivo descritivo pedido pela operação, ex.:
 * "Bradesco,Caixa-SAC-C e V 420k - Finan 350k - 420 meses - renda 28k".
 */
function nomeDescritivo(s: any, bancos: any[]): string {
  const nomes = bancos.map((b) => b?.nome_banco).filter(Boolean);
  const bancoTxt = nomes.length ? Array.from(new Set(nomes)).join(",") : "Simulacao";
  const tabela = tabelaLabel(s, bancos);
  const cev = abreviarValor(s.valor_imovel);
  const finan = abreviarValor(s.valor_financiamento);
  const prazo = s.prazo ? `${s.prazo} meses` : "-";
  const renda = abreviarValor(rendaNecessaria(s, bancos));
  return `${bancoTxt}-${tabela}-C e V ${cev} - Finan ${finan} - ${prazo} - renda ${renda}`;
}

/** Remove caracteres inválidos de nome de arquivo, preservando espaços e vírgulas. */
function sanitizarNomeArquivo(nome: string): string {
  return nome.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
}

function salvar(doc: jsPDF, s: any, _tipo: string, bancos: any[] = []): jsPDF {
  const nome = sanitizarNomeArquivo(nomeDescritivo(s, bancos));
  doc.save(`${nome}.pdf`);
  return doc;
}

// ---------------------------------------------------------------------------
// Compatibilidade: detalhe de um único banco = extrato detalhado com 1 banco
// ---------------------------------------------------------------------------

/** Gera e baixa o PDF detalhado de um único banco (dados + todas as parcelas). */
export function baixarBancoDetalhePDF({ simulacao: s, banco: b }: { simulacao: any; banco: any }) {
  baixarSimulacaoDetalhadaPDF({ simulacao: s, bancos: [b] });
}

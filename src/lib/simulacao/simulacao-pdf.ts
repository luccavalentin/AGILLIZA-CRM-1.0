import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { exportPDF, drawBrandHeader } from "@/lib/relatorios/report-pdf";
import { formatBRL, formatPercent } from "@/lib/simulacao/format";
import type { ReportColumn, ReportKpi, ReportRow } from "@/lib/relatorios/shared";
import { extrairDetalheBanco, normalizarSistemaAmortizacao, calcularCET, type DetalheBanco } from "@/lib/simulacao/detalhe-banco";
import { avaliarRendaMinima, rendaMinimaPelosBancos, rendaMinimaDoBanco } from "@/lib/simulacao/renda";
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

// Paleta do documento — segue o tema (claro/escuro) ativo na geração.
import { getPdfPalette, type PdfPalette } from "@/lib/relatorios/pdf-theme";
let P: PdfPalette = getPdfPalette();

/** Preenche o fundo da página quando o tema é escuro. */
function drawPageBackground(doc: jsPDF, pageW: number, pageH: number) {
  if (!P.pageBg) return;
  doc.setFillColor(P.pageBg);
  doc.rect(0, 0, pageW, pageH, "F");
}

const HEADER_H = 68;
const MARGIN = 36;


// ---------------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------------

function pctTxt(v: number | null | undefined, sufixo = "a.a.", casas = 4): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-BR", {  minimumFractionDigits: 2, maximumFractionDigits: casas })}% ${sufixo}`.trim();
}

function dataTxt(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
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
  P = getPdfPalette();
  doc.setFillColor(P.azul);
  doc.rect(0, 0, pageW, HEADER_H, "F");
  doc.setFillColor(P.coral);
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
  doc.setTextColor(P.destaque);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, MARGIN, y);
  doc.setTextColor(P.texto);
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
  doc.setFillColor(P.card);
  doc.setDrawColor(P.borda);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, w, boxH, 4, 4, "FD");
  doc.setFillColor(P.coral);
  doc.rect(MARGIN, y + 8, 3, boxH - 16, "F");

  const colX = [MARGIN + 14, MARGIN + w * 0.5, MARGIN + w * 0.75];
  const rotulos = ["CLIENTE", "DATA DE NASCIMENTO", "CPF / CNPJ"];
  const valores = [
    (s.nome_cliente ?? "—").toString().toUpperCase(),
    dataTxt(s.data_nascimento),
    s.cpf_cnpj ?? "—",
  ];
  rotulos.forEach((r, i) => {
    doc.setTextColor(P.cinza);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(r, colX[i], y + 16);
    doc.setTextColor(P.destaque);
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
  opts?: { x?: number; width?: number; cols?: number },
): number {
  const startX = opts?.x ?? MARGIN;
  const w = opts?.width ?? pageW - MARGIN * 2;
  const cols = opts?.cols ?? 3;
  const itens: { label: string; valor: string }[] = [
    { label: "Valor de compra e venda", valor: brlOuTraco(d?.valorImovel ?? s.valor_imovel) },
    { label: "Despesas financiadas", valor: brlOuTraco(d?.despesasFinanciadas) },
    {
      label: "Valor de financiamento total",
      valor: brlOuTraco(d?.financiamentoTotal ?? d?.valorFinanciamento ?? s.valor_financiamento),
    },
    { label: "Entrada", valor: brlOuTraco((() => {
      const e = d?.valorEntrada ?? s.valor_entrada;
      if (e != null && Number(e) > 0) return e;
      const vi = Number(d?.valorImovel ?? s.valor_imovel ?? 0);
      const vf = Number(d?.financiamentoTotal ?? d?.valorFinanciamento ?? s.valor_financiamento ?? 0);
      const df = Number(d?.despesasFinanciadas ?? 0);
      const calc = vi - (vf - df);
      return vi > 0 && vf > 0 && calc > 0 ? calc : null;
    })()) },
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
        d?.cet ??
          calcularCET(
            d?.valorFinanciamento ?? s.valor_financiamento,
            d?.parcelas,
            (d?.iof ?? 0) + (d?.tarifaAvaliacao ?? 0),
          ),
      ),
    },
    {
      label: "Renda estimada",
      valor: brlOuTraco(rendaMinimaDoBanco(b)),
    },
  ];

  // Tarifa de avaliação de garantia (custo à vista, não financiado).
  // Valor padrão fixo aplicado a todos os bancos.
  if (d?.tarifaAvaliacao != null) {
    itens.splice(2, 0, {
      label: "Tarifa de avaliação (não financiada)",
      valor: brlOuTraco(d.tarifaAvaliacao),
    });
  }



  doc.setTextColor(P.destaque);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Informações do Financiamento", startX, y);
  y += 8;

  const gap = 8;
  const cardW = (w - gap * (cols - 1)) / cols;
  const cardH = 38;
  itens.forEach((it, i) => {
    const col = i % cols;
    const rowIdx = Math.floor(i / cols);
    const x = startX + col * (cardW + gap);
    const cy = y + rowIdx * (cardH + gap);
    doc.setFillColor(P.card);
    doc.setDrawColor(P.borda);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, cy, cardW, cardH, 3, 3, "FD");
    doc.setTextColor(P.cinza);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(it.label.toUpperCase(), x + 8, cy + 10, {
      maxWidth: cardW - 14,
      lineHeightFactor: 1.3,
    });
    // Valor ancorado na base do card, evitando colisão com rótulos de 2 linhas.
    doc.setTextColor(P.destaque);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(it.valor, x + 8, cy + cardH - 8, { maxWidth: cardW - 14 });
  });

  const linhas = Math.ceil(itens.length / cols);
  return y + linhas * (cardH + gap) + 8;
}


/** Faixa com o nome do banco centralizado: fundo branco, borda e texto na cor institucional do banco, com sua logo. */
function drawFaixaBanco(doc: jsPDF, pageW: number, nomeBanco: string, y: number): number {
  const w = pageW - MARGIN * 2;
  const h = 30;
  const brand = resolveBancoBrand(nomeBanco);
  const cor = brand?.cor ?? P.destaque;

  // Fundo branco com borda na cor institucional do banco
  doc.setFillColor(P.card);
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
  doc.setTextColor(P.texto);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(DISCLAIMER, MARGIN, y, { maxWidth: pageW - MARGIN * 2, lineHeightFactor: 1.4 });
}

/**
 * Aviso legal em destaque no topo do documento (logo abaixo do cabeçalho).
 * Retorna o novo `y` após o bloco.
 */
function drawDisclaimerTopo(doc: jsPDF, pageW: number, y: number): number {
  const w = pageW - MARGIN * 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const linhas = doc.splitTextToSize(DISCLAIMER, w - 20) as string[];
  const lineH = 9.5;
  const boxH = linhas.length * lineH + 14;
  doc.setFillColor(P.card);
  doc.setDrawColor(P.coral);
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN, y, w, boxH, 3, 3, "FD");
  doc.setTextColor(P.texto);
  doc.text(linhas, MARGIN + 10, y + 12, { lineHeightFactor: 1.35 });
  return y + boxH + 14;
}



// ---------------------------------------------------------------------------
// Consolidado (comparativo entre bancos) — usado na listagem
// ---------------------------------------------------------------------------

/** Cabeçalho landscape das páginas de detalhamento (mesma faixa azul do comparativo). */
const DETALHE_HEADER_H = 84;

/** Anexa, por banco, uma página landscape com o detalhamento agrupado + o plano de parcelas. */
function anexarDetalhesBancos(doc: jsPDF, pageW: number, pageH: number, s: any, bancos: any[]) {
  const lista = bancosParaExtrato(bancos);
  const subtitulo = `${produtoLabel(s)} · ${s.nome_cliente ?? "Cliente não informado"}`;

  lista.forEach((b) => {
    const d = extrairDetalheBanco(b?.raw_response);
    const nomeBanco = b?.nome_banco ?? "Banco";
    const parcelas = d?.parcelas ?? [];

    doc.addPage("a4", "landscape");
    drawPageBackground(doc, pageW, pageH);
    drawBrandHeader(doc, pageW, DETALHE_HEADER_H, "Detalhamento da Simulação", subtitulo);
    let y = DETALHE_HEADER_H + 24;
    y = drawFaixaBanco(doc, pageW, nomeBanco, y);

    // ----- Coluna esquerda (50%): Informações do Financiamento + Resumo -----
    const w = pageW - MARGIN * 2;
    const colGap = 20;
    const leftW = (w - colGap) / 2; // ~50% do espaço útil
    const blocoTop = y;

    let gy = drawInfoFinanciamento(doc, pageW, s, b, d, blocoTop, {
      x: MARGIN,
      width: leftW,
      cols: 2,
    });

    // Resumo do pagamento (valores fornecidos pela instituição — sem recálculo)
    const resumo: { label: string; valor: string }[] = [
      { label: "1ª parcela", valor: brlOuTraco(d?.primeiraParcela ?? b?.valor_parcela) },
      { label: "Última parcela", valor: brlOuTraco(d?.ultimaParcela) },
      { label: "Somatório das parcelas", valor: brlOuTraco(d?.somatorioParcelas) },
    ];
    doc.setTextColor(P.destaque);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Resumo do Pagamento", MARGIN, gy);
    gy += 8;
    const rGap = 8;
    const rCardW = (leftW - rGap * 2) / 3;
    const rCardH = 40;
    resumo.forEach((it, i) => {
      const x = MARGIN + i * (rCardW + rGap);
      doc.setFillColor(P.card);
      doc.setDrawColor(P.borda);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, gy, rCardW, rCardH, 3, 3, "FD");
      doc.setTextColor(P.cinza);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.text(it.label.toUpperCase(), x + 8, gy + 14, { maxWidth: rCardW - 12 });
      doc.setTextColor(P.destaque);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(it.valor, x + 8, gy + 31, { maxWidth: rCardW - 12 });
    });
    gy += rCardH + 12;

    drawDisclaimer(doc, pageW, gy);

    // Mapeia uma parcela para a linha da tabela.
    const linhaParcela = (p: (typeof parcelas)[number]) => [
      String(p.numero),
      p.data ? dataTxt(p.data) : "—",
      formatBRL(p.amortizacao),
      formatBRL(p.juros),
      formatBRL(p.parcela),
      formatBRL(p.saldoDevedor),
    ];
    const cabecalho = [["Parc.", "Data", "Amortização", "Juros", "Parcela", "Saldo devedor"]];
    const estiloTabela = {
      styles: {
        fontSize: 7,
        cellPadding: 3,
        textColor: P.texto,
        fillColor: P.pageBg ?? "#FFFFFF",
        lineColor: P.borda,
        lineWidth: 0.25,
      },
      headStyles: { fillColor: P.azul, textColor: P.headText, fontStyle: "bold" as const, fontSize: 7 },
      alternateRowStyles: { fillColor: P.card },
      columnStyles: {
        0: { halign: "right" as const },
        2: { halign: "right" as const },
        3: { halign: "right" as const },
        4: { halign: "right" as const },
        5: { halign: "right" as const },
      },
    };

    // ----- Plano de pagamento (as simulações) -----
    // 1ª parte: preenche o espaço vago à direita do bloco de informações.
    // Restante: continua nas páginas seguintes usando a largura total.
    const rightX = MARGIN + leftW + colGap;
    const rightW = w - leftW - colGap;

    doc.setTextColor(P.destaque);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Plano de Pagamento (${parcelas.length} parcelas)`, rightX, blocoTop);
    if (d?.parcelasEstimadas) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5);
      doc.setTextColor(P.cinza);
      doc.text("Projeção a partir da taxa/sistema do banco (1ª/última reais).", rightX, blocoTop + 10, {
        maxWidth: rightW,
      });
    }
    const tblTop = blocoTop + (d?.parcelasEstimadas ? 18 : 8);

    if (parcelas.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(P.cinza);
      doc.text("Detalhamento de parcelas indisponível para esta simulação.", rightX, tblTop + 14, {
        maxWidth: rightW,
      });
    } else {
      // Quantas linhas cabem, com folga, na coluna direita da primeira página.
      // Precisa ser conservador para a 1ª tabela NUNCA paginar (senão a
      // continuação herdaria a margem da coluna direita). O que sobra segue em
      // sequência, já na largura total, nas páginas seguintes.
      const rowH = 14.5; // altura real de cada linha (fonte 7 + padding 3)
      const headerH = 16;
      const bottomSafe = 48; // rodapé + respiro
      const dispH = pageH - bottomSafe - tblTop;
      const cabeNaColuna = Math.max(0, Math.floor((dispH - headerH) / rowH) - 1);

      const primeira = parcelas.slice(0, cabeNaColuna);
      const restante = parcelas.slice(cabeNaColuna);

      if (primeira.length > 0) {
        autoTable(doc, {
          startY: tblTop,
          tableWidth: rightW,
          // pageBreak "avoid": garante que este bloco não quebre para outra
          // página presa na coluna direita — o excedente vai em "restante".
          pageBreak: "avoid",
          margin: { left: rightX, right: MARGIN, top: DETALHE_HEADER_H + 16, bottom: bottomSafe },
          head: cabecalho,
          body: primeira.map(linhaParcela),
          ...estiloTabela,
        });
      }


      if (restante.length > 0) {
        doc.addPage("a4", "landscape");
        drawPageBackground(doc, pageW, pageH);
        drawBrandHeader(doc, pageW, DETALHE_HEADER_H, `Plano de Pagamento — ${nomeBanco}`, subtitulo);
        autoTable(doc, {
          startY: DETALHE_HEADER_H + 24,
          margin: { left: MARGIN, right: MARGIN, top: DETALHE_HEADER_H + 16, bottom: 40 },
          head: cabecalho,
          body: restante.map(linhaParcela),
          ...estiloTabela,
          willDrawPage: (hook) => {
            if (hook.pageNumber > 1) drawPageBackground(doc, pageW, pageH);
          },
          didDrawPage: () => {
            drawBrandHeader(doc, pageW, DETALHE_HEADER_H, `Plano de Pagamento — ${nomeBanco}`, subtitulo);
          },
        });
      }
    }
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

  const docInfo = [
    { label: "Data da simulação", value: dataTxt(s.created_at ?? new Date()) },
    { label: "Nº da simulação", value: String(s.numero_simulacao ?? "—") },
    { label: "Cliente", value: (s.nome_cliente ?? "—").toString() },
    { label: "CPF / CNPJ", value: s.cpf_cnpj ?? "—" },
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
    undefined,
    "portrait",
    docInfo,
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
  P = getPdfPalette();
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  lista.forEach((b, idx) => {
    if (idx > 0) doc.addPage();
    drawPageBackground(doc, pageW, pageH);
    const d = extrairDetalheBanco(b?.raw_response);
    drawClienteHeader(doc, pageW);
    let y = HEADER_H + 20;
    y = drawDisclaimerTopo(doc, pageW, y);
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
    doc.setTextColor(P.destaque);
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
      doc.setFillColor(P.card);
      doc.setDrawColor(P.borda);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, cardW, cardH, 3, 3, "FD");
      doc.setTextColor(P.cinza);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(it.label.toUpperCase(), x + 10, y + 15, { maxWidth: cardW - 16 });
      doc.setTextColor(P.destaque);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(it.valor, x + 10, y + 32, { maxWidth: cardW - 16 });
    });
    y += cardH + 20;

  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, pageW, pageH, p, total);
  }

  return salvar(doc, s, "simplificada", lista);
}

/** Monta o extrato detalhado: cabeçalho + TODAS as parcelas, um banco por folha. */
function criarDocSimulacaoDetalhada({
  simulacao: s,
  bancos,
  docLabel,
  filePrefix,
  dataLabel,
}: SimulacaoPdfInput) {
  const lista = bancosParaExtrato(bancos);
  P = getPdfPalette();
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  lista.forEach((b, idx) => {
    if (idx > 0) doc.addPage();
    drawPageBackground(doc, pageW, pageH);
    const d = extrairDetalheBanco(b?.raw_response);
    const nomeBanco = b?.nome_banco ?? "Banco";

    drawClienteHeader(doc, pageW);
    let y = HEADER_H + 20;
    y = drawDisclaimerTopo(doc, pageW, y);
    y = drawTituloExtrato(doc, pageW, s, y, docLabel, dataLabel);

    y = drawFaixaBanco(doc, pageW, nomeBanco, y);
    y = drawDadosCliente(doc, pageW, s, y);
    y = drawInfoFinanciamento(doc, pageW, s, b, d, y);

    const parcelas = d?.parcelas ?? [];
    doc.setTextColor(P.destaque);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Plano de Pagamento (${parcelas.length} parcelas)`, MARGIN, y);
    if (d?.parcelasEstimadas) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(P.cinza);
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
      doc.setTextColor(P.cinza);
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
          textColor: P.texto,
          fillColor: P.pageBg ?? "#FFFFFF",
          lineColor: P.borda,
          lineWidth: 0.25,
        },
        headStyles: { fillColor: P.azul, textColor: P.headText, fontStyle: "bold", fontSize: 6.5 },
        alternateRowStyles: { fillColor: P.card },
        columnStyles: {
          0: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
        willDrawPage: (hook) => {
          if (hook.pageNumber > 1) drawPageBackground(doc, pageW, pageH);
        },
        // Redesenha o cabeçalho institucional quando o plano quebra em novas páginas
        didDrawPage: (hook) => {
          if (hook.pageNumber > 1 || parcelas.length > 0) drawClienteHeader(doc, pageW);
        },
      });
    }
  });



  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, pageW, pageH, p, total);
  }

  return {
    doc,
    nome: sanitizarNomeArquivo(filePrefix || nomeDescritivo(s, lista)),
    totalBancos: lista.length,
  };
}

/** Baixa o extrato detalhado em PDF. */
export function baixarSimulacaoDetalhadaPDF(input: SimulacaoPdfInput) {
  const { doc, nome } = criarDocSimulacaoDetalhada(input);
  baixarBlob(doc.output("blob"), `${nome}.pdf`);
  return doc;
}

/**
 * Compatibilidade do nome antigo: baixa um PDF separado para cada banco.
 * Não gera ZIP e não junta os bancos em arquivo único.
 */
export async function baixarSimulacoesDetalhadasZipPDF(input: SimulacaoPdfInput) {
  return baixarSimulacoesDetalhadasAgrupadasZipPDF([
    { simulacao: input.simulacao, bancos: input.bancos },
  ]);
}

/**
 * Baixa PDFs detalhados de uma ou mais simulações como arquivos individuais:
 * 1 banco/tabela = 1 PDF nomeado de forma clara.
 */
export async function baixarSimulacoesDetalhadasAgrupadasZipPDF(
  grupos: Array<{ simulacao: any; bancos: any[] }>,
) {
  const gruposValidos = grupos
    .map((g) => ({ simulacao: g.simulacao, bancos: bancosParaExtrato(g.bancos) }))
    .filter((g) => g.bancos.length > 0);

  if (gruposValidos.length === 0) throw new Error("Nenhum banco disponível para gerar PDF.");

  let total = 0;
  let falhas = 0;
  const nomesUsados = new Set<string>();

  for (const g of gruposValidos) {
    for (const banco of g.bancos) {
      try {
        const base = `${nomeDescritivo(g.simulacao, [banco])}.pdf`;
        const filename = nomeArquivoUnico(base, nomesUsados);
        const { doc } = criarDocSimulacaoDetalhada({
          simulacao: g.simulacao,
          bancos: [banco],
          filePrefix: filename.replace(/\.pdf$/i, ""),
        });
        baixarBlob(doc.output("blob"), filename);
        total += 1;
        // Intervalo entre downloads: o Chromium ignora/renomeia arquivos
        // quando múltiplos <a download> são disparados no mesmo tick.
        await new Promise((r) => setTimeout(r, 450));
      } catch (err) {
        falhas += 1;
        console.error("[PDF] falha ao gerar PDF do banco", banco?.nome_banco, err);
      }
    }
  }

  if (total === 0 && falhas > 0) {
    throw new Error(`Falha ao gerar ${falhas} PDF${falhas === 1 ? "" : "s"}.`);
  }
  return total;
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

/** Sistema de amortização em rótulo curto (SAC/PRICE) para o nome do arquivo.
 * Prioriza o sistema requisitado por banco (b._sistema) — necessário para o
 * caso "Ambos (SAC + PRICE)" em que o mesmo banco aparece duas vezes. */
function tabelaLabel(s: any, bancos: any[]): string {
  const req = String(bancos?.[0]?._sistema ?? "").toUpperCase();
  if (req.includes("PRICE") || req === "P") return "PRICE";
  if (req.includes("SAC") || req === "S") return "SAC";
  const d = bancos.map((b) => extrairDetalheBanco(b?.raw_response)).find(Boolean);
  return normalizarSistemaAmortizacao(d?.sistemaAmortizacao, s.sistema_amortizacao) || "-";
}

/**
 * Renda familiar estimada: usa primeiro o retorno real dos bancos e, havendo
 * divergência, considera a maior renda exigida. Sem retorno bancário, usa uma
 * estimativa local conservadora.
 */
function rendaNecessaria(s: any, bancos: any[]): number | null {
  // Usa a MESMA lógica exibida na tela: renda mínima por banco (SAC ÷ 30% ou PRICE ÷ 15%).
  // Para múltiplos bancos no mesmo arquivo, considera a MAIOR renda exigida (mais conservador).
  const rendas = (bancos ?? [])
    .map((b) => rendaMinimaDoBanco(b))
    .filter((r): r is number => typeof r === "number" && r > 0);
  if (rendas.length) return Math.max(...rendas);

  // Fallback local quando nenhum banco tem retorno.
  const taxas = (bancos ?? [])
    .map((b) => {
      const d = extrairDetalheBanco(b?.raw_response);
      const pct = d?.taxaJurosAno ?? b?.taxa_juros_ano;
      return typeof pct === "number" && pct > 0 ? pct / 100 : null;
    })
    .filter((t): t is number => t != null);
  const taxaAno = taxas.length ? Math.max(...taxas) : 0.1199;

  const av = avaliarRendaMinima({
    valor_imovel: Number(s.valor_imovel) || 0,
    valor_financiamento: Number(s.valor_financiamento) || 0,
    prazo_meses: Number(s.prazo) || 0,
    taxa_ano: taxaAno,
    sistema: (normalizarSistemaAmortizacao(undefined, s.sistema_amortizacao) as any) || "S",
  });
  return av?.rendaMinima ?? null;
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

function nomeArquivoUnico(nome: string, usados: Set<string>): string {
  const limpo = sanitizarNomeArquivo(nome);
  if (!usados.has(limpo)) {
    usados.add(limpo);
    return limpo;
  }
  const base = limpo.replace(/\.pdf$/i, "");
  let i = 2;
  while (usados.has(`${base} (${i}).pdf`)) i += 1;
  const unico = `${base} (${i}).pdf`;
  usados.add(unico);
  return unico;
}

function baixarBlob(blob: Blob, filename: string) {
  if (typeof document === "undefined") {
    throw new Error("Download disponível apenas no navegador.");
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizarNomeArquivo(filename);
  a.rel = "noopener";
  a.style.display = "none";
  (document.body || document.documentElement).appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function salvar(doc: jsPDF, s: any, _tipo: string, bancos: any[] = []): jsPDF {
  const nome = sanitizarNomeArquivo(nomeDescritivo(s, bancos));
  baixarBlob(doc.output("blob"), `${nome}.pdf`);
  return doc;
}

// ---------------------------------------------------------------------------
// Compatibilidade: detalhe de um único banco = extrato detalhado com 1 banco
// ---------------------------------------------------------------------------

/** Gera e baixa o PDF detalhado de um único banco (dados + todas as parcelas). */
export function baixarBancoDetalhePDF({ simulacao: s, banco: b }: { simulacao: any; banco: any }) {
  baixarSimulacaoDetalhadaPDF({ simulacao: s, bancos: [b] });
}

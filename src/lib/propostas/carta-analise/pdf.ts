/**
 * PDF da carta de análise de crédito, nos três modelos da Agilliza.
 *
 * Os modelos vieram em Word. Não convertemos o .docx: o sistema roda na
 * Cloudflare, onde não há conversor, e a conversão no navegador desmonta o
 * layout. As páginas são desenhadas aqui por cima das próprias artes dos
 * modelos (capa e papel de fundo exportados em `public/cartas`), com a
 * mesma hierarquia de textos — o PDF sai com texto nítido e selecionável.
 */
import { jsPDF } from "jspdf";
import type { CamposCarta, ModeloCarta } from "./dados";

type RGB = [number, number, number];

const NAVY: RGB = [12, 19, 153];
const NAVY_ESCURO: RGB = [7, 9, 94];
const VERMELHO: RGB = [245, 51, 63];
const BRANCO: RGB = [255, 255, 255];
const TEXTO: RGB = [22, 26, 70];
const APAGADO: RGB = [107, 111, 142];
const LAVANDA: RGB = [201, 204, 242];
const BORDA: RGB = [222, 224, 240];
const FUNDO_CARTAO: RGB = [246, 247, 252];

const W = 210;
const H = 297;
const MX = 18;

const VAZIO = "—";
const v = (s: string | null | undefined) => (s && s.trim() ? s.trim() : VAZIO);

const cacheImagens = new Map<string, Promise<string>>();
function imagem(caminho: string): Promise<string> {
  if (!cacheImagens.has(caminho)) {
    cacheImagens.set(
      caminho,
      fetch(caminho)
        .then((r) => {
          if (!r.ok) throw new Error(`Imagem da carta não encontrada: ${caminho}`);
          return r.blob();
        })
        .then(
          (blob) =>
            new Promise<string>((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(String(fr.result));
              fr.onerror = () => reject(fr.error);
              fr.readAsDataURL(blob);
            }),
        ),
    );
  }
  return cacheImagens.get(caminho)!;
}

// ---------------------------------------------------------------- helpers
function cor(doc: jsPDF, c: RGB) {
  doc.setTextColor(c[0], c[1], c[2]);
}
function fill(doc: jsPDF, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function draw(doc: jsPDF, c: RGB) {
  doc.setDrawColor(c[0], c[1], c[2]);
}
function fonte(doc: jsPDF, tamanho: number, estilo: "normal" | "bold" = "normal") {
  doc.setFont("helvetica", estilo);
  doc.setFontSize(tamanho);
}
function opacidade(doc: jsPDF, alpha: number) {
  const GState = (doc as any).GState;
  if (GState) (doc as any).setGState(new GState({ opacity: alpha }));
}
/** Texto com espaçamento entre letras (rótulos em caixa alta dos modelos). */
function espacado(
  doc: jsPDF,
  texto: string,
  x: number,
  y: number,
  opts: { align?: "left" | "right" } = {},
) {
  doc.text(texto, x, y, { charSpace: 0.6, align: opts.align } as any);
}
/**
 * Uma linha que cabe em `largura`: reduz a fonte até `minimo` antes de cortar
 * com reticências. Deixa a fonte ajustada para o `doc.text` seguinte.
 */
function caber(doc: jsPDF, texto: string, largura: number, tamanho: number, minimo = 7) {
  let t = tamanho;
  doc.setFontSize(t);
  while (t > minimo && doc.getTextWidth(texto) > largura) {
    t -= 0.3;
    doc.setFontSize(t);
  }
  return linhas(doc, texto, largura, 1)[0];
}

/** Quebra o texto na largura e corta em `maxLinhas`, com reticências. */
function linhas(doc: jsPDF, texto: string, largura: number, maxLinhas: number): string[] {
  const todas = doc.splitTextToSize(texto, largura) as string[];
  if (todas.length <= maxLinhas) return todas;
  const cortadas = todas.slice(0, maxLinhas);
  cortadas[maxLinhas - 1] = `${cortadas[maxLinhas - 1].replace(/\s+\S*$/, "")}…`;
  return cortadas;
}

interface Tema {
  escuro: boolean;
  texto: RGB;
  rotulo: RGB;
  destaque: RGB;
}
const TEMA_ESCURO: Tema = { escuro: true, texto: BRANCO, rotulo: LAVANDA, destaque: BRANCO };
const TEMA_CLARO: Tema = { escuro: false, texto: TEXTO, rotulo: APAGADO, destaque: NAVY };

function cartao(doc: jsPDF, tema: Tema, x: number, y: number, w: number, h: number) {
  if (tema.escuro) {
    opacidade(doc, 0.08);
    fill(doc, BRANCO);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, "F");
    opacidade(doc, 1);
  } else {
    fill(doc, FUNDO_CARTAO);
    draw(doc, BORDA);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");
  }
}

function tituloSecao(doc: jsPDF, tema: Tema, texto: string, y: number) {
  fill(doc, VERMELHO);
  doc.rect(MX, y - 2.6, 1.2, 3.2, "F");
  fonte(doc, 8, "bold");
  cor(doc, tema.escuro ? LAVANDA : NAVY);
  espacado(doc, texto.toUpperCase(), MX + 3.5, y);
}

/** Grade de "rótulo / valor" em cartões. Devolve o y final. */
function grade(
  doc: jsPDF,
  tema: Tema,
  itens: { rotulo: string; valor: string; destaque?: boolean }[],
  y: number,
  colunas: number,
  alturaCelula = 15,
) {
  const gap = 3;
  const larg = (W - MX * 2 - gap * (colunas - 1)) / colunas;
  itens.forEach((it, i) => {
    const col = i % colunas;
    const lin = Math.floor(i / colunas);
    const x = MX + col * (larg + gap);
    const yy = y + lin * (alturaCelula + gap);
    if (it.destaque) {
      fill(doc, tema.escuro ? VERMELHO : NAVY);
      doc.roundedRect(x, yy, larg, alturaCelula, 2.5, 2.5, "F");
    } else {
      cartao(doc, tema, x, yy, larg, alturaCelula);
    }
    fonte(doc, 6.8, "bold");
    cor(doc, it.destaque ? (tema.escuro ? BRANCO : LAVANDA) : tema.rotulo);
    espacado(doc, it.rotulo.toUpperCase(), x + 3.5, yy + 5.6);
    fonte(doc, it.destaque ? 10.5 : 9.8, "bold");
    cor(doc, it.destaque ? BRANCO : tema.texto);
    doc.text(caber(doc, v(it.valor), larg - 7, it.destaque ? 10.5 : 9.8), x + 3.5, yy + 11.4);
  });
  const nLinhas = Math.ceil(itens.length / colunas);
  return y + nLinhas * (alturaCelula + gap) - gap;
}

function rodapeInstitucional(doc: jsPDF, tema: Tema, pagina: number, total: number) {
  fonte(doc, 6.5, "bold");
  cor(doc, tema.escuro ? LAVANDA : APAGADO);
  espacado(doc, "AGILLIZA  •  CRÉDITO IMOBILIÁRIO", MX, 285.5);
  doc.text(`agillizacred.com.br   •   ${pagina}/${total}`, W - MX, 285.5, { align: "right" });
}

function cabecalhoNumero(doc: jsPDF, c: CamposCarta, corTexto: RGB, y = 16) {
  fonte(doc, 7, "bold");
  cor(doc, corTexto);
  espacado(doc, `ANÁLISE Nº  ${v(c.numeroAnalise)}`, W - MX, y, { align: "right" });
  espacado(doc, `DATA  ${v(c.data)}`, W - MX, y + 5, { align: "right" });
}

// ------------------------------------------------ páginas 2 e 3 (1 e 2)
function paginaResumo(doc: jsPDF, tema: Tema, c: CamposCarta, parecer: string) {
  cabecalhoNumero(doc, c, BRANCO);

  fonte(doc, 7.5, "bold");
  cor(doc, VERMELHO);
  espacado(doc, "PARECER DE ANÁLISE DE CRÉDITO", MX, 52);
  fonte(doc, 19, "bold");
  cor(doc, tema.escuro ? BRANCO : NAVY);
  doc.text("Resumo da proposta de", MX, 61);
  doc.text("financiamento imobiliário", MX, 69);

  // Proponentes
  const larg = (W - MX * 2 - 3) / 2;
  [
    { rot: "1º PROPONENTE", nome: c.proponente1Nome, cpf: c.proponente1Cpf },
    { rot: "2º PROPONENTE", nome: c.proponente2Nome, cpf: c.proponente2Cpf },
  ].forEach((p, i) => {
    const x = MX + i * (larg + 3);
    cartao(doc, tema, x, 78, larg, 21);
    fonte(doc, 6.8, "bold");
    cor(doc, tema.rotulo);
    espacado(doc, p.rot, x + 3.5, 84);
    fonte(doc, 10, "bold");
    cor(doc, tema.texto);
    doc.text(linhas(doc, v(p.nome), larg - 7, 1)[0], x + 3.5, 90.5);
    fonte(doc, 8.5, "normal");
    cor(doc, tema.rotulo);
    doc.text(p.cpf ? `CPF  ${p.cpf}` : " ", x + 3.5, 95.5);
  });

  tituloSecao(doc, tema, "Dados do financiamento", 110);
  let y = grade(
    doc,
    tema,
    [
      { rotulo: "Produto", valor: c.produto },
      { rotulo: "Instituição financeira", valor: c.banco },
      { rotulo: "Sistema de amortização", valor: c.sistemaAmortizacao },
      { rotulo: "Valor do imóvel", valor: c.valorImovel },
      { rotulo: "Valor do financiamento", valor: c.valorFinanciamento },
      { rotulo: "1ª parcela", valor: c.primeiraParcela },
    ],
    114,
    3,
  );

  tituloSecao(doc, tema, "Resultado da análise", y + 11);
  y = grade(
    doc,
    tema,
    [
      { rotulo: "Parecer", valor: parecer, destaque: true },
      { rotulo: "Data de vencimento", valor: c.vencimento },
      { rotulo: "Prazo", valor: c.prazo },
      { rotulo: "Indexador", valor: c.indexador },
      { rotulo: "Total renda familiar", valor: c.rendaFamiliar },
      { rotulo: "FGTS aprovado", valor: c.fgtsAprovado },
      { rotulo: "Subsídio apurado", valor: c.subsidio },
      { rotulo: "Agência de vinculação", valor: c.agencia },
      { rotulo: "Construtora", valor: c.construtora },
      { rotulo: "Empreendimento", valor: c.empreendimento },
      { rotulo: "Unidade", valor: c.unidade },
    ],
    y + 15,
    3,
  );
}

function blocoTexto(
  doc: jsPDF,
  tema: Tema,
  titulo: string,
  texto: string,
  y: number,
  altura: number,
) {
  tituloSecao(doc, tema, titulo, y);
  cartao(doc, tema, MX, y + 4, W - MX * 2, altura);
  fonte(doc, 9.5, "normal");
  cor(doc, tema.texto);
  const maxLinhas = Math.floor((altura - 8) / 4.6);
  doc.text(linhas(doc, v(texto), W - MX * 2 - 10, maxLinhas), MX + 5, y + 11, {
    lineHeightFactor: 1.35,
  } as any);
  return y + 4 + altura;
}

function paginaObservacoes(doc: jsPDF, tema: Tema, c: CamposCarta) {
  cabecalhoNumero(doc, c, BRANCO);

  fonte(doc, 7.5, "bold");
  cor(doc, VERMELHO);
  espacado(doc, "PARECER DE ANÁLISE DE CRÉDITO", MX, 52);
  fonte(doc, 19, "bold");
  cor(doc, tema.escuro ? BRANCO : NAVY);
  doc.text("Observações e condições", MX, 61);
  doc.text("da proposta", MX, 69);

  let y = blocoTexto(doc, tema, "Utilização e validação de FGTS", c.textoFgts, 82, 62);
  y = blocoTexto(doc, tema, "Observações da proposta", c.observacoes, y + 11, 86);

  tituloSecao(doc, tema, "Próximos passos", y + 11);
  fonte(doc, 9.5, "normal");
  cor(doc, tema.texto);
  doc.text(
    doc.splitTextToSize(
      "Nossa equipe entrará em contato para orientar o envio da documentação complementar e o agendamento das próximas etapas junto à instituição financeira e à construtora.",
      W - MX * 2,
    ),
    MX,
    y + 18,
    { lineHeightFactor: 1.35 } as any,
  );
}

// --------------------------------------------------------- capas 1 e 2
function capaModelo1(doc: jsPDF, c: CamposCarta, parecerCurto: string, total: number) {
  cabecalhoNumero(doc, c, BRANCO, 20);

  fonte(doc, 7.5, "bold");
  cor(doc, VERMELHO);
  espacado(doc, "PARECER DE ANÁLISE DE CRÉDITO", MX, 184);
  fonte(doc, 23, "bold");
  cor(doc, BRANCO);
  doc.text("Hoje começa um novo", MX, 196);
  doc.text("capítulo da sua história.", MX, 206);

  fonte(doc, 11, "normal");
  cor(doc, LAVANDA);
  doc.text("Cliente: ", MX, 218);
  fonte(doc, 11, "bold");
  cor(doc, BRANCO);
  doc.text(linhas(doc, v(c.proponente1Nome), 150, 1)[0], MX + 15, 218);

  fonte(doc, 9.5, "normal");
  cor(doc, LAVANDA);
  doc.text("Sua proposta de Financiamento Imobiliário foi submetida à pré-análise da", MX, 228);
  doc.text("instituição financeira e obteve o resultado:", MX, 233);

  // Pílula vermelha da arte (x 35.6→174.5, y 243.8→266.5)
  fonte(doc, parecerCurto.length > 14 ? 15 : 19, "bold");
  cor(doc, BRANCO);
  doc.text(parecerCurto, W / 2, 257.6, { align: "center", charSpace: 0.8 } as any);

  rodapeInstitucional(doc, TEMA_ESCURO, 1, total);
}

function capaModelo2(doc: jsPDF, c: CamposCarta, parecerCapa: string, total: number) {
  cabecalhoNumero(doc, c, BRANCO, 16);

  fonte(doc, 7.5, "bold");
  cor(doc, VERMELHO);
  espacado(doc, "PARECER DE ANÁLISE DE CRÉDITO", MX, 176);
  fonte(doc, 23, "bold");
  cor(doc, NAVY);
  doc.text("Hoje começa um novo", MX, 188);
  doc.text("capítulo da sua história.", MX, 198);

  fonte(doc, 11, "normal");
  cor(doc, APAGADO);
  doc.text("Cliente: ", MX, 210);
  fonte(doc, 11, "bold");
  cor(doc, TEXTO);
  doc.text(linhas(doc, v(c.proponente1Nome), 150, 1)[0], MX + 15, 210);

  fonte(doc, 9.5, "normal");
  cor(doc, APAGADO);
  doc.text("Sua proposta de Financiamento Imobiliário foi submetida à pré-análise da", MX, 220);
  doc.text("instituição financeira e obteve o resultado:", MX, 225);

  // Caixa azul com o check da arte (x 17.8→192.3, y 242→265)
  fonte(doc, parecerCapa.length > 24 ? 13 : 16, "bold");
  cor(doc, BRANCO);
  doc.text(parecerCapa, 41, 256, { charSpace: 0.6 } as any);

  rodapeInstitucional(doc, TEMA_CLARO, 1, total);
}

// ------------------------------------------------------------ modelo 3
async function modelo3(doc: jsPDF, c: CamposCarta, parecer: string, incluirObservacoes: boolean) {
  const total = incluirObservacoes ? 3 : 2;
  const [logo, foto] = await Promise.all([
    imagem("/cartas/logo-colorido.jpg"),
    imagem("/cartas/modelo3-foto.jpg"),
  ]);
  const tema = TEMA_CLARO;

  const cabecalho = (pagina: number) => {
    fill(doc, NAVY);
    doc.rect(0, 0, W, 3, "F");
    fill(doc, VERMELHO);
    doc.rect(W * 0.7, 0, W * 0.3, 3, "F");
    doc.addImage(logo, "JPEG", MX, 10, 40, 14.6, "logo", "FAST");
    fonte(doc, 7, "bold");
    cor(doc, NAVY);
    espacado(doc, `PARECER DE CRÉDITO   /   0${pagina}`, W - MX, 15, { align: "right" });
    fonte(doc, 7, "normal");
    cor(doc, APAGADO);
    doc.text(`ANÁLISE Nº: ${v(c.numeroAnalise)}     •     DATA: ${v(c.data)}`, W - MX, 20, {
      align: "right",
    });
    draw(doc, BORDA);
    doc.setLineWidth(0.3);
    doc.line(MX, 29, W - MX, 29);
  };
  const rodape = (pagina: number) => {
    fill(doc, NAVY);
    doc.rect(0, H - 3, W * 0.7, 3, "F");
    fill(doc, VERMELHO);
    doc.rect(W * 0.7, H - 3, W * 0.3, 3, "F");
    fonte(doc, 6.5, "bold");
    cor(doc, APAGADO);
    espacado(doc, "PESSOAS   •   PLANOS   •   CONQUISTAS", MX, 287);
    doc.text(`agillizacred.com.br   •   ${pagina}/${total}`, W - MX, 287, { align: "right" });
  };
  const secao = (texto: string, y: number) => {
    fonte(doc, 7.5, "bold");
    cor(doc, VERMELHO);
    espacado(doc, `—  ${texto.toUpperCase()}`, MX, y);
  };
  const linhaTabela = (rotulo: string, valor: string, y: number, x = MX, larg = W - MX * 2) => {
    fonte(doc, 8.5, "normal");
    cor(doc, APAGADO);
    doc.text(rotulo, x, y);
    fonte(doc, 9.5, "bold");
    cor(doc, TEXTO);
    doc.text(caber(doc, v(valor), larg * 0.62, 9.5), x + larg, y, { align: "right" });
    draw(doc, BORDA);
    doc.setLineWidth(0.2);
    doc.line(x, y + 3, x + larg, y + 3);
  };
  const caixaParecer = (titulo: string, y: number) => {
    fill(doc, NAVY);
    doc.roundedRect(MX, y, W - MX * 2, 20, 3, 3, "F");
    fill(doc, VERMELHO);
    doc.roundedRect(MX, y, 3, 20, 1.5, 1.5, "F");
    fonte(doc, 7, "bold");
    cor(doc, LAVANDA);
    espacado(doc, titulo, MX + 8, y + 7.5);
    fonte(doc, 15, "bold");
    cor(doc, BRANCO);
    doc.text(parecer, MX + 8, y + 15);
  };

  // Página 1 — apresentação executiva
  cabecalho(1);
  secao("Apresentação executiva", 42);
  fonte(doc, 22, "bold");
  cor(doc, NAVY);
  doc.text("Uma conquista", MX, 54);
  doc.text("começa com", MX, 63);
  doc.text("informação clara.", MX, 72);
  fill(doc, VERMELHO);
  doc.rect(MX, 78, 14, 1, "F");

  const metas: [string, string][] = [
    ["DATA", c.data],
    ["ANÁLISE Nº", c.numeroAnalise],
    ["1º PROPONENTE", c.proponente1Nome],
  ];
  metas.forEach(([rot, val], i) => {
    const y = 90 + i * 13;
    fonte(doc, 6.8, "bold");
    cor(doc, APAGADO);
    espacado(doc, rot, MX, y);
    fonte(doc, 10.5, "bold");
    cor(doc, TEXTO);
    doc.text(linhas(doc, v(val), 82, 1)[0], MX, y + 5.5);
  });

  // Foto com bloco azul atrás
  fill(doc, NAVY);
  doc.roundedRect(112, 40, 82, 88, 4, 4, "F");
  doc.addImage(foto, "JPEG", 106, 34, 84, 86, "foto", "FAST");
  fill(doc, VERMELHO);
  doc.rect(106, 120, 30, 2.2, "F");

  fonte(doc, 7, "bold");
  cor(doc, NAVY);
  espacado(doc, "PARECER DE ANÁLISE DE CRÉDITO", MX, 138);

  secao("Resumo da proposta", 150);
  [
    ["2º proponente", c.proponente2Nome],
    ["Instituição financeira", c.banco],
    ["Produto", c.produto],
    ["Valor do imóvel", c.valorImovel],
    ["Valor do financiamento", c.valorFinanciamento],
    ["1ª parcela", c.primeiraParcela],
    ["Sistema de amortização", c.sistemaAmortizacao],
  ].forEach(([r, val], i) => linhaTabela(r, val, 160 + i * 10));
  caixaParecer("RESULTADO DA ANÁLISE", 236);
  rodape(1);

  // Página 2 — informações financeiras
  doc.addPage();
  cabecalho(2);
  secao("01  /  Informações financeiras", 42);
  fonte(doc, 22, "bold");
  cor(doc, NAVY);
  doc.text("Detalhes da proposta", MX, 54);

  fonte(doc, 7.5, "bold");
  cor(doc, NAVY);
  espacado(doc, "PROPONENTES", MX, 68);
  const meia = (W - MX * 2 - 8) / 2;
  linhaTabela("1º proponente", c.proponente1Nome, 76, MX, meia);
  linhaTabela("CPF", c.proponente1Cpf, 86, MX, meia);
  linhaTabela("2º proponente", c.proponente2Nome, 76, MX + meia + 8, meia);
  linhaTabela("CPF", c.proponente2Cpf, 86, MX + meia + 8, meia);

  secao("Dados da operação", 102);
  const itens: [string, string][] = [
    ["Produto / modalidade", c.produto],
    ["Instituição financeira", c.banco],
    ["Valor do imóvel", c.valorImovel],
    ["Valor do financiamento", c.valorFinanciamento],
    ["1ª parcela", c.primeiraParcela],
    ["Sistema de amortização", c.sistemaAmortizacao],
    ["Parecer", parecer],
    ["Validade / vencimento", c.vencimento],
    ["FGTS autorizado", c.fgtsAprovado],
    ["Renda familiar considerada", c.rendaFamiliar],
    ["Agência", c.agencia],
    ["Prazo", c.prazo],
    ["Indexador", c.indexador],
    ["Subsídio apurado", c.subsidio],
    ["Construtora", c.construtora],
    ["Empreendimento", c.empreendimento],
    ["Unidade", c.unidade],
  ];
  itens.forEach(([r, val], i) => {
    const col = i % 2;
    const lin = Math.floor(i / 2);
    linhaTabela(r, val, 112 + lin * 10, MX + col * (meia + 8), meia);
  });

  const yNota = 112 + Math.ceil(itens.length / 2) * 10 + 4;
  fill(doc, FUNDO_CARTAO);
  draw(doc, BORDA);
  doc.roundedRect(MX, yNota, W - MX * 2, 22, 3, 3, "FD");
  fonte(doc, 7, "bold");
  cor(doc, NAVY);
  espacado(doc, "NOTA SOBRE AS CONDIÇÕES", MX + 5, yNota + 7);
  fonte(doc, 8.5, "normal");
  cor(doc, APAGADO);
  doc.text(
    doc.splitTextToSize(
      "Dados confirmados pela instituição financeira. Taxas, prazos e valores estão sujeitos às condições vigentes e à validação documental.",
      W - MX * 2 - 10,
    ),
    MX + 5,
    yNota + 13,
  );
  rodape(2);

  if (!incluirObservacoes) return;

  // Página 3 — considerações da análise (opcional)
  doc.addPage();
  cabecalho(3);
  secao("02  /  Considerações da análise", 42);
  fonte(doc, 22, "bold");
  cor(doc, NAVY);
  doc.text("FGTS e observações", MX, 54);
  doc.text("da proposta", MX, 63);

  const cartaoNumerado = (
    num: string,
    sup: string,
    titulo: string,
    texto: string,
    y: number,
    h: number,
  ) => {
    cartao(doc, tema, MX, y, W - MX * 2, h);
    fonte(doc, 18, "bold");
    cor(doc, VERMELHO);
    doc.text(num, MX + 6, y + 13);
    fonte(doc, 6.8, "bold");
    cor(doc, APAGADO);
    espacado(doc, sup, MX + 22, y + 7);
    fonte(doc, 11, "bold");
    cor(doc, NAVY);
    doc.text(titulo, MX + 22, y + 13);
    fonte(doc, 9.3, "normal");
    cor(doc, TEXTO);
    doc.text(linhas(doc, v(texto), W - MX * 2 - 28, Math.floor((h - 20) / 4.4)), MX + 22, y + 20, {
      lineHeightFactor: 1.35,
    } as any);
  };
  cartaoNumerado(
    "01",
    "CONFERÊNCIA DOCUMENTAL",
    "Utilização e validação do FGTS",
    c.textoFgts,
    72,
    44,
  );
  cartaoNumerado("02", "REGISTRO ESPECÍFICO", "Observações da proposta", c.observacoes, 121, 50);
  caixaParecer("PARECER DA ANÁLISE", 177);

  fill(doc, FUNDO_CARTAO);
  draw(doc, BORDA);
  doc.roundedRect(MX, 208, W - MX * 2, 26, 3, 3, "FD");
  fonte(doc, 7, "bold");
  cor(doc, NAVY);
  espacado(doc, "INFORMAÇÕES IMPORTANTES", MX + 5, 215);
  fonte(doc, 8.3, "normal");
  cor(doc, APAGADO);
  doc.text(
    doc.splitTextToSize(
      "Este parecer reflete exclusivamente a decisão formalmente informada pela instituição financeira e a documentação correspondente. As condições estão sujeitas à validação documental e às regras vigentes da instituição.",
      W - MX * 2 - 10,
    ),
    MX + 5,
    221,
  );
  rodape(3);
}

// ---------------------------------------------------------------- API
export async function gerarCartaAnalisePdf(
  modelo: ModeloCarta,
  campos: CamposCarta,
  parecer: { curto: string; capa: string },
  opcoes: { incluirObservacoes?: boolean } = {},
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const incluirObservacoes = opcoes.incluirObservacoes ?? true;
  const total = incluirObservacoes ? 3 : 2;

  if (modelo === "modelo3") {
    await modelo3(doc, campos, parecer.curto, incluirObservacoes);
    return doc;
  }

  const escuro = modelo === "modelo1";
  const tema = escuro ? TEMA_ESCURO : TEMA_CLARO;
  const [capa, pagina] = await Promise.all([
    imagem(`/cartas/${modelo}-capa.jpg`),
    imagem(`/cartas/${modelo}-pagina.jpg`),
  ]);

  doc.addImage(capa, "JPEG", 0, 0, W, H, "capa", "FAST");
  if (escuro) capaModelo1(doc, campos, parecer.curto, total);
  else capaModelo2(doc, campos, parecer.capa, total);

  doc.addPage();
  doc.addImage(pagina, "JPEG", 0, 0, W, H, "pagina", "FAST");
  paginaResumo(doc, tema, campos, parecer.curto);
  rodapeInstitucional(doc, tema, 2, total);

  if (!incluirObservacoes) return doc;

  doc.addPage();
  doc.addImage(pagina, "JPEG", 0, 0, W, H, "pagina", "FAST");
  paginaObservacoes(doc, tema, campos);
  rodapeInstitucional(doc, tema, 3, 3);

  return doc;
}

export function nomeArquivoCarta(campos: CamposCarta): string {
  const nome = (campos.proponente1Nome || "cliente")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `Carta-de-analise-${nome}-${campos.banco || "banco"}.pdf`;
}

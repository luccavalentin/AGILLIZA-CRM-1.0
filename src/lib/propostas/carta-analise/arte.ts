/**
 * Artes de fundo das cartas de análise, desenhadas em vetor.
 *
 * Antes eram JPEGs exportados dos modelos originais: 900x1273 px numa folha
 * A4 dão 109 DPI, e a carta saía com o fundo borrado ao lado do texto nítido —
 * pior ainda impressa, onde o padrão é 300 DPI. Vetor não tem resolução: fica
 * igual em qualquer zoom e na impressão, e ainda tira 95 KB de imagens do
 * pacote.
 *
 * Todas as medidas e TODAS as cores abaixo foram amostradas das artes
 * originais, pixel a pixel, para o desenho sair idêntico ao que já era usado.
 */
import type { jsPDF } from "jspdf";

export type RGB = [number, number, number];
type Parada = [number, RGB];

export const W = 210;
export const H = 297;

/** Vermelho da marca, como aparece nas artes. */
const VERMELHO: RGB = [240, 50, 67];
/** Vermelho do rodapé (a arte usa um tom levemente diferente do telhado). */
const VERMELHO_RODAPE: RGB = [242, 47, 61];
const BRANCO: RGB = [255, 255, 255];

/** Navy da pílula e das barras do modelo 2. */
const NAVY_PILULA: RGB = [10, 17, 158];
const NAVY_RODAPE: RGB = [7, 14, 156];

/** Modelo 1 (institucional escuro): fundo em degradê de cima para baixo. */
const GRAD_CAPA1: Parada[] = [
  [0, [13, 19, 141]],
  [0.084, [13, 15, 134]],
  [0.168, [11, 14, 127]],
  [0.249, [10, 14, 121]],
  [0.333, [11, 15, 114]],
  [0.418, [9, 14, 106]],
  [0.498, [8, 13, 104]],
  [0.582, [9, 11, 94]],
  [0.667, [8, 11, 92]],
  [0.747, [9, 9, 83]],
  [0.832, [8, 9, 76]],
  [0.916, [6, 8, 69]],
  [1, [5, 7, 62]],
];

/** Modelo 1, páginas internas. */
const GRAD_PAGINA1: Parada[] = [
  [0, [22, 27, 145]],
  [0.084, [23, 24, 140]],
  [0.168, [13, 14, 130]],
  [0.249, [12, 15, 122]],
  [0.333, [10, 14, 114]],
  [0.418, [8, 13, 105]],
  [0.498, [8, 12, 103]],
  [0.582, [6, 11, 93]],
  [0.663, [5, 11, 87]],
  [0.747, [9, 11, 85]],
  [0.832, [9, 16, 88]],
  [0.912, [13, 19, 95]],
  [1, [14, 20, 98]],
];

/** Modelo 2 (casa própria): fundo em degradê da esquerda para a direita. */
const GRAD_CAPA2: Parada[] = [
  [0, [5, 7, 90]],
  [0.081, [8, 10, 97]],
  [0.157, [5, 10, 101]],
  [0.233, [8, 12, 109]],
  [0.31, [8, 12, 111]],
  [0.386, [7, 10, 117]],
  [0.462, [8, 12, 120]],
  [0.538, [10, 13, 130]],
  [0.614, [10, 12, 131]],
  [0.69, [10, 16, 138]],
  [0.767, [10, 15, 143]],
  [0.843, [10, 14, 147]],
  [0.919, [11, 14, 153]],
  [1, [10, 17, 159]],
];

/** Modelo 2, faixa do topo das páginas internas. */
const GRAD_FAIXA2: Parada[] = [
  [0, [5, 10, 92]],
  [0.34, [8, 12, 109]],
  [0.5, [12, 13, 129]],
  [0.67, [9, 14, 134]],
  [0.84, [12, 15, 148]],
  [1, [10, 17, 159]],
];

function fill(doc: jsPDF, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function traco(doc: jsPDF, c: RGB) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

/** Interpola a paleta num ponto (0 a 1) do degradê. */
function corEm(paradas: Parada[], t: number): RGB {
  for (let i = 1; i < paradas.length; i++) {
    const [p1, c1] = paradas[i - 1];
    const [p2, c2] = paradas[i];
    if (t <= p2) {
      const k = p2 === p1 ? 0 : (t - p1) / (p2 - p1);
      return [
        c1[0] + (c2[0] - c1[0]) * k,
        c1[1] + (c2[1] - c1[1]) * k,
        c1[2] + (c2[2] - c1[2]) * k,
      ];
    }
  }
  return paradas[paradas.length - 1][1];
}

/**
 * Degradê em faixas finas: o jsPDF não tem degradê nativo. 240 faixas num A4
 * dão 1,2 mm cada — contínuo a olho nu e o arquivo continua leve. As faixas
 * se sobrepõem 0,2 mm para não abrir fresta clara entre elas.
 */
function gradiente(
  doc: jsPDF,
  paradas: Parada[],
  x: number,
  y: number,
  larg: number,
  alt: number,
  horizontal = false,
  passos = 300,
) {
  // Fundo da cor do meio: se sobrar um fio de meio pixel entre duas faixas, o
  // que aparece é uma cor quase igual à delas, e não o branco da página.
  fill(doc, corEm(paradas, 0.5));
  doc.rect(x, y, larg, alt, "F");
  // Faixas encostadas, sem sobreposição: sobrepor pinta a cor seguinte por
  // cima da anterior e deixa uma emenda visível em cada troca.
  const tamanho = (horizontal ? larg : alt) / passos;
  for (let i = 0; i < passos; i++) {
    fill(doc, corEm(paradas, i / (passos - 1)));
    if (horizontal) doc.rect(x + i * tamanho, y, tamanho, alt, "F");
    else doc.rect(x, y + i * tamanho, larg, tamanho, "F");
  }
}

/** Liga/desliga transparência. Preenchimento e traço pedem chaves diferentes. */
function opacidade(doc: jsPDF, valor: number) {
  const GState = (doc as any).GState;
  if (!GState) return;
  (doc as any).setGState(new GState({ opacity: valor, "stroke-opacity": valor }));
}

/**
 * Brilho radial atrás do símbolo, como na arte: um véu púrpura que vai
 * sumindo até 86 mm do centro. É feito com círculos translúcidos, de fora
 * para dentro — assim o degradê do fundo continua aparecendo por baixo, o que
 * um círculo opaco apagaria.
 *
 * `PERFIL` é a intensidade medida na arte original em cada distância.
 */
const BRILHO_COR: RGB = [255, 57, 45];
const BRILHO_MAX = 0.1626;
const BRILHO_PERFIL: Array<[number, number]> = [
  [86, 0],
  [78, 0.075],
  [70, 0.15],
  [62, 0.25],
  [54, 0.35],
  [46, 0.475],
  [38, 0.675],
  [33, 0.875],
  [0, 1],
];

function intensidadeBrilho(raio: number): number {
  const p = BRILHO_PERFIL;
  for (let i = 1; i < p.length; i++) {
    if (raio >= p[i][0]) {
      const k = (raio - p[i][0]) / (p[i - 1][0] - p[i][0]);
      return p[i][1] + (p[i - 1][1] - p[i][1]) * k;
    }
  }
  return 1;
}

function brilhoRadial(doc: jsPDF, cx: number, cy: number, raioMax: number, maximo: number) {
  fill(doc, BRILHO_COR);
  let acumulado = 0;
  // Passos de 2,6 mm: o degradê fica contínuo, sem os anéis que poucos
  // círculos deixariam à mostra.
  for (let raio = raioMax; raio > 1; raio -= 2.6) {
    const alvo = maximo * intensidadeBrilho((raio * BRILHO_PERFIL[0][0]) / raioMax);
    // Opacidade que este círculo precisa ter para o empilhamento chegar
    // exatamente na intensidade medida na arte.
    const alfa = (alvo - acumulado) / (1 - acumulado);
    if (alfa <= 0.0005) continue;
    opacidade(doc, alfa);
    doc.circle(cx, cy, raio, "F");
    acumulado = alvo;
  }
  opacidade(doc, 1);
}

/** Preenche um polígono fechado. */
function poligono(doc: jsPDF, pontos: Array<[number, number]>, cor: RGB) {
  fill(doc, cor);
  const deltas = pontos
    .slice(1)
    .map((p, i) => [p[0] - pontos[i][0], p[1] - pontos[i][1]] as [number, number]);
  doc.lines(deltas, pontos[0][0], pontos[0][1], [1, 1], "F", true);
}

/**
 * Telhado da marca: as duas rampas se encontram no ápice, no centro da página,
 * e descem até as bordas — 2,254 mm na horizontal para cada 1 mm na vertical,
 * a inclinação da arte original.
 */
const INCLINACAO = 2.254;
const QUEDA = W / 2 / INCLINACAO;

/** Preenche tudo o que fica abaixo das rampas. */
function telhadoCheio(doc: jsPDF, cor: RGB, apice: number) {
  poligono(
    doc,
    [
      [0, apice + QUEDA],
      [W / 2, apice],
      [W, apice + QUEDA],
      [W, H],
      [0, H],
    ],
    cor,
  );
}

/**
 * Risco vermelho acompanhando as rampas. É um traço, não uma área: entre ele
 * e o branco aparece o próprio fundo, como na arte.
 */
function telhadoRisco(doc: jsPDF, apice: number, espessura: number) {
  traco(doc, VERMELHO);
  doc.setLineWidth(espessura);
  doc.setLineJoin("miter");
  doc.lines(
    [
      [W / 2, -QUEDA],
      [W / 2, QUEDA],
    ],
    0,
    apice + QUEDA,
  );
}

/** Barras do rodapé: uma cor à esquerda, vermelho à direita. */
function rodape(doc: jsPDF, esquerda: RGB, divisao: number, vermelho: RGB, y = 294.8) {
  fill(doc, esquerda);
  doc.rect(0, y, divisao, H - y, "F");
  fill(doc, vermelho);
  doc.rect(divisao, y, W - divisao, H - y, "F");
}

/** Traço vermelho curto usado como marcador nas capas. */
function tracoVermelho(doc: jsPDF, y: number, x = 17.6, larg = 10.4) {
  fill(doc, VERMELHO);
  doc.rect(x, y, larg, 1.1, "F");
}

/** Linha fina que separa o conteúdo do rodapé. */
function linhaRodape(doc: jsPDF, y: number, cor: RGB) {
  traco(doc, cor);
  doc.setLineWidth(0.25);
  doc.line(17.6, y, W - 17.6, y);
}

/** Selo redondo vermelho com o certo branco, à esquerda da pílula. */
function selo(doc: jsPDF, cx: number, cy: number, r: number) {
  fill(doc, VERMELHO);
  doc.circle(cx, cy, r, "F");
  traco(doc, BRANCO);
  doc.setLineWidth(r * 0.28);
  doc.setLineCap("round");
  doc.setLineJoin("round");
  doc.lines(
    [
      [r * 0.42, r * 0.44],
      [r * 0.82, -r * 0.92],
    ],
    cx - r * 0.46,
    cy - r * 0.02,
  );
  doc.setLineCap("butt");
}

/**
 * Capa do modelo 1 (institucional escuro): fundo em degradê, anéis
 * concêntricos discretos, o símbolo da marca ao centro e a pílula do parecer.
 * Logo e símbolo entram como imagem porque são a marca — mas em alta
 * (2153x785 e 930x1785), não mais os 380 px da arte antiga.
 */
export function capaModelo1(doc: jsPDF, logo: string, simbolo: string) {
  gradiente(doc, GRAD_CAPA1, 0, 0, W, H);
  brilhoRadial(doc, 105, 118, 86, BRILHO_MAX);

  // Anéis: quase imperceptíveis na arte, dão profundidade ao fundo.
  traco(doc, BRANCO);
  doc.setLineWidth(0.18);
  opacidade(doc, 0.05);
  for (const r of [45.5, 63, 81.5, 102.5]) doc.circle(105, 118, r, "S");
  opacidade(doc, 1);

  const pontos: Array<[number, number, RGB]> = [
    [46.5, 41.3, VERMELHO],
    [130.4, 45.8, BRANCO],
    [59.6, 119.3, BRANCO],
    [152.5, 106.0, VERMELHO],
  ];
  for (const [x, y, c] of pontos) {
    fill(doc, c);
    doc.circle(x, y, 1.05, "F");
  }

  doc.addImage(logo, "PNG", 18, 13.5, 50.1, 18.3, "logo-claro", "SLOW");
  doc.addImage(simbolo, "PNG", 82.6, 62.8, 44.8, 86, "simbolo", "SLOW");

  tracoVermelho(doc, 172.2);

  // Pílula do parecer (o texto é escrito por cima, em pdf.ts).
  fill(doc, [243, 49, 64]);
  doc.roundedRect(35.7, 244, 138.6, 22.4, 11.2, 11.2, "F");

  linhaRodape(doc, 275.8, [36, 40, 88]);
  rodape(doc, BRANCO, 63, [236, 49, 68]);
}

/**
 * Páginas internas do modelo 1: fundo escuro com o brilho no canto superior
 * direito, o logo, o traço vermelho e o fio que fecha o cabeçalho.
 */
export function paginaModelo1(doc: jsPDF, logo: string) {
  gradiente(doc, GRAD_PAGINA1, 0, 0, W, H);
  brilhoRadial(doc, 212, 2, 100, 0.105);

  doc.addImage(logo, "PNG", 17.7, 11.7, 50.7, 18.5, "logo-claro", "SLOW");

  traco(doc, [41, 47, 157]);
  doc.setLineWidth(0.3);
  doc.line(17.6, 39.6, 192.4, 39.6);
  tracoVermelho(doc, 39.1, 18.6, 24.3);

  rodape(doc, BRANCO, 63, [238, 52, 69]);
}

/**
 * Capa do modelo 2 (casa própria): fundo navy, o telhado da marca com o risco
 * vermelho e a chaminé, e a pílula do parecer.
 */
export function capaModelo2(doc: jsPDF, logo: string) {
  gradiente(doc, GRAD_CAPA2, 0, 0, W, H, true);

  doc.addImage(logo, "PNG", 52, 45, 105.7, 38.5, "logo-claro", "SLOW");

  // Chaminé: some sob o telhado branco, que é desenhado depois.
  fill(doc, VERMELHO);
  doc.rect(139.3, 104.3, 12.8, 24, "F");

  telhadoRisco(doc, 107.65, 3.38);
  telhadoCheio(doc, BRANCO, 112.6);

  tracoVermelho(doc, 163.1);

  fill(doc, NAVY_PILULA);
  doc.roundedRect(17.7, 242.2, 174.3, 22.6, 2.6, 2.6, "F");
  selo(doc, 30.5, 253.5, 5.75);

  linhaRodape(doc, 275.9, [214, 216, 236]);
  rodape(doc, NAVY_RODAPE, 146.8, VERMELHO_RODAPE);
}

/**
 * Páginas internas do modelo 2: faixa navy no topo com o logo, o telhado
 * pequeno à direita, o fio vermelho e o corpo branco.
 */
export function paginaModelo2(doc: jsPDF, logo: string) {
  fill(doc, BRANCO);
  doc.rect(0, 0, W, H, "F");

  const alturaFaixa = 36.4;
  gradiente(doc, GRAD_FAIXA2, 0, 0, W, alturaFaixa, true, 160);

  // Telhado pequeno encostado na base da faixa, à direita.
  fill(doc, BRANCO);
  doc.triangle(185.2, alturaFaixa, 199.5, 27.6, W, alturaFaixa, "F");

  doc.addImage(logo, "PNG", 18, 8.6, 50.1, 18.3, "logo-claro", "SLOW");

  fill(doc, VERMELHO);
  doc.rect(0, alturaFaixa, W, 0.9, "F");

  rodape(doc, NAVY_RODAPE, 146.8, VERMELHO_RODAPE);
}

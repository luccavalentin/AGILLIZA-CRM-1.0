import type { EstadoTela, RoteiroTour } from "./tipos";

/*
 * Tour guiado: de qual tela é a página aberta, se o tour abre sozinho e onde fica a caixa.
 * Puro (testado em src/lib/tour/tour.test.ts). Mesmas regras do Agilliza Tech.
 */

/** Mesma forma que o banco aceita (`public.tour_progresso.tela`, migração 20261027130001). */
export const FORMA_CHAVE = /^[a-z0-9][a-z0-9._:-]{1,79}$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEGMENTO = /^[a-z][a-z0-9-]*$/;

/**
 * A chave da tela: o caminho sem a barra inicial, com `/` trocado por `.`.
 * `/operacional/propostas/kanban` → `operacional.propostas.kanban`;
 * `/cliente/visao-geral` → `cliente.visao-geral`. Busca (`?banco=itau`) não entra.
 * Caminho com id (ficha de um cliente, de uma proposta) não tem tour próprio: null.
 */
export function chaveDaTela(caminho: string): string | null {
  const limpo = (caminho.split(/[?#]/)[0] ?? "").replace(/\/+$/, "").replace(/^\/+/, "");
  if (!limpo) return null;
  const partes = limpo.split("/");
  if (partes.some((p) => !SEGMENTO.test(p) || UUID.test(p) || /\d{3,}/.test(p))) return null;
  const chave = partes.join(".");
  return FORMA_CHAVE.test(chave) ? chave : null;
}

/**
 * Seletores de reserva das âncoras estáveis, para as telas que não usam o componente
 * compartilhado que marca a âncora (cabeçalho próprio, tabela própria…). Sempre dentro do
 * conteúdo da página: nunca destaca algo do menu ou do topo por engano.
 */
const CONTEUDO = "#conteudo-principal";
export const RESERVA_ANCORA: Record<string, string> = {
  titulo: `${CONTEUDO} h1`,
  abas: `${CONTEUDO} [role="tablist"]`,
  busca: [
    `${CONTEUDO} input[type="search"]`,
    `${CONTEUDO} input[placeholder^="Buscar" i]`,
    `${CONTEUDO} input[placeholder^="Pesquisar" i]`,
    `${CONTEUDO} input[placeholder^="Procurar" i]`,
  ].join(", "),
  tabela: `${CONTEUDO} table`,
  // Indicador3D e HeroMetric (cartões de indicador do sistema 3D).
  metrica: `${CONTEUDO} .i3d-indicador, ${CONTEUDO} .i3d-grupo`,
  conteudo: CONTEUDO,
};

/**
 * Abre sozinho na primeira visita: a preferência está ligada e a pessoa nunca terminou nem
 * pulou ESTA versão do roteiro. Quem parou no meio vê de novo, do passo em que parou.
 */
export function deveAbrirSozinho(
  roteiro: Pick<RoteiroTour, "versao" | "passos">,
  estado: EstadoTela | undefined,
  automatico: boolean,
): boolean {
  if (!automatico || roteiro.passos.length === 0) return false;
  if (!estado) return true;
  if (estado.versao < roteiro.versao) return true;
  return estado.estado === "andamento" && estado.versao === roteiro.versao;
}

/** De onde o tour recomeça: do passo salvo (se for desta versão e ainda existir). */
export function passoInicial(roteiro: Pick<RoteiroTour, "versao" | "passos">, estado?: EstadoTela) {
  if (!estado || estado.versao !== roteiro.versao || estado.estado !== "andamento") return 0;
  return Math.min(Math.max(0, estado.passo), roteiro.passos.length - 1);
}

export type Retangulo = { top: number; left: number; width: number; height: number };
export type Posicao = { top: number; left: number; lado: "baixo" | "cima" | "centro" };

/**
 * Onde a caixa fica: embaixo do elemento se couber, senão em cima, senão no centro; nunca
 * sai da tela (margem de 12 px). Coordenadas da janela (position: fixed).
 */
export function posicionarCaixa(
  alvo: Retangulo | null,
  caixa: { width: number; height: number },
  janela: { width: number; height: number },
  margem = 12,
  folga = 12,
): Posicao {
  const centro = (): Posicao => ({
    top: Math.max(margem, (janela.height - caixa.height) / 2),
    left: Math.max(margem, (janela.width - caixa.width) / 2),
    lado: "centro",
  });
  if (!alvo) return centro();
  const left = Math.min(
    Math.max(margem, alvo.left + alvo.width / 2 - caixa.width / 2),
    Math.max(margem, janela.width - caixa.width - margem),
  );
  const abaixo = alvo.top + alvo.height + folga;
  if (abaixo + caixa.height + margem <= janela.height) return { top: abaixo, left, lado: "baixo" };
  const acima = alvo.top - folga - caixa.height;
  if (acima >= margem) return { top: acima, left, lado: "cima" };
  return centro();
}

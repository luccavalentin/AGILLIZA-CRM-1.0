/*
 * Tour guiado do Agilliza Correspondente (pedido do dono de 26/10/2026: "INCLUA TOUR EM TODO
 * O SISTEMA COM CAIXAS ENSINANDO AS FUNCIONALIDADES DE CADA TELA"). Mesmo formato do Agilliza
 * Tech (CORRETOR 2.0, apps/web/src/lib/tour/tipos.ts). Sem React: serve aos testes.
 */

/**
 * Âncoras ESTÁVEIS: marcadas pelos componentes compartilhados (ou achadas pelo motor por um
 * seletor de reserva, ver `RESERVA_ANCORA` em rota.ts). Valem em toda tela.
 *
 * - `titulo`: título da página (`PageHeader`/`AdminHero`; reserva: primeiro `h1` do conteúdo)
 * - `acoes`: botões do cabeçalho (`PageHeader`, `OpHero`, `PanelHeader`)
 * - `abas`: abas da tela (`TabsList`; reserva: `[role=tablist]` do conteúdo)
 * - `busca`: campo de busca do conteúdo (reserva: `type=search` ou placeholder "Buscar…")
 * - `filtro-base`: "Sua base / Assinantes / Vinculados" (`FiltroBase`)
 * - `metrica`: primeiro indicador (`Indicador3D`, `HeroMetric`)
 * - `tabela`: tabela principal (`Table`; reserva: primeira `<table>` do conteúdo)
 * - `conteudo`: a área de conteúdo da página
 * - `menu`, `busca-global`, `notificacoes`, `ajuda`: as peças do topo e do menu
 *
 * Específicas de tela: `data-tour="<tela>-<parte>"` (ex.: `propostas-kanban-colunas`).
 */
export type AncoraTour =
  | "titulo"
  | "acoes"
  | "abas"
  | "busca"
  | "filtro-base"
  | "metrica"
  | "tabela"
  | "conteudo"
  | "menu"
  | "busca-global"
  | "notificacoes"
  | "ajuda"
  | (string & {});

export type PassoTour = {
  /** `data-tour` do elemento destacado. Sem âncora (ou fora da tela): caixa no centro. */
  alvo?: AncoraTour;
  titulo: string;
  /** Uma ou duas frases curtas: o que é e para que serve. */
  texto: string;
};

export type RoteiroTour = {
  /** Subir a versão faz o tour abrir de novo para quem já viu (a tela mudou de verdade). */
  versao: number;
  /** Nome da tela como aparece no menu. */
  titulo: string;
  passos: PassoTour[];
};

/** Quem vê: a equipe (usuário do Supabase) ou o cliente final (portal com sessão própria). */
export type PublicoTour = "equipe" | "cliente";

export type EstadoTela = {
  versao: number;
  estado: "andamento" | "concluido" | "pulado";
  passo: number;
};
export type EstadoTour = { automatico: boolean; telas: Record<string, EstadoTela> };

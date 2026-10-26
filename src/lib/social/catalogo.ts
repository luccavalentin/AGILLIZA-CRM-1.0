// Cópia do catálogo das redes do Agilliza Tech (packages/integrations/src/social/catalogo.ts):
// mesmas regras para validar o post na tela do Agilliza. Ao mudar lá, mude aqui (o teste
// catalogo.test.ts confere os formatos de cada rede).
/**
 * Catálogo das redes sociais: seguro no navegador (sem segredo, sem rede). As regras
 * validam o post ANTES de agendar — erro na tela, e não às 3 da manhã na fila.
 *
 * Portado do Postei (posteiemtudo.com.br), que já publica com estas regras. Os
 * formatos usam os nomes do banco (`social.destinos.formato`).
 */

export type Rede =
  "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "google_business" | "teste";

/** Um conector é um login oficial (OAuth); pode trazer contas de mais de uma rede (Meta → Facebook + Instagram). */
export type Conector = "meta" | "linkedin" | "tiktok" | "youtube" | "google_business" | "teste";

export type Formato =
  | "feed"
  | "carrossel"
  | "reel"
  | "story"
  | "video"
  | "short"
  | "texto"
  | "atualizacao"
  | "foto"
  | "evento"
  | "oferta";

export type TipoMidia = "imagem" | "video";

export interface RegraFormato {
  id: Formato;
  rotulo: string;
  midia: { min: number; max: number; tipos: TipoMidia[] };
  /** Vídeo: duração máxima em segundos. */
  maxVideoSegundos?: number;
}

export interface RegraRede {
  id: Rede;
  rotulo: string;
  cor: string;
  conector: Conector;
  limiteLegenda: number;
  formatos: RegraFormato[];
}

export const REDES: Record<Rede, RegraRede> = {
  instagram: {
    id: "instagram",
    rotulo: "Instagram",
    cor: "#E1306C",
    conector: "meta",
    limiteLegenda: 2200,
    formatos: [
      { id: "feed", rotulo: "Feed", midia: { min: 1, max: 1, tipos: ["imagem"] } },
      {
        id: "carrossel",
        rotulo: "Carrossel",
        midia: { min: 2, max: 10, tipos: ["imagem", "video"] },
      },
      {
        id: "reel",
        rotulo: "Reels",
        midia: { min: 1, max: 1, tipos: ["video"] },
        maxVideoSegundos: 900,
      },
      {
        id: "story",
        rotulo: "Story",
        midia: { min: 1, max: 1, tipos: ["imagem", "video"] },
        maxVideoSegundos: 60,
      },
    ],
  },
  facebook: {
    id: "facebook",
    rotulo: "Facebook",
    cor: "#0866FF",
    conector: "meta",
    limiteLegenda: 63206,
    formatos: [
      { id: "feed", rotulo: "Post", midia: { min: 0, max: 10, tipos: ["imagem"] } },
      { id: "video", rotulo: "Vídeo", midia: { min: 1, max: 1, tipos: ["video"] } },
      // Reels de Página: 3 a 90 s, vertical 9:16.
      {
        id: "reel",
        rotulo: "Reels",
        midia: { min: 1, max: 1, tipos: ["video"] },
        maxVideoSegundos: 90,
      },
      // Stories de Página (Graph API: /{page}/photo_stories e /{page}/video_stories).
      {
        id: "story",
        rotulo: "Story",
        midia: { min: 1, max: 1, tipos: ["imagem", "video"] },
        maxVideoSegundos: 60,
      },
    ],
  },
  linkedin: {
    id: "linkedin",
    rotulo: "LinkedIn",
    cor: "#0A66C2",
    conector: "linkedin",
    limiteLegenda: 3000,
    formatos: [
      { id: "feed", rotulo: "Post", midia: { min: 0, max: 20, tipos: ["imagem"] } },
      {
        id: "video",
        rotulo: "Vídeo",
        midia: { min: 1, max: 1, tipos: ["video"] },
        maxVideoSegundos: 1800,
      },
    ],
  },
  tiktok: {
    id: "tiktok",
    rotulo: "TikTok",
    cor: "#111111",
    conector: "tiktok",
    limiteLegenda: 2200,
    formatos: [
      {
        id: "video",
        rotulo: "Vídeo",
        midia: { min: 1, max: 1, tipos: ["video"] },
        maxVideoSegundos: 600,
      },
      { id: "foto", rotulo: "Carrossel de fotos", midia: { min: 1, max: 35, tipos: ["imagem"] } },
    ],
  },
  youtube: {
    id: "youtube",
    rotulo: "YouTube",
    cor: "#FF0000",
    conector: "youtube",
    limiteLegenda: 5000,
    formatos: [
      { id: "video", rotulo: "Vídeo", midia: { min: 1, max: 1, tipos: ["video"] } },
      {
        id: "short",
        rotulo: "Shorts",
        midia: { min: 1, max: 1, tipos: ["video"] },
        maxVideoSegundos: 180,
      },
    ],
  },
  google_business: {
    id: "google_business",
    rotulo: "Google Meu Negócio",
    cor: "#34A853",
    conector: "google_business",
    limiteLegenda: 1500,
    formatos: [
      { id: "atualizacao", rotulo: "Novidade", midia: { min: 0, max: 1, tipos: ["imagem"] } },
      { id: "evento", rotulo: "Evento", midia: { min: 0, max: 1, tipos: ["imagem"] } },
      { id: "oferta", rotulo: "Oferta", midia: { min: 0, max: 1, tipos: ["imagem"] } },
    ],
  },
  teste: {
    id: "teste",
    rotulo: "Rede de teste",
    cor: "#7C3AED",
    conector: "teste",
    limiteLegenda: 5000,
    formatos: [
      { id: "feed", rotulo: "Post", midia: { min: 0, max: 10, tipos: ["imagem", "video"] } },
      { id: "video", rotulo: "Vídeo", midia: { min: 1, max: 1, tipos: ["video"] } },
    ],
  },
};

export const CONECTORES: { id: Conector; rotulo: string; descricao: string; redes: Rede[] }[] = [
  {
    id: "meta",
    rotulo: "Facebook + Instagram",
    descricao: "Páginas do Facebook e perfis profissionais do Instagram",
    redes: ["facebook", "instagram"],
  },
  {
    id: "linkedin",
    rotulo: "LinkedIn",
    descricao: "Perfil pessoal e páginas de empresa",
    redes: ["linkedin"],
  },
  { id: "tiktok", rotulo: "TikTok", descricao: "Contas do TikTok", redes: ["tiktok"] },
  { id: "youtube", rotulo: "YouTube", descricao: "Canais do YouTube", redes: ["youtube"] },
  {
    id: "google_business",
    rotulo: "Google Meu Negócio",
    descricao: "Perfis de empresa no Google",
    redes: ["google_business"],
  },
  {
    id: "teste",
    rotulo: "Rede de teste",
    descricao: "Simula publicações para testar o fluxo, sem publicar de verdade",
    redes: ["teste"],
  },
];

export function tipoDaMidia(mime: string): TipoMidia | null {
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  return null;
}

export interface MidiaParaValidar {
  mime: string;
  duracaoMs?: number | null;
}

/**
 * Opções por destino (`social.destinos.opcoes`), as mesmas chaves que os publicadores leem:
 *  - Instagram: `primeiroComentario`;
 *  - YouTube: `titulo` (até 100) e `privacidade` (public | unlisted | private);
 *  - TikTok (exigências da auditoria do TikTok): `privacidade` (uma das opções que o
 *    creator_info da conta devolve; sem valor padrão), `permitirComentario`,
 *    `permitirDueto`, `permitirCostura` (desligados por padrão), `divulgacaoComercial`,
 *    `suaMarca` e `conteudoDeMarca`;
 *  - Google Meu Negócio (evento e oferta): `titulo`, `inicio`, `fim` (AAAA-MM-DDTHH:mm),
 *    `cupom`, `urlResgate`, `termos`; novidade e evento: `tipoBotao` e `urlBotao`.
 */
export type OpcoesDestino = Record<string, unknown>;

export const PRIVACIDADES_YOUTUBE = [
  { id: "public", rotulo: "Público" },
  { id: "unlisted", rotulo: "Não listado" },
  { id: "private", rotulo: "Privado" },
] as const;

export const PRIVACIDADES_TIKTOK: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Todo mundo",
  MUTUAL_FOLLOW_FRIENDS: "Amigos (seguidores mútuos)",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Só eu",
};

export const BOTOES_GOOGLE = [
  { id: "LEARN_MORE", rotulo: "Saiba mais" },
  { id: "BOOK", rotulo: "Reservar" },
  { id: "ORDER", rotulo: "Pedir" },
  { id: "SHOP", rotulo: "Comprar" },
  { id: "SIGN_UP", rotulo: "Inscrever-se" },
  { id: "CALL", rotulo: "Ligar" },
] as const;

/** Problemas das opções do destino (as que dependem da rede e do formato). */
export function validarOpcoes(rede: Rede, formato: string, opcoes: OpcoesDestino = {}): string[] {
  const erros: string[] = [];
  const regra = REDES[rede];
  const f = regra?.formatos.find((x) => x.id === formato);
  const onde = `${regra?.rotulo ?? rede} · ${f?.rotulo ?? formato}`;
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (rede === "tiktok") {
    if (!texto(opcoes.privacidade)) erros.push(`${onde}: escolha quem pode ver o post.`);
    if (opcoes.divulgacaoComercial === true && !opcoes.suaMarca && !opcoes.conteudoDeMarca)
      erros.push(`${onde}: diga se o conteúdo promove a sua marca ou a de um terceiro.`);
    if (opcoes.conteudoDeMarca === true && opcoes.privacidade === "SELF_ONLY")
      erros.push(`${onde}: conteúdo de marca não pode ser visto só por você.`);
  }
  if (rede === "youtube" && texto(opcoes.titulo).length > 100)
    erros.push(`${onde}: o título passa de 100 caracteres.`);
  if (rede === "instagram" && texto(opcoes.primeiroComentario).length > 2200)
    erros.push(`${onde}: o primeiro comentário passa de 2200 caracteres.`);
  if (rede === "google_business" && (formato === "evento" || formato === "oferta")) {
    const ini = Date.parse(texto(opcoes.inicio));
    const fim = Date.parse(texto(opcoes.fim));
    if (Number.isNaN(ini) || Number.isNaN(fim)) erros.push(`${onde}: informe o início e o fim.`);
    else if (fim <= ini) erros.push(`${onde}: o fim precisa ser depois do início.`);
    if (formato === "evento" && texto(opcoes.titulo).length > 58)
      erros.push(`${onde}: o título passa de 58 caracteres.`);
  }
  if (
    rede === "google_business" &&
    texto(opcoes.urlBotao) &&
    !/^https?:\/\//.test(texto(opcoes.urlBotao))
  )
    erros.push(`${onde}: o link do botão precisa começar com https://.`);
  return erros;
}

/** Problemas do destino (lista vazia = pode agendar). */
export function validarDestino(
  rede: Rede,
  formato: string,
  legenda: string,
  midias: MidiaParaValidar[],
  opcoes?: OpcoesDestino,
): string[] {
  const regra = REDES[rede];
  const f = regra.formatos.find((x) => x.id === formato);
  if (!f) return [`O formato "${formato}" não existe no ${regra.rotulo}.`];
  const erros: string[] = [];
  const onde = `${regra.rotulo} · ${f.rotulo}`;
  if (legenda.length > regra.limiteLegenda)
    erros.push(`${onde}: a legenda passa de ${regra.limiteLegenda} caracteres.`);
  if (midias.length < f.midia.min)
    erros.push(
      `${onde}: precisa de ${f.midia.min === 1 ? "1 foto ou vídeo" : `pelo menos ${f.midia.min} fotos ou vídeos`}.`,
    );
  if (midias.length > f.midia.max) erros.push(`${onde}: aceita no máximo ${f.midia.max}.`);
  for (const m of midias) {
    const tipo = tipoDaMidia(m.mime);
    if (!tipo || !f.midia.tipos.includes(tipo)) {
      erros.push(
        `${onde}: não aceita ${tipo === "video" ? "vídeo" : tipo === "imagem" ? "foto" : "este arquivo"}.`,
      );
      break;
    }
    if (
      tipo === "video" &&
      f.maxVideoSegundos &&
      m.duracaoMs &&
      m.duracaoMs / 1000 > f.maxVideoSegundos
    )
      erros.push(`${onde}: o vídeo passa de ${f.maxVideoSegundos} segundos.`);
  }
  if (
    ["linkedin", "facebook", "google_business"].includes(rede) &&
    !legenda.trim() &&
    midias.length === 0
  )
    erros.push(`${onde}: escreva um texto ou adicione uma foto.`);
  if (opcoes !== undefined) erros.push(...validarOpcoes(rede, formato, opcoes));
  return erros;
}

/** Formato padrão de cada rede para o que foi anexado (o compositor sugere, a pessoa pode trocar). */
export function formatoSugerido(rede: Rede, midias: MidiaParaValidar[]): Formato {
  const videos = midias.filter((m) => tipoDaMidia(m.mime) === "video").length;
  const fotos = midias.length - videos;
  switch (rede) {
    case "instagram":
      if (midias.length >= 2) return "carrossel";
      return videos === 1 ? "reel" : "feed";
    case "facebook":
      return videos === 1 && fotos === 0 ? "video" : "feed";
    case "linkedin":
      return videos === 1 && fotos === 0 ? "video" : "feed";
    case "tiktok":
      return videos ? "video" : "foto";
    case "youtube":
      return "video";
    case "google_business":
      return "atualizacao";
    default:
      return videos === 1 && fotos === 0 ? "video" : "feed";
  }
}

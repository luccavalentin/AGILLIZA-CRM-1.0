// Cópia do catálogo das redes do Agilliza Tech (packages/integrations/src/social/catalogo.ts):
// mesmas regras para validar o post na tela do Agilliza. Ao mudar lá, mude aqui.
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
  "feed" | "carrossel" | "reel" | "story" | "video" | "short" | "texto" | "atualizacao" | "foto";

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

/** Problemas do destino (lista vazia = pode agendar). */
export function validarDestino(
  rede: Rede,
  formato: string,
  legenda: string,
  midias: MidiaParaValidar[],
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

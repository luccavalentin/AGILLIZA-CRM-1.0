/**
 * Formatos e utilidades puras do chat universal (sem React, testáveis). Pasta portável.
 */
import type { GrupoContato } from "./tipos";

const zerar = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function diasAtras(iso: string, agora = new Date()): number {
  return Math.round((zerar(agora) - zerar(new Date(iso))) / 86_400_000);
}

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Separador de dia: Hoje, Ontem, dia da semana (até 6 dias) ou a data. */
export function rotuloDia(iso: string, agora = new Date()): string {
  const n = diasAtras(iso, agora);
  if (n === 0) return "Hoje";
  if (n === 1) return "Ontem";
  const d = new Date(iso);
  if (n < 7) {
    const s = d.toLocaleDateString("pt-BR", { weekday: "long" });
    return s[0]!.toUpperCase() + s.slice(1);
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Hora na lista: 14:32, Ontem, ter, 12/10/26. */
export function quandoLista(iso: string, agora = new Date()): string {
  const n = diasAtras(iso, agora);
  if (n === 0) return hora(iso);
  if (n === 1) return "Ontem";
  if (n < 7)
    return new Date(iso).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/** "online" / "visto por último hoje às 14:32" (nulo quando a pessoa oculta). */
export function presenca(
  online: boolean,
  vistoEm: string | null,
  agora = new Date(),
): string | null {
  if (online) return "online";
  if (!vistoEm) return null;
  const n = diasAtras(vistoEm, agora);
  if (n === 0) return `visto por último hoje às ${hora(vistoEm)}`;
  if (n === 1) return `visto por último ontem às ${hora(vistoEm)}`;
  return `visto por último em ${new Date(vistoEm).toLocaleDateString("pt-BR")}`;
}

export function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Sem acento e sem caixa: "matricula" acha "Matrícula". */
export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Iniciais para o avatar (só letras: "Grupo (Alfa)" → "GA"). */
export function iniciais(nome: string): string {
  return (
    nome
      .replace(/[^\p{L}\s]/gu, " ")
      .split(/\s+/)
      .filter((p) => p.length > 1)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/** Resumo de uma mensagem para a lista, a citação e as fixadas. */
export function resumoMensagem(m: {
  tipo: string;
  corpo: string | null;
  apagada?: boolean;
  anexos?: { nome: string; mime?: string }[];
}): string {
  if (m.apagada) return "Mensagem apagada";
  const corpo = (m.corpo ?? "").trim();
  switch (m.tipo) {
    case "imagem":
      return corpo ? `Foto: ${corpo}` : "Foto";
    case "audio":
      return "Mensagem de voz";
    case "arquivo":
      if (m.anexos?.[0]?.mime?.startsWith("video/")) return corpo ? `Vídeo: ${corpo}` : "Vídeo";
      return corpo || m.anexos?.[0]?.nome || "Documento";
    default:
      return corpo;
  }
}

/** Rótulo do tipo da mensagem no aviso flutuante (sem o conteúdo). */
export function rotuloTipo(tipo: string): string {
  switch (tipo) {
    case "imagem":
      return "Foto";
    case "audio":
      return "Mensagem de voz";
    case "arquivo":
      return "Arquivo";
    default:
      return "Mensagem";
  }
}

/** Título de cada seção de contatos. */
export const TITULO_GRUPO: Record<GrupoContato, string> = {
  equipe: "Equipe",
  clientes: "Clientes, inquilinos e proprietários",
  correspondente: "Correspondente Agilliza",
  parceiros: "Parceiros e vinculados",
  clientes_agilliza: "Clientes do correspondente",
  sua_base: "Sua base",
  assinantes: "Assinantes",
  imobnet: "Contatos da ImobNet",
};

export const ORDEM_GRUPO: GrupoContato[] = [
  "equipe",
  "clientes",
  "correspondente",
  "parceiros",
  "clientes_agilliza",
  "sua_base",
  "assinantes",
  "imobnet",
];

/** Formato do @ (o banco confere de novo). */
export function arrobaValido(a: string): boolean {
  const v = a.trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9][a-z0-9._]{2,29}$/.test(v) && !v.includes("..") && !v.endsWith(".");
}

export const limparArroba = (a: string) => a.trim().replace(/^@+/, "").toLowerCase();

/**
 * Quebra um texto em pedaços de texto e de link (http/https e www.). O link só vira
 * âncora com protocolo http(s): nada de `javascript:` ou `data:` vindo do texto.
 */
export function partesComLinks(texto: string): { texto: string; url?: string }[] {
  const re = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}])/gi;
  const partes: { texto: string; url?: string }[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > ultimo) partes.push({ texto: texto.slice(ultimo, i) });
    const bruto = m[1]!;
    const url = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
    partes.push({ texto: bruto, url });
    ultimo = i + bruto.length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo) });
  return partes;
}

/** O primeiro link do texto (para a prévia). */
export function primeiroLink(texto: string | null | undefined): string | null {
  if (!texto) return null;
  return partesComLinks(texto).find((p) => p.url)?.url ?? null;
}

/**
 * Forma de onda "desenhada" para o tocador: alturas estáveis a partir do id (o mesmo áudio
 * tem sempre o mesmo desenho), entre 0,25 e 1.
 */
export function barrasDaOnda(semente: string, n = 32): number[] {
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const barras: number[] = [];
  for (let i = 0; i < n; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const v = ((h >>> 0) % 1000) / 1000;
    // Suaviza para lembrar fala (picos no meio, bordas mais baixas).
    const envelope = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / n);
    barras.push(Math.max(0.25, Math.min(1, 0.25 + v * 0.75 * envelope)));
  }
  return barras;
}

/** Texto do agrupamento do aviso flutuante: "3 novas mensagens de 2 conversas". */
export function resumoAvisos(totalMensagens: number, conversas: number): string {
  const m = totalMensagens === 1 ? "1 nova mensagem" : `${totalMensagens} novas mensagens`;
  if (conversas <= 1) return m;
  return `${m} de ${conversas} conversas`;
}

/** Reações rápidas, como no WhatsApp; o "+" abre o seletor inteiro. */
export const REACOES_RAPIDAS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export const EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😊",
  "🙂",
  "😉",
  "😍",
  "🥰",
  "😘",
  "😎",
  "🤩",
  "🤔",
  "🤨",
  "😐",
  "😅",
  "😂",
  "🤣",
  "😇",
  "🙃",
  "😌",
  "😴",
  "😬",
  "🙄",
  "😮",
  "😯",
  "😲",
  "😢",
  "😭",
  "😤",
  "😡",
  "🥳",
  "👍",
  "👎",
  "👏",
  "🙌",
  "🙏",
  "🤝",
  "👌",
  "✌️",
  "🤞",
  "💪",
  "👋",
  "👉",
  "👀",
  "💡",
  "🔥",
  "✨",
  "❤️",
  "💙",
  "💚",
  "💛",
  "🧡",
  "💜",
  "✅",
  "❌",
  "⚠️",
  "❗",
  "❓",
  "⏰",
  "📅",
  "📌",
  "📎",
  "📄",
  "📝",
  "📊",
  "📈",
  "💰",
  "💵",
  "🏠",
  "🏢",
  "🏡",
  "🔑",
  "🚗",
  "📞",
  "✉️",
  "📷",
  "🎉",
  "🍀",
  "☕",
];

/** Reduz a foto no aparelho antes de subir (1920 px, JPEG 82%). */
export async function reduzirImagem(
  arquivo: File,
  { ladoMaximo = 1920, qualidade = 0.82 }: { ladoMaximo?: number; qualidade?: number } = {},
): Promise<File> {
  if (!arquivo.type.startsWith("image/") || arquivo.type === "image/heic") return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && arquivo.size < 1_200_000) return arquivo;
    const tela = document.createElement("canvas");
    tela.width = Math.round(bitmap.width * escala);
    tela.height = Math.round(bitmap.height * escala);
    const ctx = tela.getContext("2d");
    if (!ctx) return arquivo;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.drawImage(bitmap, 0, 0, tela.width, tela.height);
    const blob = await new Promise<Blob | null>((r) => tela.toBlob(r, "image/jpeg", qualidade));
    if (!blob || blob.size >= arquivo.size) return arquivo;
    return new File([blob], arquivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return arquivo;
  }
}

/** Chave de idempotência do envio (o mesmo clique repetido não duplica a mensagem). */
export function novaChave(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Reserva para navegador antigo: UUID v4 com Math.random (só idempotência, não segredo).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Bipe curto do aviso (Web Audio, sem arquivo). Falha em silêncio sem gesto do usuário. */
export function tocarBipe(): void {
  try {
    const Ctx =
      (
        window as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        }
      ).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.09);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.3);
    o.onended = () => void ctx.close();
  } catch {
    /* sem áudio: tudo bem */
  }
}

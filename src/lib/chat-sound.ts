// Som característico de chat — usado em TODOS os portais/acessos do sistema.
// Preferência do usuário salva em localStorage (funciona em qualquer portal,
// inclusive no App do Cliente que não usa Supabase Auth).

const STORAGE_KEY = "agilliza:chat-som-ativo";
const SOUND_KEY = "agilliza:chat-som-tipo";

/** Indica se o som de chat está ativo (padrão: ativo). */
export function isChatSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Ativa/desativa o som de chat. */
export function setChatSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gainPeak: number,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Identificadores dos sons disponíveis. */
export type ChatSoundId =
  | "pop"
  | "duo"
  | "sino"
  | "gota"
  | "marimba"
  | "tri"
  | "suave";

export interface ChatSoundOption {
  id: ChatSoundId;
  nome: string;
  descricao: string;
}

/** Catálogo de sons que o usuário pode escolher. */
export const CHAT_SOUND_OPTIONS: ChatSoundOption[] = [
  { id: "duo", nome: "Duo (padrão)", descricao: "Dois tons ascendentes rápidos." },
  { id: "pop", nome: "Pop", descricao: "Um toque curto e discreto." },
  { id: "sino", nome: "Sino", descricao: "Toque cristalino, como um sininho." },
  { id: "gota", nome: "Gota", descricao: "Descida suave, tipo bolha d'água." },
  { id: "marimba", nome: "Marimba", descricao: "Três notas alegres em sequência." },
  { id: "tri", nome: "Tri-tom", descricao: "Acorde ascendente marcante." },
  { id: "suave", nome: "Suave", descricao: "Tom grave e delicado." },
];

const DEFAULT_SOUND: ChatSoundId = "duo";

/** Retorna o som escolhido pelo usuário (padrão: "duo"). */
export function getChatSoundId(): ChatSoundId {
  if (typeof window === "undefined") return DEFAULT_SOUND;
  try {
    const v = window.localStorage.getItem(SOUND_KEY);
    if (v && CHAT_SOUND_OPTIONS.some((o) => o.id === v)) return v as ChatSoundId;
  } catch {
    /* ignore */
  }
  return DEFAULT_SOUND;
}

/** Define o som escolhido pelo usuário. */
export function setChatSoundId(id: ChatSoundId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_KEY, id);
  } catch {
    /* ignore */
  }
}

function renderSound(ctx: AudioContext, id: ChatSoundId): void {
  const now = ctx.currentTime;
  switch (id) {
    case "pop":
      tone(ctx, 880, now, 0.14, 0.16);
      break;
    case "sino":
      tone(ctx, 1318.51, now, 0.5, 0.12, "triangle"); // Mi6
      tone(ctx, 1975.53, now + 0.02, 0.4, 0.08, "triangle"); // Si6
      break;
    case "gota":
      tone(ctx, 1046.5, now, 0.12, 0.14);
      tone(ctx, 523.25, now + 0.08, 0.24, 0.15);
      break;
    case "marimba":
      tone(ctx, 659.25, now, 0.12, 0.14, "triangle"); // Mi5
      tone(ctx, 783.99, now + 0.1, 0.12, 0.14, "triangle"); // Sol5
      tone(ctx, 1046.5, now + 0.2, 0.2, 0.15, "triangle"); // Dó6
      break;
    case "tri":
      tone(ctx, 523.25, now, 0.14, 0.13); // Dó5
      tone(ctx, 659.25, now + 0.1, 0.14, 0.14); // Mi5
      tone(ctx, 783.99, now + 0.2, 0.22, 0.16); // Sol5
      break;
    case "suave":
      tone(ctx, 392.0, now, 0.24, 0.12, "sine"); // Sol4
      tone(ctx, 523.25, now + 0.12, 0.28, 0.11, "sine"); // Dó5
      break;
    case "duo":
    default:
      tone(ctx, 587.33, now, 0.14, 0.14); // Ré5
      tone(ctx, 880.0, now + 0.1, 0.2, 0.16); // Lá5
      break;
  }
}

/**
 * Toca o som de chat escolhido pelo usuário. Respeita a preferência de ativação.
 */
export function playChatSound(): void {
  if (!isChatSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  renderSound(ctx, getChatSoundId());
}

/** Toca uma prévia do som (para os botões de teste nas configurações). */
export function previewChatSound(id?: ChatSoundId): void {
  const ctx = getCtx();
  if (!ctx) return;
  renderSound(ctx, id ?? getChatSoundId());
}

/** Som neutro de notificação (um toque curto), independente da pref de chat. */
export function playNotificationSound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 660, now, 0.12, 0.12);
  tone(ctx, 990, now + 0.09, 0.16, 0.13);
}

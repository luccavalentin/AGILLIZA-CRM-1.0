// Som característico de chat — usado em TODOS os portais/acessos do sistema.
// Preferência do usuário salva em localStorage (funciona em qualquer portal,
// inclusive no App do Cliente que não usa Supabase Auth).

const STORAGE_KEY = "agilliza:chat-som-ativo";

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
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/**
 * Toca o som característico de chat (um "pop" de dois tons ascendentes,
 * distinto de qualquer outro som do sistema). Respeita a preferência do usuário.
 */
export function playChatSound(): void {
  if (!isChatSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Dois tons ascendentes rápidos — assinatura sonora do chat.
  tone(ctx, 587.33, now, 0.14, 0.14); // Ré5
  tone(ctx, 880.0, now + 0.1, 0.2, 0.16); // Lá5
}

/** Toca uma prévia do som (para o botão de teste nas configurações). */
export function previewChatSound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 587.33, now, 0.14, 0.14);
  tone(ctx, 880.0, now + 0.1, 0.2, 0.16);
}

/** Som neutro de notificação (um toque curto), independente da pref de chat. */
export function playNotificationSound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 660, now, 0.12, 0.12);
  tone(ctx, 990, now + 0.09, 0.16, 0.13);
}

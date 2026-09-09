/**
 * Notificações do sistema operacional (o "popup" que app nativo mostra).
 *
 * Usa a Notifications API do navegador através do service worker do app.
 * O sino (`notifications-bell`) já escuta a tabela `notificacoes` em tempo
 * real; aqui só transformamos esse evento em uma notificação de sistema.
 *
 * Limites reais, para não prometer o que o navegador não entrega:
 *  - Android/Chrome/Edge/Windows: funciona com o app aberto ou em segundo
 *    plano (o processo do PWA precisa estar vivo).
 *  - iPhone/iPad: só existe quando o app foi instalado na Tela de Início
 *    (iOS 16.4+). No Safari em aba, a API nem sequer é exposta.
 *  - App totalmente fechado: exige Web Push com servidor VAPID, que ainda
 *    não existe no projeto. O `push` já está tratado em `public/sw.js`.
 */
import { registroSwApp } from "./registrar-sw";

const CHAVE_PREF = "agilliza:notif-sistema";
const ICONE = "/icons/app/icon-192.png";

export type EstadoPermissao = NotificationPermission | "indisponivel";

/** O navegador expõe a Notifications API neste contexto? */
export function suporteNotificacoes(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function ehIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadOs;
}

function ehStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Explicação em linguagem de usuário para quando não dá para ativar. */
export function motivoSemSuporte(): string | null {
  if (suporteNotificacoes()) return null;
  if (ehIos() && !ehStandalone()) {
    return "No iPhone e no iPad, as notificações só funcionam com o app instalado na Tela de Início. Toque em Compartilhar → Adicionar à Tela de Início e abra o app por lá.";
  }
  return "Este navegador não permite notificações do sistema.";
}

export function permissaoNotificacoes(): EstadoPermissao {
  if (!suporteNotificacoes()) return "indisponivel";
  return Notification.permission;
}

/** Pede a permissão ao navegador. Precisa ser chamada dentro de um clique. */
export async function pedirPermissaoNotificacoes(): Promise<EstadoPermissao> {
  if (!suporteNotificacoes()) return "indisponivel";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Preferência local: o usuário quer receber popup do sistema neste aparelho? */
export function notificacoesSistemaLigadas(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CHAVE_PREF) === "1";
  } catch {
    return false;
  }
}

export function setNotificacoesSistemaLigadas(valor: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_PREF, valor ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export interface NotificacaoSistema {
  titulo: string;
  corpo?: string | null;
  /** Rota interna aberta ao tocar na notificação. */
  link?: string | null;
  /** Agrupa notificações do mesmo assunto em vez de empilhar várias. */
  tag?: string;
}

/**
 * Mostra a notificação. Devolve `false` quando não foi possível (sem
 * permissão, sem suporte ou desligada nas preferências) — nunca lança.
 */
export async function mostrarNotificacaoSistema(n: NotificacaoSistema): Promise<boolean> {
  if (!suporteNotificacoes()) return false;
  if (!notificacoesSistemaLigadas()) return false;
  if (Notification.permission !== "granted") return false;

  const opcoes: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: n.corpo ?? undefined,
    icon: ICONE,
    badge: ICONE,
    tag: n.tag,
    renotify: Boolean(n.tag),
    data: { link: n.link || "/" },
    vibrate: [80, 40, 80],
  };

  const reg = await registroSwApp();
  if (reg) {
    try {
      await reg.showNotification(n.titulo, opcoes);
      return true;
    } catch {
      /* cai no fallback abaixo */
    }
  }

  // Fallback para desktop sem SW ativo. No Android isto lança de propósito
  // (a plataforma exige service worker), por isso o try/catch.
  try {
    new Notification(n.titulo, opcoes);
    return true;
  } catch {
    return false;
  }
}

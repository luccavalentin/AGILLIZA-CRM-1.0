import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Transições de página do módulo CRM.
 *
 * Estratégia:
 * - CSS-first (keyframes definidos em `src/styles.css`), sem JS por frame.
 * - Anima apenas `transform` + `opacity` para acionar composição em GPU.
 * - Respeita `prefers-reduced-motion` (global em styles.css) e o toggle
 *   local `data-crm-motion="off"` (persistido em localStorage).
 * - `key` derivada do pathname garante remount + replay da animação a cada
 *   navegação, sem depender de bibliotecas externas (framer-motion etc.).
 *
 * Uso:
 *   <CrmPageTransition variant="fade-up"><Outlet /></CrmPageTransition>
 *
 * Variants suportadas: fade | fade-up | slide-right | slide-left |
 * slide-up | slide-down | zoom-in | zoom-out | flip-x | flip-y | parallax
 */

export type CrmTransitionVariant =
  | "fade"
  | "fade-up"
  | "slide-right"
  | "slide-left"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out"
  | "flip-x"
  | "flip-y"
  | "parallax";

export interface CrmPageTransitionProps {
  children: ReactNode;
  /** Efeito aplicado a cada troca de rota dentro do CRM. */
  variant?: CrmTransitionVariant;
  /** Duração em ms. Default 320ms — leve, não atrapalha fluxo. */
  durationMs?: number;
  /** Curva de aceleração CSS. Default suave com ligeira antecipação. */
  easing?: string;
  /** Opacidade inicial (para variants baseadas em fade). Default 0. */
  fromOpacity?: number;
  /** Direção — só faz sentido em `slide-*` e `parallax`. */
  direction?: "right" | "left" | "up" | "down";
}

const STORAGE_KEY = "crm:motion-enabled";

/** Hook para o toggle de acessibilidade (ligar/desligar transições). */
export function useCrmMotionEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) !== "off";
  });
  useEffect(() => {
    document.documentElement.dataset.crmMotion = enabled ? "on" : "off";
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  }, [enabled]);
  return [enabled, setEnabled];
}

export function CrmPageTransition({
  children,
  variant = "fade-up",
  durationMs = 320,
  easing = "cubic-bezier(0.22, 1, 0.36, 1)",
  fromOpacity = 0,
  direction,
}: CrmPageTransitionProps) {
  // Key por pathname → remonta o wrapper e replaya a animação a cada rota.
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Aplica a `direction` como sufixo semântico às variantes de slide.
  const resolvedVariant = useMemo<CrmTransitionVariant>(() => {
    if (!direction) return variant;
    if (variant === "slide-right" || variant === "slide-left" ||
        variant === "slide-up" || variant === "slide-down") {
      return (`slide-${direction}` as CrmTransitionVariant);
    }
    return variant;
  }, [variant, direction]);

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      key={pathname}
      ref={containerRef}
      data-crm-transition={resolvedVariant}
      className="crm-page-transition"
      style={{
        // Variáveis CSS lidas pelo utility `.crm-page-transition`.
        ["--crm-tr-duration" as never]: `${durationMs}ms`,
        ["--crm-tr-easing" as never]: easing,
        ["--crm-tr-from-opacity" as never]: String(fromOpacity),
      }}
    >
      {children}
    </div>
  );
}

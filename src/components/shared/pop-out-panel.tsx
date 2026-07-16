import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatFlash, stopFlash } from "@/components/shared/chat-alert-store";


interface PopOutPanelProps {
  /** Título exibido na barra da janela flutuante. */
  title: string;
  children: ReactNode;
  /** Classe aplicada ao contêiner acoplado (inline). */
  className?: string;
  /** Rótulo acessível do botão de soltar. */
  detachLabel?: string;
}

/**
 * Envolve um conteúdo permitindo "soltar" em uma janela flutuante
 * arrastável e redimensionável (pop-out). Ao reacoplar, volta ao fluxo.
 */
export function PopOutPanel({
  title,
  children,
  className,
  detachLabel = "Soltar em janela flutuante",
}: PopOutPanelProps) {
  const [detached, setDetached] = useState(false);

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setDetached((v) => !v)}
          title={detached ? "Reacoplar" : detachLabel}
          aria-label={detached ? "Reacoplar" : detachLabel}
          className="absolute right-2 top-2 z-20 flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
        >
          {detached ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
        {detached ? (
          <div className="flex h-[32rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Maximize2 className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Aberto em janela flutuante</p>
              <p className="text-xs text-muted-foreground">
                Arraste a janela pela barra de título ou redimensione pelo canto.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDetached(false)}
              className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              Reacoplar janela
            </button>
          </div>
        ) : (
          children
        )}
      </div>
      {detached && (
        <FloatingWindow title={title} onClose={() => setDetached(false)}>
          {children}
        </FloatingWindow>
      )}
    </>
  );
}

export function FloatingWindow({
  title,
  onClose,
  children,
  startMinimized = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  startMinimized?: boolean;
}) {
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1024,
    h: typeof window !== "undefined" ? window.innerHeight : 768,
  }));
  const isMobile = viewport.w < 640;
  const WIDTH = isMobile ? Math.max(280, viewport.w - 24) : 420;

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - WIDTH - 8)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - 56)),
    }),
    [WIDTH],
  );

  const [pos, setPos] = useState(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;
    const w = vw < 640 ? Math.max(280, vw - 24) : 420;
    // Quando inicia minimizado, ancora no canto superior direito para não
    // atrapalhar a tela atual do usuário.
    if (startMinimized) {
      return { x: Math.max(12, vw - w - 16), y: 72 };
    }
    return {
      x: Math.max(12, Math.round((vw - w) / 2)),
      y: Math.max(64, Math.round(vh * 0.1)),
    };
  });
  const [minimized, setMinimized] = useState(startMinimized);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragRef.current) return;
      setPos(clamp(e.clientX - dragRef.current.dx, e.clientY - dragRef.current.dy));
    },
    [clamp],
  );

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
  }, [onPointerMove]);

  useEffect(() => stopDrag, [stopDrag]);

  // Mantém a janela dentro da viewport ao redimensionar / girar o dispositivo.
  useEffect(() => {
    function onResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      setPos((p) => clamp(p.x, p.y));
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [clamp]);

  function startDrag(e: React.PointerEvent) {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // No mobile aberto, ocupa a tela como um bottom-sheet fixo (sem arrastar).
  const mobileExpanded = isMobile && !minimized;

  const style: React.CSSProperties = mobileExpanded
    ? {
        left: 12,
        right: 12,
        bottom: 12,
        top: 64,
        width: "auto",
      }
    : {
        left: pos.x,
        top: pos.y,
        width: WIDTH,
        ...(minimized ? {} : { height: "min(85dvh, 44rem)" }),
      };

  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      aria-modal={mobileExpanded}
      style={style}
      className={cn(
        "fixed z-[60] flex max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/95 transition-shadow",
        !isMobile && "min-w-[18rem]",
        minimized
          ? "h-auto border-primary/60 ring-2 ring-primary/40 shadow-[0_12px_40px_-12px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
          : "border-primary/40 ring-1 ring-primary/20",
        !minimized && (mobileExpanded ? "" : "min-h-[20rem] resize"),
      )}
    >
      <div
        onPointerDown={mobileExpanded ? undefined : startDrag}
        onDoubleClick={() => setMinimized((v) => !v)}
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-b border-primary/30 bg-gradient-to-r from-primary to-primary/80 px-3.5 py-2.5 text-primary-foreground select-none",
          mobileExpanded ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {!mobileExpanded && (
            <span className="hidden gap-1 sm:flex" aria-hidden>
              <span className="size-2.5 rounded-full bg-destructive/80" />
              <span className="size-2.5 rounded-full bg-amber-400/90" />
              <span className="size-2.5 rounded-full bg-emerald-400/90" />
            </span>
          )}
          <p className="truncate text-xs font-semibold text-primary-foreground">{title}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            title={minimized ? "Expandir" : "Minimizar"}
            aria-label={minimized ? "Expandir" : "Minimizar"}
            className="flex size-7 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
          >
            {minimized ? <Maximize2 className="size-3.5" /> : <Minus className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Reacoplar"
            aria-label="Reacoplar"
            className="flex size-7 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-destructive/80 hover:text-destructive-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      {!minimized && (
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      )}
    </div>,
    document.body,
  );
}



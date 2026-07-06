import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

function FloatingWindow({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [pos, setPos] = useState(() => ({
    x: Math.max(16, (typeof window !== "undefined" ? window.innerWidth : 1024) - 460),
    y: 88,
  }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    const width = 440;
    const x = Math.min(
      Math.max(8, e.clientX - dragRef.current.dx),
      window.innerWidth - Math.min(width, 160),
    );
    const y = Math.min(Math.max(8, e.clientY - dragRef.current.dy), window.innerHeight - 80);
    setPos({ x, y });
  }, []);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
  }, [onPointerMove]);

  useEffect(() => stopDrag, [stopDrag]);

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

  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[60] flex max-h-[85vh] min-h-[20rem] w-[92vw] min-w-[18rem] max-w-[32rem] resize flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
    >
      <div
        onPointerDown={startDrag}
        className="flex shrink-0 cursor-grab items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2 active:cursor-grabbing select-none"
      >
        <p className="truncate text-xs font-semibold text-foreground">{title}</p>
        <button
          type="button"
          onClick={onClose}
          title="Reacoplar"
          aria-label="Reacoplar"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>,
    document.body,
  );
}

import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: ReactNode;
  className?: string;
}

const LIMITE = 80; // px para acionar exclusão

/**
 * Envolve um item permitindo arrastá-lo para a esquerda para excluir.
 * Funciona com toque (mobile) e mouse/trackpad (desktop).
 */
export function SwipeToDelete({ onDelete, children, className }: SwipeToDeleteProps) {
  const [offset, setOffset] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const inicio = useRef<number | null>(null);
  const arrastando = useRef(false);

  function iniciar(x: number) {
    inicio.current = x;
    arrastando.current = true;
  }

  function mover(x: number) {
    if (!arrastando.current || inicio.current === null) return;
    const delta = x - inicio.current;
    // só permite arrastar para a esquerda
    setOffset(Math.min(0, delta));
  }

  function finalizar() {
    if (!arrastando.current) return;
    arrastando.current = false;
    inicio.current = null;
    if (Math.abs(offset) >= LIMITE) {
      setSaindo(true);
      setOffset(-400);
      setTimeout(onDelete, 180);
    } else {
      setOffset(0);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-destructive px-5 text-destructive-foreground">
        <Trash2 className="h-5 w-5" />
      </div>
      <div
        className={cn("relative bg-popover", className)}
        style={{
          transform: `translateX(${offset}px)`,
          transition: arrastando.current ? "none" : "transform 0.18s ease-out",
          opacity: saindo ? 0 : 1,
        }}
        onTouchStart={(e) => iniciar(e.touches[0].clientX)}
        onTouchMove={(e) => mover(e.touches[0].clientX)}
        onTouchEnd={finalizar}
        onMouseDown={(e) => iniciar(e.clientX)}
        onMouseMove={(e) => arrastando.current && mover(e.clientX)}
        onMouseUp={finalizar}
        onMouseLeave={finalizar}
      >
        {children}
      </div>
    </div>
  );
}

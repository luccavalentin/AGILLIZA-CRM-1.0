import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CircleHelp, PlayCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { chaveDaTela } from "@/lib/tour/rota";
import { roteiroDe } from "@/lib/tour/roteiros";
import { API_TOUR } from "@/lib/tour/tour.functions";
import type { PublicoTour } from "@/lib/tour/tipos";
import { abrirTourDaTela, definirAutomatico, useEstadoTour } from "./estado";
import "./tour.css";

/**
 * Botão de ajuda do topo: "Ver tour desta tela", ligar ou desligar a abertura automática
 * nas telas novas e "Ver todos os tours de novo". Na barra da equipe e na do cliente.
 */
export function BotaoAjudaTour({ publico = "equipe" }: { publico?: PublicoTour }) {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const roteiro = roteiroDe(chaveDaTela(caminho));
  const { automatico } = useEstadoTour();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const api = API_TOUR[publico];

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div className="relative" ref={raiz}>
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        data-tour="ajuda"
        aria-label="Ajuda e tour da tela"
        aria-haspopup="menu"
        aria-expanded={aberto}
        title="Ajuda e tour da tela"
        className={cn(
          "tour-botao-ajuda inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          aberto && "bg-accent text-primary",
        )}
      >
        <CircleHelp className="h-5 w-5" />
      </button>
      {aberto && (
        <div className="tour-menu" role="menu" aria-label="Ajuda">
          <p className="tour-menu-titulo">Tour guiado</p>
          <button
            type="button"
            role="menuitem"
            className="tour-menu-item"
            disabled={!roteiro}
            onClick={() => {
              setAberto(false);
              abrirTourDaTela();
            }}
          >
            <PlayCircle aria-hidden />
            <span>
              <b>Ver tour desta tela</b>
              <small>{roteiro ? roteiro.titulo : "Esta tela ainda não tem tour"}</small>
            </span>
          </button>
          <label className="tour-menu-item tour-menu-chave">
            <input
              type="checkbox"
              checked={automatico}
              onChange={async (e) => {
                const ligado = e.target.checked;
                definirAutomatico(ligado);
                const ok = await api.automatico(ligado);
                if (!ok) {
                  definirAutomatico(!ligado);
                  toast.error("Não foi possível salvar a preferência do tour.");
                }
              }}
            />
            <span>
              <b>Abrir sozinho em telas novas</b>
              <small>Na primeira visita de cada tela</small>
            </span>
          </label>
          <button
            type="button"
            role="menuitem"
            className="tour-menu-item"
            onClick={async () => {
              setAberto(false);
              const ok = await api.reiniciar();
              if (ok)
                toast.success("Pronto: os tours abrem de novo na primeira visita de cada tela.");
              else toast.error("Não foi possível reiniciar os tours.");
            }}
          >
            <RotateCcw aria-hidden />
            <span>
              <b>Ver todos os tours de novo</b>
              <small>Recomeça em todas as telas</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

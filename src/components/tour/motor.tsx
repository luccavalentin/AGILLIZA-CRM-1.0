import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Compass, X } from "lucide-react";
import { Icone3D } from "@/components/ui/icone-3d";
import { cn } from "@/lib/utils";
import {
  RESERVA_ANCORA,
  chaveDaTela,
  deveAbrirSozinho,
  passoInicial,
  posicionarCaixa,
  type Posicao,
  type Retangulo,
} from "@/lib/tour/rota";
import { roteiroDe } from "@/lib/tour/roteiros";
import { API_TOUR } from "@/lib/tour/tour.functions";
import type { PublicoTour, RoteiroTour } from "@/lib/tour/tipos";
import { EVENTO_ABRIR_TOUR, definirAutomatico } from "./estado";
import "./tour.css";

/*
 * Motor do tour guiado do Agilliza (porte do Agilliza Tech, 26/10/2026). Sem biblioteca:
 * caixas ancoradas em elementos com `data-tour="..."`, passo a passo com Avançar / Voltar /
 * Pular, o elemento destacado (o resto da tela escurece), teclado (← → Esc), foco preso na
 * caixa. No celular a caixa vira folha inferior e o elemento sobe para o alto da tela.
 *
 * Abre sozinho na primeira visita de cada tela (o banco diz se a pessoa já viu esta versão
 * do roteiro) e a qualquer momento pelo botão de ajuda ("Ver tour desta tela"). Passo cuja
 * âncora não está na tela (ou está escondida) aparece no centro: nunca quebra.
 *
 * Montado uma vez em cada moldura (AppShell da equipe, ClienteShell do cliente). Roteiros em
 * src/lib/tour/roteiros.ts.
 */

const CELULAR = 640;
const ESPERA_ABRIR_MS = 900;

function visivel(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  if (r.right <= 0 || r.left >= window.innerWidth) return false;
  const s = getComputedStyle(el);
  if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
  if (el.closest("[aria-hidden='true'], [inert]")) return false;
  return true;
}

/**
 * O primeiro elemento VISÍVEL com a âncora; para as estáveis, se nenhum componente marcou,
 * o seletor de reserva (primeiro `h1` do conteúdo, primeira tabela…).
 */
export function acharAlvo(ancora: string | undefined): HTMLElement | null {
  if (!ancora) return null;
  const marcados = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(ancora)}"]`);
  for (const el of marcados) if (visivel(el)) return el;
  const reserva = RESERVA_ANCORA[ancora];
  if (!reserva) return null;
  for (const el of document.querySelectorAll<HTMLElement>(reserva)) if (visivel(el)) return el;
  return null;
}

/** Outra janela aberta por cima (diálogo, folha): o tour não disputa a atenção da pessoa. */
function haJanelaAberta(): boolean {
  return !!document.querySelector(
    "[aria-modal='true'], [role='dialog'][data-state='open'], [role='alertdialog'][data-state='open']",
  );
}

export function TourGuiado({ publico = "equipe" }: { publico?: PublicoTour }) {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const chave = chaveDaTela(caminho);
  const roteiro = roteiroDe(chave);
  const [aberto, setAberto] = useState<{ passo: number; chave: string } | null>(null);

  // Primeira visita: pergunta ao banco e abre sozinho (depois que a tela assentou).
  useEffect(() => {
    setAberto(null);
    if (!chave || !roteiro) return;
    let vivo = true;
    const t = setTimeout(async () => {
      const e = await API_TOUR[publico].estado([chave]);
      if (!vivo || !e) return;
      definirAutomatico(e.automatico);
      const salvo = e.telas[chave];
      if (haJanelaAberta()) return;
      if (deveAbrirSozinho(roteiro, salvo, e.automatico))
        setAberto({ passo: passoInicial(roteiro, salvo), chave });
    }, ESPERA_ABRIR_MS);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [chave, roteiro, publico]);

  // Botão de ajuda: "Ver tour desta tela".
  useEffect(() => {
    const abrir = () => {
      if (chave && roteiro) setAberto({ passo: 0, chave });
    };
    window.addEventListener(EVENTO_ABRIR_TOUR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_TOUR, abrir);
  }, [chave, roteiro]);

  if (!aberto || !roteiro || aberto.chave !== chave) return null;
  return (
    <CaixaTour
      key={`${chave}-${aberto.passo}-inicio`}
      chave={chave}
      roteiro={roteiro}
      publico={publico}
      inicio={aberto.passo}
      aoFechar={() => setAberto(null)}
    />
  );
}

function CaixaTour({
  chave,
  roteiro,
  publico,
  inicio,
  aoFechar,
}: {
  chave: string;
  roteiro: RoteiroTour;
  publico: PublicoTour;
  inicio: number;
  aoFechar: () => void;
}) {
  const id = useId();
  const total = roteiro.passos.length;
  const [i, setI] = useState(Math.min(inicio, total - 1));
  const [alvo, setAlvo] = useState<Retangulo | null>(null);
  const [pos, setPos] = useState<Posicao | null>(null);
  const [celular, setCelular] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const elemento = useRef<HTMLElement | null>(null);
  const passo = roteiro.passos[i]!;
  const ultimo = i === total - 1;

  const gravar = useCallback(
    (estado: "andamento" | "concluido" | "pulado", n: number) =>
      void API_TOUR[publico].registrar(chave, roteiro.versao, estado, n),
    [chave, roteiro.versao, publico],
  );

  // Mede o alvo e posiciona a caixa (de novo a cada rolagem e mudança de tamanho).
  const medir = useCallback(() => {
    const el = elemento.current;
    const cel = window.innerWidth < CELULAR;
    setCelular(cel);
    const r = el?.isConnected ? el.getBoundingClientRect() : null;
    const ret =
      r && r.width > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
    setAlvo(ret);
    const c = caixa.current?.getBoundingClientRect();
    if (!cel && c)
      setPos(
        posicionarCaixa(
          ret,
          { width: c.width, height: c.height },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
  }, []);

  // Troca de passo: acha o elemento, traz para a vista e mede.
  useLayoutEffect(() => {
    const el = acharAlvo(passo.alvo);
    elemento.current = el;
    if (el) {
      const r = el.getBoundingClientRect();
      const cel = window.innerWidth < CELULAR;
      const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      // No celular a folha cobre a metade de baixo: o elemento sobe para o alto da tela.
      const fora = cel
        ? r.top < 64 || r.bottom > window.innerHeight * 0.5
        : r.top < 72 || r.bottom > window.innerHeight - 24;
      const alto = r.height > window.innerHeight * 0.6;
      if (fora && !alto && !el.closest(".app-sidebar, header.sticky")) {
        el.scrollIntoView({
          block: cel ? "start" : "center",
          behavior: reduzir ? "auto" : "smooth",
        });
        if (cel) window.scrollBy({ top: -88, behavior: "auto" });
      }
    }
    medir();
    const t = setTimeout(medir, 380);
    return () => clearTimeout(t);
  }, [i, passo.alvo, medir]);

  useEffect(() => {
    let quadro = 0;
    const agendar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(medir);
    };
    window.addEventListener("resize", agendar);
    window.addEventListener("scroll", agendar, true);
    // A tela ainda pode mudar de altura (lista chegando, gráficos): mede de novo de tempos
    // em tempos enquanto o tour está aberto, para o destaque não ficar fora do lugar.
    const relogio = setInterval(agendar, 450);
    return () => {
      clearInterval(relogio);
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", agendar);
      window.removeEventListener("scroll", agendar, true);
    };
  }, [medir]);

  useEffect(() => {
    principal.current?.focus({ preventScroll: true });
    if (i > 0 || inicio > 0) gravar("andamento", i);
  }, [i, inicio, gravar]);

  // Foco devolvido para onde estava quando o tour fecha.
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    return () => {
      if (antes?.isConnected) antes.focus({ preventScroll: true });
    };
  }, []);

  const pular = useCallback(() => {
    gravar(ultimo ? "concluido" : "pulado", i);
    aoFechar();
  }, [gravar, ultimo, i, aoFechar]);
  const avancar = useCallback(() => {
    if (ultimo) {
      gravar("concluido", i);
      aoFechar();
    } else setI((x) => Math.min(x + 1, total - 1));
  }, [ultimo, gravar, i, aoFechar, total]);
  const voltar = useCallback(() => setI((x) => Math.max(0, x - 1)), []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        pular();
      } else if (e.key === "ArrowRight") avancar();
      else if (e.key === "ArrowLeft") voltar();
      else if (e.key === "Tab" && caixa.current) {
        // Foco preso na caixa enquanto o tour está aberto.
        const focaveis = caixa.current.querySelectorAll<HTMLElement>("button");
        const primeiro = focaveis[0];
        const fim = focaveis[focaveis.length - 1];
        if (!caixa.current.contains(document.activeElement)) {
          e.preventDefault();
          primeiro?.focus();
        } else if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          fim?.focus();
        } else if (!e.shiftKey && document.activeElement === fim) {
          e.preventDefault();
          primeiro?.focus();
        }
      }
    };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [pular, avancar, voltar]);

  const folga = 6;
  return createPortal(
    <div className="tour-camada" data-celular={celular || undefined}>
      {/* Clique fora não faz nada (o tour não some por engano); Pular ou Esc fecham. */}
      <div className="tour-bloqueio" aria-hidden />
      {alvo ? (
        <div
          className="tour-destaque"
          aria-hidden
          style={{
            top: alvo.top - folga,
            left: alvo.left - folga,
            width: alvo.width + folga * 2,
            height: alvo.height + folga * 2,
          }}
        />
      ) : (
        <div className="tour-veu" aria-hidden />
      )}
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        data-tour-caixa=""
        className={cn("tour-caixa", celular ? "folha" : (pos?.lado ?? "centro"))}
        style={
          celular || !pos || pos.lado === "centro" ? undefined : { top: pos.top, left: pos.left }
        }
      >
        <div className="tour-cabeca">
          <span className="tour-marca">
            <Icone3D icone={Compass} tom="marca" tamanho="sm" />
            <span className="tour-progresso" aria-live="polite">
              {roteiro.titulo} · {i + 1} de {total}
            </span>
          </span>
          <button type="button" className="tour-fechar" onClick={pular} aria-label="Fechar o tour">
            <X aria-hidden />
          </button>
        </div>
        <h2 id={`${id}-t`} className="tour-titulo">
          {passo.titulo}
        </h2>
        <p id={`${id}-d`} className="tour-texto">
          {passo.texto}
        </p>
        <div className="tour-pontos" aria-hidden>
          {roteiro.passos.map((_, k) => (
            <i key={k} className={cn(k === i && "ativo", k < i && "visto")} />
          ))}
        </div>
        <div className="tour-botoes">
          {!ultimo && (
            <button type="button" className="tour-pular" onClick={pular}>
              Pular
            </button>
          )}
          <span className="flex-1" />
          {i > 0 && (
            <button type="button" className="tour-voltar" onClick={voltar}>
              <ArrowLeft aria-hidden /> Voltar
            </button>
          )}
          <button ref={principal} type="button" className="tour-avancar" onClick={avancar}>
            {ultimo ? (
              <>
                Concluir <Check aria-hidden />
              </>
            ) : (
              <>
                Avançar <ArrowRight aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

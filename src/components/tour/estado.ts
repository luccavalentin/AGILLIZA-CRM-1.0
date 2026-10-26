import { useSyncExternalStore } from "react";

/*
 * Estado do tour no navegador, dividido entre o motor (que lê o banco) e o botão de ajuda
 * (que liga/desliga a abertura automática e pede o tour da tela). Só o que a tela precisa
 * na hora; a verdade fica no banco (migração 20261027130001).
 */

type Estado = { automatico: boolean };
let estado: Estado = { automatico: true };
const ouvintes = new Set<() => void>();

export function definirAutomatico(automatico: boolean) {
  if (estado.automatico === automatico) return;
  estado = { automatico };
  ouvintes.forEach((o) => o());
}

export function useEstadoTour(): Estado {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
    () => estado,
  );
}

/** Pede o tour da tela aberta (o botão de ajuda chama; o motor escuta). */
export const EVENTO_ABRIR_TOUR = "ag:tour-abrir";
export function abrirTourDaTela() {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_TOUR));
}

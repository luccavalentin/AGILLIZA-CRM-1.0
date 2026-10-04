/**
 * O aviso de novidade do selo da documentação, do lado da tela.
 *
 * Quem decide se há novidade é o servidor (`naoLido` em `documentacao-status`,
 * comparando a última decisão da HomeFin com `proposta_comentarios_vistos`).
 * Aqui mora só o "acabei de abrir": a janela de comentários avisa, o selo para
 * de piscar na hora e a gravação segue para o banco em segundo plano, sem
 * esperar a lista recarregar.
 *
 * A marca local vale até a próxima leitura do servidor chegar com `naoLido`
 * falso. Se a gravação falhar, o selo volta a piscar no próximo carregamento —
 * que é o certo: ninguém registrou a leitura.
 */
import { useEffect, useState } from "react";

/** Propostas abertas nesta sessão, para o selo parar de piscar na hora. */
const lidasAgora = new Set<string>();
const avisos = new EventTarget();
const EVENTO = "mudou";

/**
 * Marca a proposta como lida nesta sessão. A gravação no banco é do chamador
 * (`marcarComentariosVistos` em `propostas.functions`).
 */
export function marcarLidaLocalmente(propostaId: string): void {
  lidasAgora.add(propostaId);
  avisos.dispatchEvent(new Event(EVENTO));
}

/**
 * O selo desta proposta deve piscar?
 *
 * `naoLido` vem do servidor; a marca local tem prioridade porque é mais nova
 * que qualquer resposta já carregada na tela.
 */
export function useAvisoDeNovidade(propostaId: string, naoLido: boolean | undefined): boolean {
  const [lidaAgora, setLidaAgora] = useState(false);

  useEffect(() => {
    const conferir = () => setLidaAgora(lidasAgora.has(propostaId));
    conferir();
    avisos.addEventListener(EVENTO, conferir);
    return () => avisos.removeEventListener(EVENTO, conferir);
  }, [propostaId]);

  return Boolean(naoLido) && !lidaAgora;
}

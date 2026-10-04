/**
 * Até quando a pessoa já leu os comentários de cada proposta.
 *
 * O selo da documentação pisca enquanto houver retorno da HomeFin — decisão de
 * documento ou comentário do banco — mais novo que a última vez que ela abriu
 * a janela de comentários daquela proposta. Abriu, parou de piscar.
 *
 * Fica no navegador, não no banco: é leitura de cada um, muda a cada clique e
 * não vale nada para mais ninguém. Gravar isso em `propostas` custaria uma
 * escrita (e um realtime para todas as telas inscritas) por abertura de
 * janela. O preço é que trocar de navegador faz o selo piscar de novo, o que
 * no pior caso chama atenção para algo que a pessoa já leu.
 */
import { useEffect, useState } from "react";

const PREFIXO = "agilliza:comentarios-vistos:";

/** Avisa os selos abertos na tela que uma proposta acabou de ser lida. */
const avisos = new EventTarget();
const EVENTO = "mudou";

function chave(propostaId: string): string {
  return `${PREFIXO}${propostaId}`;
}

/** Quando a pessoa abriu os comentários desta proposta pela última vez. */
export function lerComentariosVistos(propostaId: string): string | null {
  try {
    return window.localStorage.getItem(chave(propostaId));
  } catch {
    // Navegador sem armazenamento (ou modo privado): sem marca de leitura, o
    // selo pisca. Chamar atenção à toa é melhor que esconder uma recusa.
    return null;
  }
}

/** Registra que os comentários desta proposta acabaram de ser abertos. */
export function marcarComentariosVistos(propostaId: string): void {
  try {
    window.localStorage.setItem(chave(propostaId), new Date().toISOString());
  } catch {
    /* sem armazenamento não há o que marcar */
  }
  avisos.dispatchEvent(new Event(EVENTO));
}

/**
 * Há retorno da HomeFin que esta pessoa ainda não leu?
 *
 * Começa em `false` e só decide depois de montar: o servidor não tem acesso ao
 * armazenamento do navegador, e responder lá geraria um selo diferente do que
 * a tela mostraria em seguida.
 */
export function useComentariosNaoLidos(
  propostaId: string,
  novidadeEm: string | null | undefined,
): boolean {
  const [naoLidos, setNaoLidos] = useState(false);

  useEffect(() => {
    if (!novidadeEm) {
      setNaoLidos(false);
      return;
    }
    const conferir = () => {
      const visto = lerComentariosVistos(propostaId);
      setNaoLidos(!visto || new Date(novidadeEm) > new Date(visto));
    };
    conferir();
    avisos.addEventListener(EVENTO, conferir);
    // Outra aba lendo a mesma proposta também apaga o aviso aqui.
    window.addEventListener("storage", conferir);
    return () => {
      avisos.removeEventListener(EVENTO, conferir);
      window.removeEventListener("storage", conferir);
    };
  }, [propostaId, novidadeEm]);

  return naoLidos;
}

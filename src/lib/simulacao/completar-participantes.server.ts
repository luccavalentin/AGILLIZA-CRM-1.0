import { chamarIntegracao } from "./homefin.server";
import {
  papelDoParticipante,
  payloadCompletarParticipante,
  repetirEmFalhaDoServidor,
} from "./completar-participantes";

/**
 * Antes de criar as simulações, completa na HomeFin o titular e o cônjuge da
 * oportunidade com o cadastro do cliente (e os padrões onde ele está vazio).
 * Ver `completar-participantes.ts` para o porquê.
 *
 * O `POST /oportunidade` não aceita esses campos nem devolve os participantes,
 * então o caminho é `GET` (para achar os ids) e `PUT`. Os dois são seguros de
 * repetir, e a HomeFin anda devolvendo 500 intermitente: na SIM-009199
 * (19/10 09:43) o único `GET` falhou e a cliente seguiu para o banco
 * incompleta. Agora cada passo tenta de novo antes de desistir.
 *
 * Só faz `PUT` em quem tem campo vazio — depois do primeiro envio, os reenvios
 * gastam apenas o `GET`. Se mesmo assim não completar, o envio segue: o
 * próximo envio tenta de novo.
 */
export async function completarParticipantesOportunidade(
  idOportunidade: string,
  sim: any,
  simulacaoId: string,
): Promise<void> {
  const ctx = { simulacao_id: simulacaoId };
  let participantes: any[];
  try {
    const resp = await repetirEmFalhaDoServidor(() =>
      chamarIntegracao<any>(`/oportunidade/${idOportunidade}`, "GET", undefined, ctx),
    );
    participantes = resp?.oportunidade?.participantes ?? resp?.participantes ?? [];
  } catch (e) {
    console.error(
      `[SIM-PARTICIPANTES] oportunidade=${idOportunidade} falha ao ler participantes:`,
      e,
    );
    return;
  }

  for (const part of participantes) {
    if (!part?.idParticipante || String(part?.tipoSituacao ?? "A") === "I") continue;
    const papel = papelDoParticipante(part, sim);
    if (!papel) continue;
    const payload = payloadCompletarParticipante(part, papel, sim, sim?.cliente);
    if (!payload) continue;
    try {
      await repetirEmFalhaDoServidor(() =>
        chamarIntegracao<any>(
          `/oportunidade/${idOportunidade}/participante/${part.idParticipante}`,
          "PUT",
          payload,
          ctx,
        ),
      );
      console.info(
        `[SIM-PARTICIPANTES] oportunidade=${idOportunidade} ${papel} ${part.idParticipante} completado`,
      );
    } catch (e) {
      console.error(
        `[SIM-PARTICIPANTES] oportunidade=${idOportunidade} falha ao completar ${papel} ${part.idParticipante}:`,
        e,
      );
    }
  }
}

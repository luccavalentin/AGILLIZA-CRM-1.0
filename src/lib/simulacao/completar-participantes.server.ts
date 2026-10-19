import { chamarIntegracao } from "./homefin.server";
import { papelDoParticipante, payloadCompletarParticipante } from "./completar-participantes";

/**
 * Antes de criar as simulações, completa na HomeFin o titular e o cônjuge da
 * oportunidade com o cadastro do cliente (e os padrões onde ele está vazio).
 * Ver `completar-participantes.ts` para o porquê.
 *
 * Só faz `PUT` em quem tem campo vazio — depois do primeiro envio, os reenvios
 * gastam apenas o `GET`. Falha aqui não derruba o envio: o banco decide.
 */
export async function completarParticipantesOportunidade(
  idOportunidade: string,
  sim: any,
  simulacaoId: string,
): Promise<void> {
  try {
    const resp = await chamarIntegracao<any>(`/oportunidade/${idOportunidade}`, "GET", undefined, {
      simulacao_id: simulacaoId,
    });
    const participantes: any[] = resp?.oportunidade?.participantes ?? resp?.participantes ?? [];

    for (const part of participantes) {
      if (!part?.idParticipante || String(part?.tipoSituacao ?? "A") === "I") continue;
      const papel = papelDoParticipante(part, sim);
      if (!papel) continue;
      const payload = payloadCompletarParticipante(part, papel, sim, sim?.cliente);
      if (!payload) continue;
      try {
        await chamarIntegracao<any>(
          `/oportunidade/${idOportunidade}/participante/${part.idParticipante}`,
          "PUT",
          payload,
          { simulacao_id: simulacaoId },
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
  } catch (e) {
    console.error(`[SIM-PARTICIPANTES] oportunidade=${idOportunidade} falha ao ler participantes:`, e);
  }
}

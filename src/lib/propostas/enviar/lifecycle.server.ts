/**
 * Ciclo de vida da oportunidade no provedor bancário: follow-ups e
 * cancelamento. Extraído de `enviar.server.ts` sem alteração de comportamento.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { chamarIntegracao } from "@/lib/simulacao/homefin.server";

export async function enviarFollowupHomefinImpl({
  propostaId,
  titulo,
  comentario,
  supabase,
}: {
  propostaId: string;
  titulo: string;
  comentario: string;
  supabase: SupabaseClient<any, any, any>;
}): Promise<void> {
  const { data: prop } = await supabase
    .from("propostas")
    .select("homefin_id_oportunidade, simulacao_id, correspondente_id")
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.homefin_id_oportunidade) return;
  await chamarIntegracao<any>(
    `/oportunidade/${prop.homefin_id_oportunidade}/follow-up`,
    "POST",
    { idOportunidade: prop.homefin_id_oportunidade, tipoFup: "E", titulo, comentario },
    {
      simulacao_id: prop.simulacao_id,
      proposta_id: propostaId,
      correspondente_id: prop.correspondente_id,
    },
  );
}

export async function cancelarPropostaHomefinImpl({
  propostaId,
  supabase,
}: {
  propostaId: string;
  supabase: SupabaseClient<any, any, any>;
}): Promise<void> {
  const { data: prop } = await supabase
    .from("propostas")
    .select("homefin_id_oportunidade, simulacao_id, correspondente_id")
    .eq("id", propostaId)
    .maybeSingle();

  if (!prop?.homefin_id_oportunidade) return;

  try {
    await chamarIntegracao<any>(
      `/oportunidade/${prop.homefin_id_oportunidade}`,
      "PUT",
      { tipoSituacao: "C" },
      {
        simulacao_id: prop.simulacao_id,
        proposta_id: propostaId,
        correspondente_id: prop.correspondente_id,
      },
    );

    // Registra sucesso no histórico
    await supabase.from("proposta_historico").insert({
      proposta_id: propostaId,
      tipo_evento: "cancelada",
      descricao: "Cancelamento confirmado no banco parceiro (HomeFin).",
      status_novo: "cancelada",
    });

    // Limpa flag de pendência se existir
    await supabase
      .from("propostas")
      .update({ cancelamento_pendente_banco: false } as any)
      .eq("id", propostaId);
  } catch (error: any) {
    // Registra falha e marca como pendente
    const msg = error?.message || "Erro desconhecido na integração";
    
    await Promise.all([
      supabase.from("proposta_logs_homefin").insert({
        proposta_id: propostaId,
        endpoint: `/oportunidade/${prop.homefin_id_oportunidade}`,
        metodo: "PUT",
        payload: { tipoSituacao: "C" },
        resposta: { error: msg },
        sucesso: false,
        correspondente_id: prop.correspondente_id,
      }),
      supabase.from("proposta_historico").insert({
        proposta_id: propostaId,
        tipo_evento: "erro",
        descricao: `Falha ao cancelar no banco: ${msg}. O cancelamento será reprocessado automaticamente.`,
        status_novo: "cancelada",
      }),
      supabase
        .from("propostas")
        .update({ cancelamento_pendente_banco: true } as any)
        .eq("id", propostaId),
    ]);

    throw error; // Repropaga para que o retry ou background context saiba que falhou
  }
}

/**
 * Versão genérica para cancelar oportunidade via Simulação ou Proposta (incluindo excluídas).
 */
export async function cancelarOportunidadeHomefinGenerico({
  idOportunidade,
  simulacaoId,
  propostaId,
  correspondenteId,
  supabase,
}: {
  idOportunidade: string;
  simulacaoId?: string | null;
  propostaId?: string | null;
  correspondenteId?: string | null;
  supabase: SupabaseClient<any, any, any>;
}): Promise<void> {
  try {
    await chamarIntegracao<any>(
      `/oportunidade/${idOportunidade}`,
      "PUT",
      { tipoSituacao: "C" },
      {
        simulacao_id: simulacaoId || undefined,
        proposta_id: propostaId || undefined,
        correspondente_id: correspondenteId || undefined,
      },
    );
  } catch (error: any) {
    // Para exclusões, registramos o erro mas não travamos
    console.error(`[HomeFin] Falha ao cancelar oportunidade ${idOportunidade}:`, error);
    throw error;
  }
}


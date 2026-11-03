/**
 * Ciclo de vida da oportunidade no provedor bancário: follow-ups e
 * cancelamento. Extraído de `enviar.server.ts` sem alteração de comportamento.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { chamarIntegracao } from "@/lib/simulacao/homefin.server";
import { fupsNovos, type FupHomefin } from "./fup-homefin";

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

/**
 * Traz o FUP da oportunidade para a aba Follow-up da proposta, em nome da
 * integração (tipo "homefin_fup", fora do espelho das atividades, que é
 * reescrito a cada leitura). Recado novo dos últimos 7 dias avisa o
 * responsável; o histórico mais antigo entra calado.
 */
export async function importarFupHomefinImpl({
  propostaId,
  supabase,
}: {
  propostaId: string;
  supabase: SupabaseClient<any, any, any>;
}): Promise<number> {
  const { data: prop } = await supabase
    .from("propostas")
    .select(
      "homefin_id_oportunidade, simulacao_id, correspondente_id, numero_proposta, usuario_responsavel_id",
    )
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.homefin_id_oportunidade) return 0;

  const lista = await chamarIntegracao<FupHomefin[]>(
    `/fup/list?idOportunidade=${encodeURIComponent(String(prop.homefin_id_oportunidade))}`,
    "GET",
    undefined,
    {
      simulacao_id: prop.simulacao_id,
      proposta_id: propostaId,
      correspondente_id: prop.correspondente_id,
    },
  );
  const { data: atuais } = await supabase
    .from("proposta_followups")
    .select("tipo, titulo, comentario, created_at")
    .eq("proposta_id", propostaId);
  const novos = fupsNovos(lista, (atuais ?? []) as any[]);
  if (novos.length === 0) return 0;

  await supabase.from("proposta_followups").insert(
    novos.map((n) => ({
      proposta_id: propostaId,
      tipo: "homefin_fup",
      titulo: n.titulo,
      comentario: n.comentario,
      homefin_enviado: true,
      created_at: n.created_at,
    })) as any,
  );

  const recentes = novos.filter((n) => Date.now() - +new Date(n.created_at) < 7 * 86_400_000);
  if (recentes.length > 0 && prop.usuario_responsavel_id) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notificacoes").insert({
      user_id: prop.usuario_responsavel_id,
      correspondente_id: prop.correspondente_id,
      tipo: "proposta",
      titulo: "Retorno do banco",
      corpo: `${prop.numero_proposta}: ${recentes.map((n) => n.titulo).join(" · ")}`,
      link: `/operacional/propostas/${propostaId}`,
    } as any);
  }
  return novos.length;
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

  const idOp = prop?.homefin_id_oportunidade;
  if (!idOp) return;

  // Requisito 1: Só cancelar na HomeFin quando for o ÚLTIMO uso.
  // Verifica se existem outras propostas ativas usando a mesma oportunidade.
  const { count: outrasAtivas } = await supabase
    .from("propostas")
    .select("id", { count: "exact", head: true })
    .eq("homefin_id_oportunidade", idOp)
    .neq("id", propostaId)
    .not("status", "eq", "cancelada")
    .is("deleted_at", null);

  // Verifica se a simulação de origem ainda aponta para esta oportunidade.
  const { data: simOrigem } = prop.simulacao_id
    ? await supabase
        .from("simulacoes")
        .select("id, homefin_id_oportunidade")
        .eq("id", prop.simulacao_id)
        .maybeSingle()
    : { data: null };

  const emUsoPelaSimulacao = simOrigem?.homefin_id_oportunidade === idOp;
  const emUsoPorOutras = (outrasAtivas ?? 0) > 0;

  if (emUsoPelaSimulacao || emUsoPorOutras) {
    console.log(
      `[HomeFin] Cancelamento da proposta ${propostaId} apenas local. Oportunidade ${idOp} continua em uso (Simulação: ${emUsoPelaSimulacao}, Outras Propostas: ${emUsoPorOutras})`,
    );
    await supabase.from("proposta_historico").insert({
      proposta_id: propostaId,
      tipo_evento: "cancelada",
      descricao:
        "Cancelamento local concluído. A oportunidade bancária permanece ativa para outros usos vinculados.",
      status_novo: "cancelada",
    });
    return;
  }

  try {
    // Requisito: Oportunidade compartilhada. Não cancelar a OPORTUNIDADE (tipoSituacao: C)
    // se houver outros registros. Já verificado acima.
    await chamarIntegracao<any>(
      `/oportunidade/${idOp}`,
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

    throw error;
  }
}

/**
 * Versão genérica para cancelar oportunidade via Simulação ou Proposta (incluindo excluídas).
 * Agora também respeita a regra de "último uso".
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
  const { count: outrasAtivas } = await supabase
    .from("propostas")
    .select("id", { count: "exact", head: true })
    .eq("homefin_id_oportunidade", idOportunidade)
    .filter("id", "neq", propostaId || "00000000-0000-0000-0000-000000000000")
    .not("status", "eq", "cancelada")
    .is("deleted_at", null);

  const { data: simUso } = await supabase
    .from("simulacoes")
    .select("id")
    .eq("homefin_id_oportunidade", idOportunidade)
    .filter("id", "neq", simulacaoId || "00000000-0000-0000-0000-000000000000")
    .is("deleted_at", null)
    .maybeSingle();

  if ((outrasAtivas ?? 0) > 0 || simUso) {
    console.log(
      `[HomeFin] Oportunidade ${idOportunidade} não será cancelada no banco pois ainda está em uso por outros registros.`,
    );
    return;
  }

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
    console.error(`[HomeFin] Falha ao cancelar oportunidade ${idOportunidade}:`, error);
    throw error;
  }
}

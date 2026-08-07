import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export interface OrfaHomefin {
  tipo: "proposta" | "simulacao";
  id: string;
  codigo: string;
  cliente: string;
  id_oportunidade: string;
  status_crm: string;
  cancelamento_pendente: boolean;
  deleted_at: string | null;
}

export const listarOportunidadesOrfas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrfaHomefin[]> => {
    const { supabase } = context;

    // 1. Propostas canceladas ou excluídas com homefin_id_oportunidade
    // Usamos query builder flexível para evitar erros de tipagem com relacionamentos complexos
    const { data: props, error: errP } = await supabase
      .from("propostas")
      .select(`
        id, 
        numero_proposta, 
        homefin_id_oportunidade, 
        status, 
        deleted_at, 
        cancelamento_pendente_banco,
        proposta_envolvidos(nome_completo, tipo_qualificacao)
      `)
      .not("homefin_id_oportunidade", "is", null)
      .or("status.eq.cancelada,deleted_at.not.is.null")
      .limit(300);

    if (errP) throw errP;

    // 2. Simulações excluídas com homefin_id_oportunidade
    const { data: sims, error: errS } = await supabase
      .from("simulacoes")
      .select("id, homefin_id_oportunidade, deleted_at, nome_cliente")
      .not("homefin_id_oportunidade", "is", null)
      .not("deleted_at", "is", null)
      .limit(300);

    if (errS) throw errS;

    const result: OrfaHomefin[] = [];

    (props ?? []).forEach((p: any) => {
      // Filtra o titular localmente para garantir o nome correto
      const titular = p.proposta_envolvidos?.find((e: any) => e.tipo_qualificacao === "titular");
      
      result.push({
        tipo: "proposta",
        id: p.id,
        codigo: p.numero_proposta || `ID: ${p.id.slice(0, 8)}`,
        cliente: titular?.nome_completo || "Não identificado",
        id_oportunidade: p.homefin_id_oportunidade,
        status_crm: p.deleted_at ? "Excluída" : "Cancelada",
        cancelamento_pendente: !!p.cancelamento_pendente_banco,
        deleted_at: p.deleted_at,
      });
    });

    (sims ?? []).forEach((s: any) => {
      result.push({
        tipo: "simulacao",
        id: s.id,
        codigo: `SIM-${s.id.slice(0, 8)}`,
        cliente: s.nome_cliente || "Não identificado",
        id_oportunidade: s.homefin_id_oportunidade,
        status_crm: "Excluída",
        cancelamento_pendente: false,
        deleted_at: s.deleted_at,
      });
    });

    return result.sort((a, b) => (b.deleted_at || "").localeCompare(a.deleted_at || ""));
  });

export const cancelarOrfaEmLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ 
    ids: z.array(z.string()),
    tipo: z.enum(["proposta", "simulacao"])
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { cancelarOportunidadeHomefinGenerico } = await import("@/lib/propostas/enviar.server");

    let sucessos = 0;
    let falhas = 0;
    const relatorio: string[] = [];

    for (const id of data.ids) {
      try {
        const table = data.tipo === "proposta" ? "propostas" : "simulacoes";
        const { data: item, error: fetchErr } = await supabase
          .from(table as any)
          .select("homefin_id_oportunidade, simulacao_id, correspondente_id")
          .eq("id", id)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (item && (item as any).homefin_id_oportunidade) {
          await cancelarOportunidadeHomefinGenerico({
            idOportunidade: (item as any).homefin_id_oportunidade,
            simulacaoId: data.tipo === "simulacao" ? id : (item as any).simulacao_id,
            propostaId: data.tipo === "proposta" ? id : null,
            correspondenteId: (item as any).correspondente_id,
            supabase,
          });

          // Se for proposta, limpa flag de pendência
          if (data.tipo === "proposta") {
            await supabase
              .from("propostas")
              .update({ cancelamento_pendente_banco: false } as any)
              .eq("id", id);
          }
          sucessos++;
          relatorio.push(`OK: ${id} cancelado no banco.`);
        }
      } catch (e: any) {
        falhas++;
        relatorio.push(`ERRO: ${id} - ${e.message || "Erro na integração"}`);
      }
    }

    return { sucessos, falhas, relatorio };
  });


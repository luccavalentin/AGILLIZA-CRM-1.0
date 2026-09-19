import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ResultadoBusca {
  id: string;
  tipo: "cliente" | "simulacao" | "proposta" | "tarefa";
  titulo: string;
  subtitulo?: string;
  link: string;
}

export interface RespostaBusca {
  termo: string;
  resultados: ResultadoBusca[];
}

/**
 * Busca global (⌘K) em clientes, simulações, propostas e tarefas.
 * Usa o client Supabase autenticado do usuário (RLS aplica o escopo).
 */
export const buscaGlobal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ termo: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data, context }): Promise<RespostaBusca> => {
    const { supabase } = context;
    const termo = data.termo;
    // Valor entre aspas no filtro `or` do PostgREST: vírgula ou parêntese no
    // termo quebravam a consulta. Aspas, barra e `%` saem do termo (`_` fica:
    // como curinga de um caractere, ainda casa com o próprio `_`).
    const limpo = termo.replace(/["\\%]/g, "");
    const like = `%${limpo}%`;
    const ilike = (col: string) => `${col}.ilike."${like}"`;
    // CPF/CNPJ digitado com pontuação ("123.456.789-00"): o gravado é só dígito.
    const digitos = limpo.replace(/\D/g, "");
    const porDoc = (col: string) =>
      digitos.length >= 3 && digitos !== limpo ? [`${col}.ilike."%${digitos}%"`] : [];

    const resultados: ResultadoBusca[] = [];

    // Também pelo número (CLI-, SIM-, PRO-, número da proposta no banco e da
    // tarefa): antes a busca só olhava nome/CPF/e-mail e não achava nada
    // procurando o número que aparece em todas as telas.
    const [clientes, simulacoes, propostas, tarefas] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nome, documento, numero_cliente, email")
        .is("deleted_at", null)
        .or(
          [
            ilike("nome"),
            ilike("documento"),
            ilike("email"),
            ilike("numero_cliente"),
            ...porDoc("documento"),
          ].join(","),
        )
        .limit(6),
      supabase
        .from("simulacoes")
        .select("id, nome_cliente, cpf_cnpj, numero_simulacao")
        .is("deleted_at", null)
        .or(
          [
            ilike("nome_cliente"),
            ilike("cpf_cnpj"),
            ilike("numero_simulacao"),
            ...porDoc("cpf_cnpj"),
          ].join(","),
        )
        .limit(6),
      supabase
        .from("propostas")
        .select("id, nome_cliente, cpf_cnpj, numero_proposta, nome_banco")
        // Proposta na lixeira não aparece na busca (antes aparecia).
        .is("deleted_at", null)
        .or(
          [
            ilike("nome_cliente"),
            ilike("cpf_cnpj"),
            ilike("numero_proposta"),
            ilike("numero_proposta_banco"),
            ...porDoc("cpf_cnpj"),
          ].join(","),
        )
        .limit(6),
      supabase
        .from("tasks")
        .select("id, titulo, numero")
        .is("deleted_at", null)
        .or([ilike("titulo"), ilike("numero")].join(","))
        .limit(6),
    ]);

    for (const c of clientes.data ?? []) {
      resultados.push({
        id: `cliente-${c.id}`,
        tipo: "cliente",
        titulo: c.nome ?? "Cliente",
        subtitulo: c.documento ?? c.email ?? undefined,
        link: `/crm/clientes/${c.id}`,
      });
    }
    for (const s of simulacoes.data ?? []) {
      resultados.push({
        id: `simulacao-${s.id}`,
        tipo: "simulacao",
        titulo: s.nome_cliente ?? "Simulação",
        subtitulo: s.numero_simulacao ? `Nº ${s.numero_simulacao}` : (s.cpf_cnpj ?? undefined),
        link: `/operacional/simulacoes/${s.id}`,
      });
    }
    for (const p of propostas.data ?? []) {
      resultados.push({
        id: `proposta-${p.id}`,
        tipo: "proposta",
        titulo: p.nome_cliente ?? "Proposta",
        subtitulo: p.numero_proposta ? `Nº ${p.numero_proposta}` : (p.nome_banco ?? undefined),
        link: `/operacional/propostas/${p.id}`,
      });
    }
    for (const t of tarefas.data ?? []) {
      resultados.push({
        id: `tarefa-${t.id}`,
        tipo: "tarefa",
        titulo: t.titulo ?? "Tarefa",
        subtitulo: t.numero ? `Nº ${t.numero}` : undefined,
        link: `/operacional/tarefas`,
      });
    }

    return { termo, resultados };
  });

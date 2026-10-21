import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { termoSemAcento } from "@/lib/crm/busca";
import { mascararDocumento } from "@/lib/crm/documento";
import { temPiiCliente } from "@/lib/crm/pii";

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

/** Módulo que libera cada tipo de resultado (o mesmo `:view` das telas). */
const MODULO_DO_TIPO: Record<ResultadoBusca["tipo"], string> = {
  cliente: "crm.clientes",
  simulacao: "operacional.simulacoes",
  proposta: "operacional.propostas",
  tarefa: "operacional.tarefas",
};

/**
 * Busca global (⌘K) em clientes, simulações, propostas e tarefas.
 * Usa o client Supabase autenticado do usuário (RLS aplica o escopo) e só
 * procura nos tipos cujo módulo o usuário pode ver.
 */
export const buscaGlobal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ termo: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data, context }): Promise<RespostaBusca> => {
    const { supabase, userId } = context;
    const termo = data.termo;

    // Mesma regra de `usuario_tem_permissao` das telas (admin/correspondente
    // passam). "Ver dados sensíveis" decide se o documento aparece inteiro e se
    // pode ser achado por pedaço.
    const pode = async (modulo: string, acao: string) => {
      const { data: ok, error } = await supabase.rpc("usuario_tem_permissao", {
        _user_id: userId,
        _modulo: modulo,
        _acao: acao,
      });
      if (error) throw new Error("Não foi possível conferir suas permissões.");
      return ok === true;
    };
    const [verClientes, verSimulacoes, verPropostas, verTarefas, podePii] = await Promise.all([
      pode(MODULO_DO_TIPO.cliente, "view"),
      pode(MODULO_DO_TIPO.simulacao, "view"),
      pode(MODULO_DO_TIPO.proposta, "view"),
      pode(MODULO_DO_TIPO.tarefa, "view"),
      temPiiCliente(supabase, userId),
    ]);

    // Valor entre aspas no filtro `or` do PostgREST: vírgula ou parêntese no
    // termo quebravam a consulta. Aspas, barra e `%` saem do termo (`_` fica:
    // como curinga de um caractere, ainda casa com o próprio `_`).
    const limpo = termo.replace(/["\\%]/g, "");
    const like = `%${limpo}%`;
    const ilike = (col: string) => `${col}.ilike."${like}"`;
    // CPF/CNPJ digitado com ou sem pontuação: o gravado é só dígito. Sem "Ver
    // dados sensíveis", só o documento inteiro encontra o registro: a busca por
    // pedaço deixava descobrir o CPF que a tela mostra mascarado (mesma regra de
    // listarClientes).
    const digitos = limpo.replace(/\D/g, "");
    const porDoc = (col: string): string[] => {
      if (podePii) {
        const filtros = [ilike(col)];
        if (digitos.length >= 3 && digitos !== limpo) filtros.push(`${col}.ilike."%${digitos}%"`);
        return filtros;
      }
      return digitos.length === 11 || digitos.length === 14 ? [`${col}.eq.${digitos}`] : [];
    };
    const documento = (doc: string | null | undefined) =>
      doc ? (podePii ? doc : mascararDocumento(doc)) : undefined;

    const nada = Promise.resolve({ data: [] as any[], error: null });

    // Também pelo número (CLI-, SIM-, PRO-, número da proposta no banco e da
    // tarefa): antes a busca só olhava nome/CPF/e-mail e não achava nada
    // procurando o número que aparece em todas as telas.
    const [clientes, simulacoes, propostas, tarefas] = await Promise.all([
      verClientes
        ? supabase
            .from("clientes")
            .select("id, nome, documento, numero_cliente, email")
            .is("deleted_at", null)
            .or(
              [
                // Nome sem acento ("joao" acha "João"), como na lista de clientes.
                `nome_busca.ilike."%${termoSemAcento(limpo)}%"`,
                ilike("email"),
                ilike("numero_cliente"),
                ...porDoc("documento"),
              ].join(","),
            )
            .limit(6)
        : nada,
      verSimulacoes
        ? supabase
            .from("simulacoes")
            .select("id, nome_cliente, cpf_cnpj, numero_simulacao")
            .is("deleted_at", null)
            .or([ilike("nome_cliente"), ilike("numero_simulacao"), ...porDoc("cpf_cnpj")].join(","))
            .limit(6)
        : nada,
      verPropostas
        ? supabase
            .from("propostas")
            .select("id, nome_cliente, cpf_cnpj, numero_proposta, nome_banco")
            // Proposta na lixeira não aparece na busca (antes aparecia).
            .is("deleted_at", null)
            .or(
              [
                ilike("nome_cliente"),
                ilike("numero_proposta"),
                ilike("numero_proposta_banco"),
                ...porDoc("cpf_cnpj"),
              ].join(","),
            )
            .limit(6)
        : nada,
      verTarefas
        ? supabase
            .from("tasks")
            .select("id, titulo, numero")
            .is("deleted_at", null)
            .or([ilike("titulo"), ilike("numero")].join(","))
            .limit(6)
        : nada,
    ]);

    // Uma consulta que falha não pode virar "nenhum resultado": a tela mostra
    // que a busca caiu.
    if (clientes.error || simulacoes.error || propostas.error || tarefas.error) {
      throw new Error("Não foi possível concluir a busca.");
    }

    const resultados: ResultadoBusca[] = [];
    for (const c of clientes.data ?? []) {
      resultados.push({
        id: `cliente-${c.id}`,
        tipo: "cliente",
        titulo: c.nome ?? "Cliente",
        subtitulo: documento(c.documento) ?? c.email ?? undefined,
        link: `/crm/clientes/${c.id}`,
      });
    }
    for (const s of simulacoes.data ?? []) {
      resultados.push({
        id: `simulacao-${s.id}`,
        tipo: "simulacao",
        titulo: s.nome_cliente ?? "Simulação",
        subtitulo: s.numero_simulacao ? `Nº ${s.numero_simulacao}` : documento(s.cpf_cnpj),
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

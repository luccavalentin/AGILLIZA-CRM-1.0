/**
 * Execução da conciliação (server-only): carrega os registros do sistema,
 * cruza contra as linhas do arquivo e persiste lote + itens.
 */
import { normalizarNome, somenteDigitos, type LinhaBanco } from "./bancos";
import { cruzar, type RegistroSistema } from "./conciliacao.server";
import { registrarAuditoria } from "@/lib/admin/audit.server";

interface Entrada {
  bancoLabel: string;
  periodo: string; // AAAA-MM
  nomeArquivo: string;
  linhas: LinhaBanco[];
}

interface Ctx {
  supabase: any;
  userId: string;
}

function limitesDoPeriodo(periodo: string): { inicio: string; fim: string } {
  const [ano, mes] = periodo.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano!, mes! - 1, 1));
  const fim = new Date(Date.UTC(ano!, mes!, 0));
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

/** Carrega propostas + bancos visíveis ao usuário (RLS aplica o escopo). */
export async function carregarSistema(supabase: any): Promise<RegistroSistema[]> {
  const out: RegistroSistema[] = [];
  const passo = 1000;
  for (let inicio = 0; inicio < 20000; inicio += passo) {
    const { data, error } = await supabase
      .from("proposta_bancos")
      .select(
        "id, proposta_id, nome_banco, numero_proposta_banco, situacao_banco, status_banco, valor_financiamento_max, propostas!inner(id, numero_proposta, numero_proposta_banco, nome_cliente, cpf_cnpj, valor_financiamento, nome_banco, created_at, deleted_at)",
      )
      .is("propostas.deleted_at", null)
      .range(inicio, inicio + passo - 1);
    if (error) throw new Error(error.message);
    const linhas = data ?? [];
    for (const b of linhas) {
      const p = b.propostas ?? {};
      out.push({
        proposta_banco_id: b.id,
        proposta_id: b.proposta_id ?? p.id,
        numero_proposta: p.numero_proposta ?? null,
        numero_proposta_banco: b.numero_proposta_banco ?? p.numero_proposta_banco ?? null,
        nome_cliente: p.nome_cliente ?? null,
        cpf_digits: somenteDigitos(p.cpf_cnpj),
        nome_norm: normalizarNome(p.nome_cliente),
        situacao: b.situacao_banco ?? null,
        valor:
          b.valor_financiamento_max != null
            ? Number(b.valor_financiamento_max)
            : p.valor_financiamento != null
              ? Number(p.valor_financiamento)
              : null,
        created_at: p.created_at ?? null,
        nome_banco: b.nome_banco ?? p.nome_banco ?? null,
      });
    }
    if (linhas.length < passo) break;
  }
  return out;
}

export async function executarConciliacao(
  context: Ctx,
  entrada: Entrada,
): Promise<{ loteId: string }> {
  const { supabase, userId } = context;

  const { data: correspondenteId } = await supabase.rpc("correspondente_do_usuario", {
    _user_id: userId,
  });
  if (!correspondenteId) {
    throw new Error("Não foi possível identificar o ecossistema do usuário.");
  }

  const periodo = limitesDoPeriodo(entrada.periodo);
  const sistema = await carregarSistema(supabase);
  const itens = cruzar(entrada.bancoLabel, entrada.linhas, sistema, periodo);

  const conta = (r: string) => itens.filter((i) => i.resultado === r).length;

  const { data: lote, error: erroLote } = await supabase
    .from("conciliacao_lotes")
    .insert({
      correspondente_id: correspondenteId,
      banco_nome: entrada.bancoLabel,
      periodo_referencia: `${entrada.periodo}-01`,
      nome_arquivo: entrada.nomeArquivo,
      enviado_por: userId,
      total_linhas: itens.length,
      total_conferidas: conta("conferido"),
      total_divergentes: conta("divergente"),
      total_ausentes_sistema: conta("ausente_no_sistema"),
      total_ausentes_banco: conta("ausente_no_banco"),
    })
    .select("id")
    .single();
  if (erroLote) throw new Error(erroLote.message);

  const loteId = lote.id as string;
  const bloco = 500;
  for (let i = 0; i < itens.length; i += bloco) {
    const { error } = await supabase
      .from("conciliacao_itens")
      .insert(itens.slice(i, i + bloco).map((it) => ({ ...it, lote_id: loteId })));
    if (error) {
      await supabase.from("conciliacao_lotes").delete().eq("id", loteId);
      throw new Error(error.message);
    }
  }

  await registrarAuditoria({
    supabase,
    userId,
    correspondenteId,
    acao: "conciliacao.processar",
    descricao: `conciliou o relatório ${entrada.bancoLabel} (${entrada.periodo}) — ${itens.length} linhas`,
    entidade: "conciliacao_lotes",
    entidadeId: loteId,
    payloadNovo: {
      banco: entrada.bancoLabel,
      periodo: entrada.periodo,
      arquivo: entrada.nomeArquivo,
      total: itens.length,
      divergentes: conta("divergente"),
    },
  });

  return { loteId };
}

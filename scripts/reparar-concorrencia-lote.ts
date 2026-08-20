import { supabaseAdmin } from "../integrations/supabase/client.server";

async function repararStatusSimulacoes() {
  console.log("Iniciando reparo de status de simulações...");

  // 1. Busca simulações recentes em 'enviando' ou 'erro_banco' que têm bancos simulados
  const { data: sims } = await supabaseAdmin
    .from("simulacoes")
    .select("id, numero_simulacao, status, simulacao_bancos(status_banco, valor_parcela, selecionado)")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .or("status.eq.enviando,status.eq.erro_banco");

  for (const sim of sims || []) {
    const bancos = (sim.simulacao_bancos as any[]) || [];
    const selecionados = bancos.filter(b => b.selecionado !== false);
    if (selecionados.length === 0) continue;

    const simulados = selecionados.filter(b => b.status_banco === "simulada" && Number(b.valor_parcela) > 0);
    const pendentes = selecionados.filter(b => b.status_banco === "aguardando" || b.status_banco === "enviando");
    
    let novoStatus = sim.status;
    if (pendentes.length === 0) {
      if (simulados.length === selecionados.length) {
        novoStatus = "simulada";
      } else if (simulados.length > 0) {
        novoStatus = "parcialmente_simulada";
      } else {
        novoStatus = "erro_banco";
      }
    }

    if (novoStatus !== sim.status) {
      console.log(`Atualizando ${sim.numero_simulacao}: ${sim.status} -> ${novoStatus}`);
      await supabaseAdmin.from("simulacoes").update({ status: novoStatus }).eq("id", sim.id);
    }
  }

  // 2. Limpa mensagens de erro falsas nos bancos que têm valor
  const { data: bancosErroFalso } = await supabaseAdmin
    .from("simulacao_bancos")
    .select("id, nome_banco, mensagem_banco")
    .eq("status_banco", "erro")
    .gt("valor_parcela", 0)
    .ilike("mensagem_banco", "%Um envio ao banco já está em andamento%");

  for (const b of bancosErroFalso || []) {
    console.log(`Limpando erro falso no banco ${b.nome_banco} (${b.id})`);
    await supabaseAdmin
      .from("simulacao_bancos")
      .update({ status_banco: "simulada", mensagem_banco: null })
      .eq("id", b.id);
  }

  console.log("Reparo concluído.");
}

repararStatusSimulacoes().catch(console.error);

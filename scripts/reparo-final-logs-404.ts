import { supabaseAdmin } from "../src/integrations/supabase/client.server";

async function reparar() {
  console.log("=== INICIANDO REPARO DE LOGS 404 E BANCOS PRESOS ===");
  
  // 1. Marcar como erro bancos que geraram 404 recentemente no endpoint /simulacao/
  const { data: logs404 } = await supabaseAdmin
    .from("simulacao_logs_homefin")
    .select("simulacao_id, created_at")
    .eq("status_http", 404)
    .ilike("endpoint", "/simulacao/%")
    .order("created_at", { ascending: false })
    .limit(500);

  const ids404 = [...new Set(logs404?.map(l => l.simulacao_id).filter(Boolean))];
  console.log(`Identificadas ${ids404.length} simulações com erros 404 persistentes.`);

  for (const id of ids404) {
    await supabaseAdmin
      .from("simulacao_bancos")
      .update({ 
        status_banco: "erro", 
        mensagem_banco: "A simulação não foi encontrada ou expirou no banco. Por favor, tente reenviar." 
      })
      .eq("simulacao_id", id)
      .in("status_banco", ["aguardando", "enviando"]);
  }

  // 2. Corrigir simulações que estão em "enviando" mas não têm mais bancos pendentes
  const { data: enviando } = await supabaseAdmin
    .from("simulacoes")
    .select("id")
    .eq("status", "enviando");

  console.log(`Verificando ${enviando?.length || 0} simulações em status 'enviando'...`);

  for (const sim of enviando || []) {
    const { data: bancos } = await supabaseAdmin
      .from("simulacao_bancos")
      .select("status_banco")
      .eq("simulacao_id", sim.id)
      .eq("selecionado", true);

    const pendentes = bancos?.filter(b => b.status_banco === "aguardando" || b.status_banco === "enviando").length || 0;
    const sucesso = bancos?.filter(b => b.status_banco === "simulada").length || 0;
    
    if (pendentes === 0) {
      const novoStatus = sucesso > 0 ? "parcialmente_simulada" : "erro_banco";
      console.log(`Corrigindo simulação ${sim.id} para ${novoStatus}`);
      await supabaseAdmin.from("simulacoes").update({ status: novoStatus }).eq("id", sim.id);
    }
  }

  console.log("Reparo concluído.");
}
reparar();

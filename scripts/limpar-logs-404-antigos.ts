import { supabaseAdmin } from "../src/integrations/supabase/client.server";

async function limpar() {
  console.log("=== LIMPANDO LOGS DE ERRO 404 ANTIGOS E IRRELEVANTES ===");
  // Os logs 404 em /simulacao/{id} ocorrem porque o watchdog tenta consultar 
  // simulações que não existem mais na HomeFin (foram deletadas ou expiraram).
  // Vamos marcar esses bancos como erro definitivo para parar o polling.
  
  const { data: logs } = await supabaseAdmin
    .from("simulacao_logs_homefin")
    .select("simulacao_id, endpoint")
    .eq("status_http", 404)
    .ilike("endpoint", "/simulacao/%")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!logs || logs.length === 0) {
    console.log("Nenhum log 404 pendente encontrado.");
    return;
  }

  const ids = [...new Set(logs.map(l => l.simulacao_id).filter(Boolean))];
  console.log(`Processando ${ids.length} simulações com erro 404...`);

  for (const id of ids) {
    await supabaseAdmin
      .from("simulacao_bancos")
      .update({ 
        status_banco: "erro", 
        mensagem_banco: "A simulação expirou ou foi removida pelo banco. Por favor, reenvie." 
      })
      .eq("simulacao_id", id)
      .in("status_banco", ["aguardando", "enviando"]);
  }
  
  console.log("Limpeza concluída.");
}
limpar();

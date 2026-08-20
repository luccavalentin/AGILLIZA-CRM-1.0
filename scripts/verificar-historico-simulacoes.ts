import { supabaseAdmin } from "../src/integrations/supabase/client.server";

async function verificar() {
  console.log("=== HISTÓRICO DE MENSAGENS DE POLLING ===");
  const { data: hist } = await supabaseAdmin
    .from("simulacao_historico")
    .select("created_at, descricao, simulacao_id")
    .ilike("descricao", "%Consulta de retorno%")
    .order("created_at", { ascending: false })
    .limit(10);

  hist?.forEach(h => {
    console.log(`${h.created_at} | SimID: ${h.simulacao_id} | ${h.descricao}`);
  });
}
verificar();

import { supabaseAdmin } from "../src/integrations/supabase/client.server";

async function analisar() {
  const { data: logs } = await supabaseAdmin
    .from("simulacao_logs_homefin")
    .select("endpoint, status_http, erro, created_at")
    .eq("status_http", 404)
    .order("created_at", { ascending: false })
    .limit(20);

  console.log("=== LOGS 404 RECENTES ===");
  logs?.forEach(l => {
    console.log(`${l.created_at} | ${l.status_http} | ${l.endpoint} | ${l.erro}`);
  });
}
analisar();

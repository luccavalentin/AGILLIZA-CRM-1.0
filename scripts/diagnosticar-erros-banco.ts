import { supabaseAdmin } from "../src/integrations/supabase/client.server";

async function diagnosticar() {
  console.log("=== DIAGNÓSTICO DE ERROS DE BANCO ===");
  
  const { data: logs, error } = await supabaseAdmin
    .from("simulacao_logs_homefin")
    .select("created_at, endpoint, metodo, status_http, request_masked, response, erro")
    .neq("status_http", 200)
    .neq("status_http", 201)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Erro ao buscar logs:", error.message);
    return;
  }

  if (!logs || logs.length === 0) {
    console.log("Nenhum log de erro recente encontrado.");
    return;
  }

  logs.forEach((log, i) => {
    console.log(`\n[${i+1}] ${log.created_at} | ${log.metodo} ${log.endpoint} | Status: ${log.status_http}`);
    if (log.erro) console.log("Erro:", log.erro);
    
    const resp = log.response as any;
    if (resp?.error) {
       console.log("Response Error Code:", resp.error.code);
       console.log("Response Error Message:", resp.error.message);
       if (resp.error.context) console.log("Response Error Context:", JSON.stringify(resp.error.context));
    } else if (resp) {
       console.log("Response:", JSON.stringify(resp).substring(0, 500));
    }
  });

  // Verificar simulações travadas
  const { data: travadas } = await supabaseAdmin
    .from("simulacoes")
    .select("id, numero_simulacao, status, updated_at")
    .eq("status", "enviando")
    .limit(5);

  if (travadas && travadas.length > 0) {
    console.log("\n=== SIMULAÇÕES TRAVADAS EM 'ENVIANDO' ===");
    travadas.forEach(s => {
      console.log(`${s.numero_simulacao} (${s.id}) | Atualizada em: ${s.updated_at}`);
    });
  }
}

diagnosticar();

import { supabaseAdmin } from "../src/integrations/supabase/client.server";

async function diagnosticar() {
  console.log("=== DIAGNÓSTICO DE ERROS DE BANCO V2 ===");
  
  // Buscar erros que NÃO sejam o polling de 404 (que já sabemos o motivo)
  const { data: logs, error } = await supabaseAdmin
    .from("simulacao_logs_homefin")
    .select("created_at, endpoint, metodo, status_http, request_masked, response, erro, simulacao_id")
    .neq("status_http", 200)
    .neq("status_http", 201)
    .not("endpoint", "ilike", "/simulacao/%") // Ignorar o endpoint problemático de polling individual
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Erro ao buscar logs:", error.message);
    return;
  }

  if (!logs || logs.length === 0) {
    console.log("Nenhum log de erro relevante encontrado (excluindo polling 404).");
  } else {
    logs.forEach((log, i) => {
      console.log(`\n[${i+1}] ${log.created_at} | ${log.metodo} ${log.endpoint} | Status: ${log.status_http} | SimID: ${log.simulacao_id}`);
      if (log.erro) console.log("Erro:", log.erro);
      
      const resp = log.response as any;
      if (resp?.error) {
         console.log("Response Error Code:", resp.error.code);
         console.log("Response Error Message:", resp.error.message);
         if (resp.error.context) console.log("Response Error Context:", JSON.stringify(resp.error.context));
      } else if (resp) {
         console.log("Response:", JSON.stringify(resp).substring(0, 1000));
      }
      
      if (log.request_masked) {
         console.log("Request (Masked):", JSON.stringify(log.request_masked).substring(0, 500));
      }
    });
  }

  // Verificar se há erros de "aguardando" que o watchdog deveria ter pego
  const { data: aguardando } = await supabaseAdmin
    .from("simulacao_bancos")
    .select("id, nome_banco, status_banco, updated_at, simulacao_id")
    .eq("status_banco", "aguardando")
    .order("updated_at", { ascending: true })
    .limit(10);

  if (aguardando && aguardando.length > 0) {
    console.log("\n=== BANCOS EM 'AGUARDANDO' (POSSÍVEIS TRAVAMENTOS) ===");
    aguardando.forEach(b => {
      console.log(`${b.nome_banco} | SimID: ${b.simulacao_id} | Status: ${b.status_banco} | Último Update: ${b.updated_at}`);
    });
  }
}

diagnosticar();
